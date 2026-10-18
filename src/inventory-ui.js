/* Click/keyboard block placement; the map remains visible behind this dialog. */
setup.inventoryUI = (() => {
    function open(trunkId) {
        if (!State.variables.worldStarted || !document.querySelector('.world-sidebar')) return;
        const inventory = setup.inventory;
        if (trunkId && !inventory.openTrunk(trunkId)) return;
        inventory.ensure();
        Dialog.setup(trunkId ? 'Trunk & inventory' : 'Inventory', 'character-window inventory-window');
        const root = Dialog.body();
        let selected = null, message = 'Select an item, then choose a free square in its destination. Items cannot overlap or rotate.';
        function render() {
            root.replaceChildren();
            const status = document.createElement('p');status.id = 'inventory-status';status.className = 'world-note';
            status.setAttribute('role', 'status');status.textContent = message;root.append(status);
            const layout = document.createElement('div');layout.className = 'inventory-layout';root.append(layout);
            function drawContainer(container, parent) {
                const section = document.createElement('section');section.className = 'inventory-container';section.dataset.container = container.id;
                const title = document.createElement('h3');title.textContent = container.name;
                const placements = inventory.placements(container);
                const used = placements.reduce((sum, item) => sum + inventory.items[item.type].width * inventory.items[item.type].height, 0);
                const count = document.createElement('p');count.className = 'storage-count';count.textContent = `${used} / ${container.columns * container.rows} blocks`;
                const grid = document.createElement('div');grid.className = 'inventory-grid';grid.style.setProperty('--columns', container.columns);
                grid.setAttribute('role', 'group');grid.setAttribute('aria-label', container.name);
                for (let y = 0; y < container.rows; y++) for (let x = 0; x < container.columns; x++) {
                    if (placements.some(item => {
                        const size = inventory.items[item.type];
                        return x >= item.x && x < item.x + size.width && y >= item.y && y < item.y + size.height;
                    })) continue;
                    const cell = document.createElement('button');cell.type = 'button';cell.className = 'inventory-cell';
                    cell.style.gridColumn = x + 1;cell.style.gridRow = y + 1;cell.dataset.x = x;cell.dataset.y = y;
                    cell.setAttribute('aria-label', `Empty block ${x + 1}, ${y + 1} in ${container.name}`);
                    cell.textContent = '·';
                    cell.addEventListener('click', () => {
                        if (!selected) {message = 'Select an item first.';status.textContent = message;return;}
                        const result = inventory.transfer(selected.container, container.id, selected.id, x, y, trunkId);
                        message = result.message;if (result.ok) selected = null;
                        render();root.querySelector('.inventory-grid button')?.focus();
                    });grid.append(cell);
                }
                for (const item of placements) {
                    const definition = inventory.items[item.type], button = document.createElement('button');button.type = 'button';
                    button.className = 'inventory-item';button.dataset.item = item.id;
                    button.style.gridColumn = `${item.x + 1} / span ${definition.width}`;button.style.gridRow = `${item.y + 1} / span ${definition.height}`;
                    button.style.setProperty('--item-color', definition.color);
                    button.textContent = definition.name;button.setAttribute('aria-label', `${definition.name}, ${definition.width} by ${definition.height} blocks, ${container.name}`);
                    button.setAttribute('aria-pressed', String(selected?.id === item.id));
                    button.addEventListener('click', () => {
                        selected = selected?.id === item.id ? null : {container: container.id, id: item.id};
                        message = selected ? `${definition.name} selected (${definition.width} × ${definition.height}). Choose a destination square.` : 'Selection cleared.';
                        render();Array.from(root.querySelectorAll('[data-item]')).find(node => node.dataset.item === item.id)?.focus();
                    });grid.append(button);
                }
                section.append(title, count, grid);parent.append(section);
            }
            if (trunkId) {
                const column = document.createElement('div');column.className = 'inventory-column';layout.append(column);
                const container = inventory.trunk(trunkId);
                if (container) drawContainer(container, column);
            }
            const player = document.createElement('div');player.className = 'inventory-column';layout.append(player);
            const heading = document.createElement('h2');heading.textContent = 'Worn storage';player.append(heading);
            const equipped = document.createElement('p');equipped.className = 'world-note';
            equipped.textContent = 'Wearing: ' + (setup.clothing.slots.filter(slot => State.variables.character.clothing[slot]).map(slot => setup.clothing.definitions[slot].name).join(', ') || 'underwear only');player.append(equipped);
            const worn = inventory.worn();
            for (const container of worn) drawContainer(container, player);
            if (!worn.length) {
                const empty = document.createElement('p');empty.className = 'world-note';empty.textContent = 'No carrying space. You have no pockets or bags equipped.';player.append(empty);
            }
        }
        render();Dialog.open();
    }
    return {open};
})();
