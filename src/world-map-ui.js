/* Camera, canvas objects, input listeners, and animation stay outside saves. */
(() => {
    let cleanup;
    $(document).on(':passageinit', () => {cleanup?.();cleanup = null;});
    $(document).on(':passagedisplay', () => {
        const local = document.getElementById('local-map');
        if (!local) return;
        const overview = document.getElementById('world-map');
        const map = setup.worldMaps[setup.worldMovement.ensure().mapId];
        if(map.interior) {local.width=map.width*16;local.height=map.height*16;}
        local.style.setProperty('--map-aspect',local.width/local.height);
        document.getElementById('location-title').textContent=map.name;
        document.getElementById('location-subtitle').textContent=map.subtitle;
        document.getElementById('location-description').textContent=map.description;
        document.getElementById('location-eyebrow').textContent=map.interior?'RESIDENTIAL · SINGLE FLOOR':'URBAN AREA · RESIDENTIAL';
        document.getElementById('local-map-title').textContent=`${map.name.toUpperCase()} · ${map.width} × ${map.height}`;
        document.getElementById('map-camera-note').textContent=map.interior?'Single floor':'Scrolls as you move';
        if(map.interior) {
            const legend=document.getElementById('local-map-legend');legend.replaceChildren();
            for(const [name,color] of [['Door','#dfb777'],['Furniture','#907451'],...(map.id==='housing-office'?[['NPC','#9cd7ea']]:[])]) {
                const entry=document.createElement('span'),icon=document.createElement('i');icon.style.backgroundColor=color;
                entry.append(icon,document.createTextNode(name));legend.append(entry);
            }
        }
        const tileSize = 16, columns = local.width / tileSize;
        let rows = local.height / tileSize;
        const terrain = setup.worldMapArt.paint(map);
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
        function drawOpenDoors(ctx, scale = 1, offsetX = 0, offsetY = 0, sourceMap=map) {
            ctx.save();ctx.scale(scale, scale);ctx.translate(-offsetX * tileSize, -offsetY * tileSize);
            for (const object of sourceMap.interactables || []) {
                if (!setup.interactions.isOpen(object.id, sourceMap.id)) continue;
                const x = object.x * tileSize, y = object.y * tileSize;
                if (object.kind === 'door') {
                    ctx.fillStyle = '#889182';ctx.fillRect(x + 1, y + 1, 14, 14);
                    ctx.strokeStyle = '#dfb777';ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, 14, 14);
                } else if (object.kind === 'car') {
                    ctx.save();ctx.translate(x+tileSize,y+tileSize);ctx.rotate(setup.vehicles.angle(object));
                    ctx.fillStyle = '#dfb777';ctx.fillRect(-tileSize+1,-tileSize+12,4,10);ctx.restore();
                }
            }
            ctx.restore();
        }
        function draw() {
            const world = State.variables.world;
            const ctx = local.getContext('2d');ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, local.width, local.height);
            ctx.drawImage(terrain, camera.x * tileSize, camera.y * tileSize, local.width, local.height, 0, 0, local.width, local.height);
            drawOpenDoors(ctx, 1, camera.x, camera.y);
            local.dataset.hiddenCells=setup.rooms.mask(ctx,map,world,camera);
            const seated=setup.vehicleCabin.current(),position=seated?{x:seated.car.x+(seated.car.width||1)/2-.5,y:seated.car.y+(seated.car.height||1)/2-.5}:world;
            marker(ctx, (position.x - camera.x + .5) * tileSize, (position.y - camera.y + .5) * tileSize, 5);
            local.dataset.vehicleId=seated?.car.id||'';
            setup.worldAtlas.draw(overview);
            local.dataset.playerX = world.x;local.dataset.playerY = world.y;
            local.dataset.mapId = map.id;
            local.dataset.cameraX = camera.x;local.dataset.cameraY = camera.y;
            local.setAttribute('aria-label',seated?`${map.name} area map. You are inside ${seated.car.name}.`:`${map.name} area map. Your position: column ${world.x + 1}, row ${world.y + 1}.`);
        }
        function refresh(animate = false) {
            const world = State.variables.world, target = cameraTarget();
            const cabin=setup.vehicleCabin.current();
            document.getElementById('movement-position').textContent = cabin?'Parked · Engine off':`X ${world.x + 1} · Y ${world.y + 1}`;
            document.getElementById('position-description').textContent = cabin?`You are inside: ${cabin.car.name.toLowerCase()}.`:`You are at: ${map.tileAt(world.x, world.y).label.toLowerCase()}.`;
            setup.interactionUI.refresh();
            setup.rooms.refresh();
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
        let sprintToggle=false,shiftHeld=false;
        const sprintRequested=()=>sprintToggle||shiftHeld;
        function step(dx, dy) {
            if (Dialog.isOpen()) return false;
            const result = setup.worldMovement.move(dx, dy,sprintRequested());
            const status = document.getElementById('movement-status');
            const world = State.variables.world;
            const entrance = map.tileAt(world.x, world.y).kind === 'entrance';
            const feedback = result.collapsed||sprintRequested()&&result.moved&&!result.sprinted?result.reason:result.moved ? (entrance ? 'Press E to interact with the door.' : '') : result.reason;
            if (status.textContent !== feedback) status.textContent = feedback;
            refresh(result.moved);
            return result.moved;
        }
        const directions = {north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0]};
        const repeatDelay=()=>sprintRequested()&&setup.endurance.canSprint()?100:200;
        const heldInputs = new Map();
        let lastDirection = null, repeatTimer = 0;
        function stopHold() {
            clearTimeout(repeatTimer);
            repeatTimer = 0;lastDirection = null;shiftHeld=false;
            const previous = [...heldInputs.values()];heldInputs.clear();
            for (const input of previous) {
                if (input.button?.hasPointerCapture(input.key)) input.button.releasePointerCapture(input.key);
            }
        }
        function releaseInput(id) {
            const input = heldInputs.get(id);
            if (!input) return;
            heldInputs.delete(id);
            if (input.button?.hasPointerCapture(input.key)) input.button.releasePointerCapture(input.key);
            if (!heldInputs.size) stopHold();
        }
        function repeatStep() {
            repeatTimer = 0;
            if (!heldInputs.size || !local.isConnected || document.hidden || Dialog.isOpen()) {
                stopHold();return;
            }
            // Rotate through distinct directions, so W + Up counts as one
            // direction and adding a key never increases the overall pace.
            const active = [...new Set([...heldInputs.values()].map(input => input.direction))];
            lastDirection = active[(active.indexOf(lastDirection) + 1) % active.length];
            step(...directions[lastDirection]);
            if(heldInputs.size) repeatTimer = setTimeout(repeatStep, repeatDelay());
        }
        function startHold(direction, source, key, button = null) {
            const id = `${source}:${key}`;
            if (heldInputs.has(id)) return;
            const wasEmpty = heldInputs.size === 0;
            heldInputs.set(id, {direction, key, button});
            if (wasEmpty) {
                lastDirection = direction;step(...directions[direction]);
                if(heldInputs.size) repeatTimer = setTimeout(repeatStep, repeatDelay());
            }
        }
        for (const button of document.querySelectorAll('[data-move]')) {
            button.addEventListener('pointerdown', event => {
                if (event.button !== 0 || Dialog.isOpen()) return;
                event.preventDefault();button.focus({preventScroll: true});
                startHold(button.dataset.move, 'pointer', event.pointerId, button);
                if (heldInputs.has(`pointer:${event.pointerId}`)) button.setPointerCapture(event.pointerId);
            });
            function release(event) {
                releaseInput(`pointer:${event.pointerId}`);
            }
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
            button.addEventListener('contextmenu', event => event.preventDefault());
            // Keyboard/screen-reader activation still makes one step. Pointer
            // clicks are already handled on pointerdown, so never step twice.
            button.addEventListener('click', event => {if (event.detail === 0) step(...directions[button.dataset.move]);});
        }
        const keys = {ArrowUp: 'north', ArrowRight: 'east', ArrowDown: 'south', ArrowLeft: 'west', w: 'north', d: 'east', s: 'south', a: 'west'};
        function updatePace() {
            if(repeatTimer) {clearTimeout(repeatTimer);repeatTimer=setTimeout(repeatStep,repeatDelay());}
        }
        const sprintButton=document.getElementById('sprint-button');
        sprintButton.addEventListener('click',()=>{if(Dialog.isOpen()) return;sprintToggle=!sprintToggle;sprintButton.setAttribute('aria-pressed',String(sprintToggle));updatePace();});
        function keydown(event) {
            if (Dialog.isOpen() || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
            if(event.key==='Shift') {if(!shiftHeld) {shiftHeld=true;updatePace();}return;}
            shiftHeld=event.shiftKey;
            const direction = keys[event.key] || keys[event.key.toLowerCase()];
            if (!direction) return;
            event.preventDefault();
            const key = event.code || event.key.toLowerCase();
            if (!event.repeat) startHold(direction, 'keyboard', key);
        }
        function keyup(event) {
            if(event.key==='Shift') {shiftHeld=false;updatePace();return;}
            releaseInput(`keyboard:${event.code || event.key.toLowerCase()}`);
        }
        function visibilityChange() {if (document.hidden) stopHold();}
        document.addEventListener('keydown', keydown);
        document.addEventListener('keyup', keyup);
        document.addEventListener('visibilitychange', visibilityChange);
        window.addEventListener('blur', stopHold);
        $(document).on(':dialogopening.worldMovement', stopHold);
        $(document).on(':restcollapse.worldMovement', stopHold);
        $(document).on(':interactionchange.worldMovement', draw);
        function vehicleChange() {refresh();}
        $(document).on(':vehiclechange.worldMovement',vehicleChange);
        local.addEventListener('click', event => {
            if (Dialog.isOpen()) return;
            const rect = local.getBoundingClientRect(), world = State.variables.world;
            const x = Math.floor(camera.x + (event.clientX - rect.left) / rect.width * columns);
            const y = Math.floor(camera.y + (event.clientY - rect.top) / rect.height * rows);
            step(x - world.x, y - world.y);
        });
        function resizeLocal() {
            if(map.interior) return;
            const viewport=local.parentElement.getBoundingClientRect();
            if(!viewport.width||!viewport.height) return;
            const next=Math.max(10,Math.min(map.height,Math.floor(viewport.height*columns/viewport.width)));
            if(rows===next) return;
            rows=next;local.height=rows*tileSize;local.style.setProperty('--map-aspect',columns/rows);refresh();
        }
        const localResize=new ResizeObserver(resizeLocal);localResize.observe(local.parentElement);
        const atlasResize=new ResizeObserver(()=>setup.worldAtlas.draw(overview));atlasResize.observe(overview.parentElement);
        refresh();
        cleanup = () => {
            stopHold();cancelAnimationFrame(frame);atlasResize.disconnect();localResize.disconnect();
            document.removeEventListener('keydown', keydown);document.removeEventListener('keyup', keyup);
            document.removeEventListener('visibilitychange', visibilityChange);window.removeEventListener('blur', stopHold);
            $(document).off(':dialogopening.worldMovement', stopHold);
            $(document).off(':restcollapse.worldMovement', stopHold);
            $(document).off(':interactionchange.worldMovement', draw);
            $(document).off(':vehiclechange.worldMovement',vehicleChange);
        };
    });
})();
