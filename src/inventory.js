/* Rectangular packing rules. Only serializable placements enter SugarCube saves. */
setup.inventory = (() => {
    const items = {
        water: {name: 'Water bottle', width: 1, height: 2, color: '#83c3d9'},
        tools: {name: 'Tool kit', width: 2, height: 2, color: '#d6aa70'},
        cloth: {name: 'Cleaning cloth', width: 1, height: 1, color: '#b4bfba'},
        apartmentKey:{name:'Apartment key',width:1,height:1,color:'#d6bc78'},
        coffee:{name:'Canned coffee',width:1,height:1,color:'#b78a63'}
    };
    function fitsItems(container, item, x, y, placements, ignoreId) {
        const size = items[item.type];
        if (!size || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
            x + size.width > container.columns || y + size.height > container.rows) return false;
        return !placements.some(other => {
            if (other.id === ignoreId) return false;
            const otherSize = items[other.type];
            return otherSize && x < other.x + otherSize.width && x + size.width > other.x &&
                y < other.y + otherSize.height && y + size.height > other.y;
        });
    }
    function firstFit(container, item, placements) {
        for (let y = 0; y < container.rows; y++) for (let x = 0; x < container.columns; x++) {
            if (fitsItems(container, item, x, y, placements)) return {...item, x, y};
        }
        return null;
    }
    function migrate(old) {
        const containers = Object.fromEntries(Object.entries(old.containers).map(([id,list]) => [id,list.map(item => ({...item}))]));
        const worn = setup.clothing.storage(State.variables.character);
        const carried = Object.entries(containers).filter(([id]) => id.startsWith('worn:')).flatMap(([,list]) => list);
        for (const id of Object.keys(containers)) if (id.startsWith('worn:')) delete containers[id];
        for (const pocket of worn) containers[pocket.id] = [];
        const notices = [];
        for (const item of carried) {
            let placed = false;
            for (const pocket of worn) {
                const fit = firstFit(pocket,item,containers[pocket.id]);
                if (fit) {containers[pocket.id].push(fit);placed = true;break;}
            }
            if (placed) continue;
            // Old items originated in trunks. Return overflow to reachable world
            // containers rather than retaining an invisible legacy carrying bag.
            const trunks = Object.keys(containers).filter(id => id.startsWith('trunk:'));
            const source = item.id.slice(0,item.id.lastIndexOf(':'));
            trunks.sort((a,b) => Number(b === source)-Number(a === source));
            for (const id of trunks) {
                const container = {columns:6,rows:4}, fit = firstFit(container,item,containers[id]);
                if (!fit) continue;
                containers[id].push(fit);notices.push(`${items[item.type].name} → ${id.replace('trunk:apartments:parked-car-','Parked car ')} trunk`);
                placed = true;break;
            }
            if (!placed) {
                // Compact an existing trunk if old placements fragmented its space.
                for (const id of trunks) {
                    const packed = [], list = [...containers[id],item].sort((a,b) => items[b.type].width*items[b.type].height-items[a.type].width*items[a.type].height);
                    for (const entry of list) {
                        const fit = firstFit({columns:6,rows:4},entry,packed);
                        if (!fit) break;
                        packed.push(fit);
                    }
                    if (packed.length !== list.length) continue;
                    containers[id] = packed;notices.push(`${items[item.type].name} → ${id.replace('trunk:apartments:parked-car-','Parked car ')} trunk`);placed = true;break;
                }
            }
            if (!placed) throw new Error('Pocket migration could not preserve all items. The original save is unchanged.');
        }
        return {version:2,containers,notices};
    }
    function ensure() {
        let inventory = State.variables.inventory;
        if (inventory?.version === 1) inventory = State.variables.inventory = migrate(inventory);
        if (!inventory) inventory = State.variables.inventory = {version:2,containers:{},notices:[]};
        for (const pocket of setup.clothing.storage(State.variables.character)) {
            if (!Object.hasOwn(inventory.containers,pocket.id)) inventory.containers[pocket.id] = [];
        }
        return inventory;
    }
    function worn() {
        ensure();return setup.clothing.storage(State.variables.character);
    }
    function trunk(objectId) {
        const world = State.variables.world;
        const object = setup.worldMaps[world?.mapId]?.interactables.find(object => object.id === objectId && object.kind === 'car');
        if (!object || !setup.interactions.actionsFor(object).some(action => action.id === 'trunk')) return null;
        return {id: `trunk:${world.mapId}:${object.id}`, name: `${object.name} trunk`, columns: 6, rows: 4};
    }
    function openTrunk(objectId) {
        const container = trunk(objectId);
        if (!container) return null;
        const state = ensure();
        if (!Object.hasOwn(state.containers, container.id)) {
            state.containers[container.id] = [
                {id: `${container.id}:water`, type: 'water', x: 0, y: 0},
                {id: `${container.id}:tools`, type: 'tools', x: 2, y: 0},
                {id: `${container.id}:cloth`, type: 'cloth', x: 5, y: 3}
            ];
            if(objectId==='parked-car-2') state.containers[container.id].push({id:`${container.id}:coffee`,type:'coffee',x:5,y:0});
        }
        // Opening an empty trunk never restocks it.
        State.create(State.passage);
        return container;
    }
    const external=objectId=>objectId==='housing-counter'?setup.housing.counter():trunk(objectId);
    function openExternal(objectId) {
        if(objectId!=='housing-counter') return openTrunk(objectId);
        const container=external(objectId);if(!container) return null;
        ensure().containers[container.id] ||= [];State.create(State.passage);return container;
    }
    function placements(container) {
        return ensure().containers[container.id] || [];
    }
    function fits(container, item, x, y, ignoreId) {
        return fitsItems(container,item,x,y,placements(container),ignoreId);
    }
    function transfer(fromId, toId, itemId, x, y, trunkId) {
        const accessible = worn();
        if (trunkId) {
            const rear = external(trunkId);
            if (!rear) return {ok: false, message: 'That storage is out of reach. Return to the car trunk or receptionist.'};
            accessible.push(rear);
        }
        const from = accessible.find(container => container.id === fromId), to = accessible.find(container => container.id === toId);
        if (!from || !to) return {ok: false, message: 'That storage is not accessible.'};
        const item = placements(from).find(item => item.id === itemId);
        if (!item) return {ok: false, message: 'That item is no longer here.'};
        if(toId===setup.housing.trayId&&item.type!=='apartmentKey') return {ok:false,message:'The receptionist tray is only for apartment keys.'};
        if (!fits(to, item, x, y, fromId === toId ? itemId : null)) return {ok: false, message: 'Not enough adjoining free blocks at that square.'};
        const state = ensure();
        state.containers[fromId] = placements(from).filter(other => other.id !== itemId);
        state.containers[toId] = [...(state.containers[toId] || []), {...item, x, y}];
        State.create(State.passage);
        return {ok: true, message: `${items[item.type].name} moved to ${to.name.toLowerCase()}.`};
    }
    function consume(containerId,itemId) {
        const container=worn().find(container=>container.id===containerId);
        const item=container&&placements(container).find(item=>item.id===itemId&&item.type==='coffee');
        if(!item) return {ok:false,message:'Carry the coffee in your pockets or bag before drinking it.'};
        ensure().containers[container.id]=placements(container).filter(entry=>entry.id!==itemId);
        setup.rest.changeTiredness(-10);
        return {ok:true,message:'You drink the coffee. Tiredness decreases by 10; your awake-time schedule is unchanged.'};
    }
    return {items, ensure, worn, trunk, openTrunk, external,openExternal,placements, fits, transfer,consume};
})();
