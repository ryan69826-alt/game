/* Camera, canvas objects, input listeners, and animation stay outside saves. */
(() => {
    let cleanup;
    $(document).on(':passageinit', () => {cleanup?.();cleanup = null;});
    $(document).on(':passagedisplay', () => {
        const local = document.getElementById('local-map');
        if (!local) return;
        const overview = document.getElementById('world-map');
        const map = setup.worldMaps[setup.worldMovement.ensure().mapId];
        const tileSize = 16, columns = local.width / tileSize, rows = local.height / tileSize;
        const terrain = document.createElement('canvas');terrain.width = map.width * tileSize;terrain.height = map.height * tileSize;
        const terrainContext = terrain.getContext('2d');
        const colors = {ground: '#293e35', park: '#416444', road: '#3b4750', parking: '#47525a',
            pavement: '#66736c', path: '#889182', building: '#536b70', entrance: '#dfb777', tree: '#204b35', car: '#718da0'};
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const {kind} = map.tileAt(x, y), px = x * tileSize, py = y * tileSize;
            terrainContext.fillStyle = colors[kind];terrainContext.fillRect(px, py, tileSize, tileSize);
            terrainContext.strokeStyle = '#b7d6c41b';terrainContext.lineWidth = .6;terrainContext.strokeRect(px, py, tileSize, tileSize);
            if (kind === 'parking') {
                terrainContext.fillStyle = '#a4b6ad';terrainContext.fillRect(px + 1, py + 2, 1, 12);
            } else if (kind === 'car') {
                terrainContext.fillStyle = '#283a48';terrainContext.fillRect(px + 3, py + 4, 10, 7);
                terrainContext.fillStyle = '#b6c3c1';terrainContext.fillRect(px + 2, py + 1, 12, 2);
            } else if (kind === 'tree') {
                terrainContext.fillStyle = '#6e9170';terrainContext.fillRect(px + 4, py + 3, 8, 9);
            } else if (kind === 'road' && (y === 46 && x % 3 === 0 || x === 6 && y % 3 === 0)) {
                terrainContext.fillStyle = '#98a99b';
                terrainContext.fillRect(px + 3, py + 7, x === 6 ? 2 : 10, x === 6 ? 8 : 2);
            }
        }
        map.buildings.forEach((building, i) => {
            terrainContext.strokeStyle = '#9bb7b4';terrainContext.lineWidth = 2;
            terrainContext.strokeRect((building.x + .5) * tileSize, (building.y + .5) * tileSize, (building.width - 1) * tileSize, (building.height - 1) * tileSize);
            terrainContext.fillStyle = '#dbe5dd';terrainContext.font = 'bold 20px monospace';terrainContext.textAlign = 'center';
            terrainContext.fillText(`0${i + 1}`, (building.x + building.width / 2) * tileSize, (building.y + building.height / 2) * tileSize + 7);
        });
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        function cameraTarget() {
            const world = State.variables.world;
            return {x: clamp(world.x - Math.floor(columns / 2), 0, Math.max(0, map.width - columns)),
                y: clamp(world.y - Math.floor(rows / 2), 0, Math.max(0, map.height - rows))};
        }
        let camera = cameraTarget(), frame = 0;
        function marker(ctx, x, y, radius) {
            ctx.beginPath();ctx.arc(x, y, radius + 2, 0, Math.PI * 2);ctx.fillStyle = '#102a26';ctx.fill();
            ctx.beginPath();ctx.arc(x, y, radius, 0, Math.PI * 2);ctx.fillStyle = '#bcf4d7';ctx.fill();
            ctx.strokeStyle = '#fff';ctx.lineWidth = 1;ctx.stroke();
        }
        function draw() {
            const world = State.variables.world;
            const ctx = local.getContext('2d');ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, local.width, local.height);
            ctx.drawImage(terrain, camera.x * tileSize, camera.y * tileSize, local.width, local.height, 0, 0, local.width, local.height);
            marker(ctx, (world.x - camera.x + .5) * tileSize, (world.y - camera.y + .5) * tileSize, 5);
            const small = overview.getContext('2d'), scale = overview.width / terrain.width;
            small.imageSmoothingEnabled = false;small.drawImage(terrain, 0, 0, overview.width, overview.height);
            small.strokeStyle = '#e1f6d9';small.lineWidth = 1;
            small.strokeRect(camera.x * tileSize * scale, camera.y * tileSize * scale, local.width * scale, local.height * scale);
            marker(small, (world.x + .5) * tileSize * scale, (world.y + .5) * tileSize * scale, 3);
            local.dataset.playerX = world.x;local.dataset.playerY = world.y;
            local.dataset.cameraX = camera.x;local.dataset.cameraY = camera.y;
            local.setAttribute('aria-label', `Apartments area map. Your position: column ${world.x + 1}, row ${world.y + 1}.`);
        }
        function refresh(animate = false) {
            const world = State.variables.world, target = cameraTarget();
            document.getElementById('movement-position').textContent = `X ${world.x + 1} · Y ${world.y + 1}`;
            document.getElementById('movement-turn').textContent = world.turn;
            document.getElementById('position-description').textContent = `You are at: ${map.tileAt(world.x, world.y).label.toLowerCase()}.`;
            cancelAnimationFrame(frame);
            if (!animate || document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
                camera = target;local.dataset.animating = 'false';draw();return;
            }
            const start = {...camera}, time = performance.now();local.dataset.animating = 'true';
            function tick(now) {
                const fraction = Math.min(1, (now - time) / 140), smooth = 1 - (1 - fraction) ** 3;
                camera = {x: start.x + (target.x - start.x) * smooth, y: start.y + (target.y - start.y) * smooth};draw();
                if (fraction < 1) frame = requestAnimationFrame(tick);
                else local.dataset.animating = 'false';
            }
            frame = requestAnimationFrame(tick);
        }
        function step(dx, dy) {
            const result = setup.worldMovement.move(dx, dy);
            document.getElementById('movement-status').textContent = result.reason;
            refresh(result.moved);
        }
        const directions = {north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0]};
        for (const button of document.querySelectorAll('[data-move]')) button.addEventListener('click', () => step(...directions[button.dataset.move]));
        const keys = {ArrowUp: 'north', ArrowRight: 'east', ArrowDown: 'south', ArrowLeft: 'west', w: 'north', d: 'east', s: 'south', a: 'west'};
        function keydown(event) {
            if (Dialog.isOpen() || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
            const direction = keys[event.key] || keys[event.key.toLowerCase()];
            if (!direction) return;
            event.preventDefault();if (!event.repeat) step(...directions[direction]);
        }
        document.addEventListener('keydown', keydown);
        local.addEventListener('click', event => {
            if (Dialog.isOpen()) return;
            const rect = local.getBoundingClientRect(), world = State.variables.world;
            const x = Math.floor(camera.x + (event.clientX - rect.left) / rect.width * columns);
            const y = Math.floor(camera.y + (event.clientY - rect.top) / rect.height * rows);
            step(x - world.x, y - world.y);
        });
        refresh();
        cleanup = () => {cancelAnimationFrame(frame);document.removeEventListener('keydown', keydown);};
    });
})();
