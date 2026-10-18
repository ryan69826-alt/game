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
            pavement: '#66736c', path: '#889182', building: '#536b70', entrance: '#dfb777', tree: '#204b35', car: '#47525a', median: '#416444'};
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const {kind} = map.tileAt(x, y), px = x * tileSize, py = y * tileSize;
            terrainContext.fillStyle = colors[kind];terrainContext.fillRect(px, py, tileSize, tileSize);
            terrainContext.strokeStyle = '#b7d6c41b';terrainContext.lineWidth = .6;terrainContext.strokeRect(px, py, tileSize, tileSize);
            if (kind === 'tree') {
                terrainContext.fillStyle = '#6e9170';terrainContext.fillRect(px + 4, py + 3, 8, 9);
            } else if (kind === 'road') {
                const centerY = map.roads.horizontal.y + Math.floor(map.roads.horizontal.height / 2);
                const centerX = map.roads.vertical.x + Math.floor(map.roads.vertical.width / 2);
                terrainContext.fillStyle = '#98a99b';
                if (y === centerY && x % 3 === 0 && (x < map.roads.vertical.x || x >= map.roads.vertical.x + map.roads.vertical.width)) terrainContext.fillRect(px + 3, py + 7, 10, 2);
                if (x === centerX && y % 3 === 0 && y < map.roads.horizontal.y) terrainContext.fillRect(px + 7, py + 3, 2, 10);
            }
        }
        // Draw complete bays and vehicles once, rather than a mark per tile.
        terrainContext.strokeStyle = '#b2bdb2';terrainContext.lineWidth = 1;
        for (const bay of map.parkingBays) {
            const x = bay.x * tileSize, y = bay.y * tileSize, w = bay.width * tileSize, h = bay.height * tileSize;
            const opensSouth = bay.y === map.parking.y || bay.y === map.parking.median.y + map.parking.median.height;
            terrainContext.beginPath();
            terrainContext.moveTo(x, opensSouth ? y + h : y);terrainContext.lineTo(x, opensSouth ? y : y + h);
            terrainContext.lineTo(x + w, opensSouth ? y : y + h);terrainContext.lineTo(x + w, opensSouth ? y + h : y);
            terrainContext.stroke();
        }
        const median = map.parking.median;
        terrainContext.strokeStyle = '#9aaa8b';
        terrainContext.strokeRect(median.x * tileSize + 1, median.y * tileSize + 1, median.width * tileSize - 2, median.height * tileSize - 2);
        for (let x = median.x; x < median.x + median.width; x += 2) {
            terrainContext.fillStyle = '#5c8056';terrainContext.fillRect(x * tileSize + 8, median.y * tileSize + 8, 16, 16);
        }
        for (const car of map.cars) {
            const x = car.x * tileSize, y = car.y * tileSize;
            terrainContext.fillStyle = '#17282c';
            for (const wx of [2, 26]) for (const wy of [6, 22]) terrainContext.fillRect(x + wx, y + wy, 4, 6);
            terrainContext.fillStyle = car.color;terrainContext.fillRect(x + 5, y + 2, 22, 28);
            terrainContext.fillStyle = '#273e49';terrainContext.fillRect(x + 8, y + 7, 16, 6);terrainContext.fillRect(x + 8, y + 22, 16, 5);
            terrainContext.fillStyle = '#d2d7c2';terrainContext.fillRect(x + 7, y + 3, 4, 2);terrainContext.fillRect(x + 21, y + 3, 4, 2);
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
            if (Dialog.isOpen()) return false;
            const result = setup.worldMovement.move(dx, dy);
            const status = document.getElementById('movement-status');
            const world = State.variables.world;
            const entrance = map.tileAt(world.x, world.y).kind === 'entrance';
            const feedback = result.moved ? (entrance ? 'Interiors are not available yet.' : '') : result.reason;
            if (status.textContent !== feedback) status.textContent = feedback;
            refresh(result.moved);
            return result.moved;
        }
        const directions = {north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0]};
        const repeatDelay = 200;
        let held = null, repeatTimer = 0;
        function stopHold() {
            clearTimeout(repeatTimer);
            const previous = held;held = null;
            if (previous?.button?.hasPointerCapture(previous.key)) previous.button.releasePointerCapture(previous.key);
        }
        function repeatStep() {
            if (!held || !local.isConnected || document.hidden || Dialog.isOpen() || !step(...directions[held.direction])) {
                stopHold();return;
            }
            repeatTimer = setTimeout(repeatStep, repeatDelay);
        }
        function startHold(direction, source, key, button = null) {
            stopHold();
            held = {direction, source, key, button};
            if (!step(...directions[direction])) {stopHold();return;}
            repeatTimer = setTimeout(repeatStep, repeatDelay);
        }
        for (const button of document.querySelectorAll('[data-move]')) {
            button.addEventListener('pointerdown', event => {
                if (event.button !== 0 || Dialog.isOpen()) return;
                event.preventDefault();button.focus({preventScroll: true});
                startHold(button.dataset.move, 'pointer', event.pointerId, button);
                if (held) button.setPointerCapture(event.pointerId);
            });
            function release(event) {
                if (held?.source === 'pointer' && held.key === event.pointerId) stopHold();
            }
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
            button.addEventListener('contextmenu', event => event.preventDefault());
            // Keyboard/screen-reader activation still makes one step. Pointer
            // clicks are already handled on pointerdown, so never step twice.
            button.addEventListener('click', event => {if (event.detail === 0) step(...directions[button.dataset.move]);});
        }
        const keys = {ArrowUp: 'north', ArrowRight: 'east', ArrowDown: 'south', ArrowLeft: 'west', w: 'north', d: 'east', s: 'south', a: 'west'};
        function keydown(event) {
            if (Dialog.isOpen() || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
            const direction = keys[event.key] || keys[event.key.toLowerCase()];
            if (!direction) return;
            event.preventDefault();
            const key = event.code || event.key.toLowerCase();
            if (!event.repeat && !(held?.source === 'keyboard' && held.key === key)) startHold(direction, 'keyboard', key);
        }
        function keyup(event) {
            if (held?.source === 'keyboard' && held.key === (event.code || event.key.toLowerCase())) stopHold();
        }
        function visibilityChange() {if (document.hidden) stopHold();}
        document.addEventListener('keydown', keydown);
        document.addEventListener('keyup', keyup);
        document.addEventListener('visibilitychange', visibilityChange);
        window.addEventListener('blur', stopHold);
        $(document).on(':dialogopening.worldMovement', stopHold);
        local.addEventListener('click', event => {
            if (Dialog.isOpen()) return;
            const rect = local.getBoundingClientRect(), world = State.variables.world;
            const x = Math.floor(camera.x + (event.clientX - rect.left) / rect.width * columns);
            const y = Math.floor(camera.y + (event.clientY - rect.top) / rect.height * rows);
            step(x - world.x, y - world.y);
        });
        refresh();
        cleanup = () => {
            stopHold();cancelAnimationFrame(frame);
            document.removeEventListener('keydown', keydown);document.removeEventListener('keyup', keyup);
            document.removeEventListener('visibilitychange', visibilityChange);window.removeEventListener('blur', stopHold);
            $(document).off(':dialogopening.worldMovement', stopHold);
        };
    });
})();
