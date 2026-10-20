/* Click/keyboard block placement; the map remains visible behind this dialog. */
setup.inventoryUI = (() => {
    function open(externalId) {
        if (!State.variables.worldStarted || !document.querySelector('.world-sidebar')) return;
        const seated=setup.vehicleCabin.current();
        if(!externalId&&seated) externalId=`cabin:${seated.car.id}`;
        const inventory = setup.inventory;
        if (externalId && !inventory.openExternal(externalId)) return;
        inventory.ensure();
        Dialog.setup(externalId==='storage-kiosk'?'Kiosk keys & inventory':externalId?.startsWith('ground:')?'Ground & inventory':externalId?.startsWith('storage:')?'Storage unit & inventory':externalId==='housing-counter'?'Key handover & inventory':externalId?.startsWith('cabin:')?'Cabin & inventory':externalId?'Trunk & inventory':'Inventory', 'character-window inventory-window');
        const root = Dialog.body();
        let selected = null, message = 'Drag an item to a free space. You can also select an item and then a destination square. Items cannot overlap or rotate.';
        const drag = setup.inventoryDrag.mount(root,externalId,result => {message=result.message;if(result.ok) selected=null;render();});
        function render() {
            root.replaceChildren();
            const status = document.createElement('p');status.id = 'inventory-status';status.className = 'world-note';
            status.setAttribute('role', 'status');status.textContent = message;root.append(status);
            const equipment=document.createElement('section');equipment.className='equipment-panel';
            const equipmentTitle=document.createElement('h2');equipmentTitle.textContent='Equipped clothing';equipment.append(equipmentTitle);
            const slots=document.createElement('div');slots.className='equipment-slots';equipment.append(slots);
            for(const slot of setup.clothing.slots) {
                const box=document.createElement('div');box.className='equipment-slot';box.dataset.equipSlot=slot;
                const label=document.createElement('strong');label.textContent=setup.clothing.labels[slot];box.append(label);
                const item=setup.equipment.preview(slot);
                if(item) {
                    const source=document.createElement('div');source.dataset.container=`equipped:${slot}`;
                    const control=document.createElement('button');control.type='button';control.className='inventory-item';control.dataset.item=item.id;
                    control.textContent=inventory.items[item.type].name;control.setAttribute('aria-label',`Equipped ${inventory.items[item.type].name}`);
                    control.addEventListener('click',()=>{if(drag.ignoreClick()) return;selected={container:`equipped:${slot}`,id:item.id};message='Choose a storage square, or Drop on ground. Pocket contents stay inside this garment.';render();});
                    source.append(control);box.append(source);
                } else {const empty=document.createElement('span');empty.textContent='Empty · drop clothing here';box.append(empty);}
                slots.append(box);
            }
            const drop=document.createElement('button');drop.type='button';drop.dataset.groundDrop='true';drop.className='ground-drop';
            drop.textContent=setup.vehicleCabin.current()?'Drop to cabin floor':'Drop on ground';
            drop.addEventListener('click',()=>{if(drag.ignoreClick()) return;if(!selected){message='Select or drag an item or equipped garment first.';render();return;}const result=setup.equipment.drop(selected.container,selected.id,externalId);message=result.message;if(result.ok)selected=null;render();});
            equipment.append(drop);root.append(equipment);
            const source=selected&&!selected.container.startsWith('equipped:')&&inventory.accessible(externalId)?.find(container=>container.id===selected.container);
            const garment=source&&inventory.placements(source).find(item=>item.id===selected.id&&setup.equipment.slotFor(item.type));
            if(garment) {
                const wear=document.createElement('button');wear.type='button';wear.textContent=`Wear ${inventory.items[garment.type].name.toLowerCase()}`;
                wear.addEventListener('click',()=>{const result=setup.equipment.equip(selected.container,selected.id,externalId);message=result.message;if(result.ok)selected=null;render();});root.append(wear);
            }
            const consumable=selected&&inventory.worn().find(container=>container.id===selected.container);
            if(consumable&&inventory.placements(consumable).some(item=>item.id===selected.id&&item.type==='coffee')) {
                const use=document.createElement('button');use.type='button';use.textContent='Drink coffee';
                use.addEventListener('click',()=>{const result=inventory.consume(selected.container,selected.id);message=result.message;if(result.ok) selected=null;render();});root.append(use);
            }
            if(inventory.ensure().notices?.length) {
                const notice=document.createElement('p');notice.className='world-note inventory-migration';
                notice.textContent='Pocket layout updated. Items that no longer fit were returned to trunks: '+inventory.ensure().notices.join('; ');root.append(notice);
            }
            const layout = document.createElement('div');layout.className = 'inventory-layout';root.append(layout);
            function drawContainer(container, parent) {
                const section = document.createElement('section');section.className = 'inventory-container';section.dataset.container = container.id;
                const title = document.createElement('h3');title.textContent = container.id.startsWith('worn:pants:') ? container.name.replace('Pants · ','').replace(' pocket','') : container.name;
                const placements = inventory.placements(container);
                const used = placements.reduce((sum, item) => sum + inventory.items[item.type].width * inventory.items[item.type].height, 0);
                const count = document.createElement('p');count.className = 'storage-count';count.textContent = container.columns===1 && container.rows===1 ? `${used}/1` : `${used} / ${container.columns * container.rows} blocks`;count.title=`${used} of ${container.columns*container.rows} blocks used`;
                const grid = document.createElement('div');grid.className = 'inventory-grid';grid.dataset.storageId=container.id;grid.dataset.columns=container.columns;grid.dataset.rows=container.rows;grid.style.setProperty('--columns', container.columns);
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
                        if(drag.ignoreClick()) return;
                        if (!selected) {message = 'Select an item first.';status.textContent = message;return;}
                        const result = setup.equipment.move(selected.container, container.id, selected.id, x, y, externalId);
                        message = result.message;if (result.ok) selected = null;
                        render();root.querySelector('.inventory-grid button')?.focus();
                    });grid.append(cell);
                }
                for (const item of placements) {
                    const definition = inventory.items[item.type], button = document.createElement('button');button.type = 'button';
                    button.className = 'inventory-item';button.dataset.item = item.id;
                    button.style.gridColumn = `${item.x + 1} / span ${definition.width}`;button.style.gridRow = `${item.y + 1} / span ${definition.height}`;
                    button.style.setProperty('--item-color', definition.color);
                    button.textContent = item.type==='storageKey'?`S${item.id.split(':').at(-1)}`:{water:'Water',tools:'Tools',cloth:'Cloth',apartmentKey:'Key',storageKey:'Key',coffee:'Coffee'}[item.type] || definition.name;button.title=item.type==='apartmentKey'?`Key for ${setup.housing.units().find(unit=>unit.id===setup.layoutMigration.unitId(item.id.split(':').at(-1)))?.name||item.id.split(':').at(-1)}`:item.type==='storageKey'?`Key for storage unit ${item.id.split(':').at(-1)}`:definition.name;button.setAttribute('aria-label', `${item.type==='storageKey'?`Storage unit ${item.id.split(':').at(-1)} key`:definition.name}, ${definition.width} by ${definition.height} blocks, ${container.name}`);
                    if(item.pockets) button.title+=` · Pocket contents: ${Object.values(item.pockets).reduce((sum,list)=>sum+list.length,0)} item(s)`;
                    button.setAttribute('aria-pressed', String(selected?.id === item.id));
                    button.addEventListener('click', () => {
                        if(drag.ignoreClick()) return;
                        selected = selected?.id === item.id ? null : {container: container.id, id: item.id};
                        message = selected ? `${definition.name} selected (${definition.width} × ${definition.height}). Choose a destination square.` : 'Selection cleared.';
                        render();Array.from(root.querySelectorAll('[data-item]')).find(node => node.dataset.item === item.id)?.focus();
                    });grid.append(button);
                }
                section.append(title, count, grid);parent.append(section);
            }
            if (externalId) {
                const column = document.createElement('div');column.className = 'inventory-column';layout.append(column);
                const container = inventory.external(externalId);
                if(container) {
                    if(externalId.startsWith('cabin:')) {
                        const cabin=setup.vehicleCabin.current(),contents=setup.vehicleContents.ensure(cabin.car);
                        const cash=document.createElement('p');cash.className='world-note';cash.textContent=`Cash on the seat: ${setup.playerState.formatMoney(contents.money)}`;column.append(cash);
                        if(contents.money) {
                            const take=document.createElement('button');take.type='button';take.textContent=`Take ${setup.playerState.formatMoney(contents.money)}`;
                            take.addEventListener('click',()=>{message=setup.vehicleContents.take(cabin.car.id).message;render();});column.append(take);
                        }
                    }
                    drawContainer(container,column);
                }
            }
            const player = document.createElement('div');player.className = 'inventory-column';layout.append(player);
            const heading = document.createElement('h2');heading.textContent = 'Worn storage';player.append(heading);
            const equipped = document.createElement('p');equipped.className = 'world-note';
            equipped.textContent = 'Wearing: ' + setup.clothing.summary(State.variables.character);player.append(equipped);
            const worn = inventory.worn();
            for (const container of worn.filter(container=>!container.id.startsWith('worn:pants:'))) {
                if(container.id==='worn:backpack') continue;
                drawContainer(container,player);
            }
            const pockets=worn.filter(container=>container.id.startsWith('worn:pants:'));
            if(pockets.length) {
                const title=document.createElement('h3');title.className='pockets-heading';title.textContent='Pants pockets';
                const group=document.createElement('div');group.className='pocket-group';player.append(title,group);
                for(const pocket of pockets) drawContainer(pocket,group);
            }
            for(const container of worn.filter(container=>container.id==='worn:backpack')) drawContainer(container,player);
            const ground=setup.groundItems.current();
            if(ground&&ground.id!==inventory.external(externalId)?.id&&inventory.placements(ground).length) drawContainer(ground,player);
            if (!worn.length) {
                const empty = document.createElement('p');empty.className = 'world-note';empty.textContent = 'No carrying space. You have no pockets or bags equipped.';player.append(empty);
            }
        }
        render();Dialog.open();
    }
    return {open};
})();
