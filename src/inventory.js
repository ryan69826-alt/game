/* Rectangular packing rules. Only serializable placements enter SugarCube saves. */
setup.inventory = (() => {
    const items = {
        water: {name: 'Water bottle', width: 1, height: 2, color: '#83c3d9'},
        tools: {name: 'Tool kit', width: 2, height: 2, color: '#d6aa70'},
        cloth: {name: 'Cleaning cloth', width: 1, height: 1, color: '#b4bfba'}
    };
    function ensure() {
        let inventory = State.variables.inventory;
        if (!inventory || inventory.version !== 1 || !inventory.containers || typeof inventory.containers !== 'object' || Array.isArray(inventory.containers)) {
            inventory = State.variables.inventory = {version: 1, containers: {}};
        }
        for (const slot of setup.clothing.slots) {
            const definition = setup.clothing.definitions[slot];
            if (State.variables.character.clothing[slot] && definition.columns) {
                const key = `worn:${slot}`;
                if (!Object.hasOwn(inventory.containers, key)) inventory.containers[key] = [];
            }
        }
        return inventory;
    }
    function worn() {
        ensure();
        return setup.clothing.slots.filter(slot => State.variables.character.clothing[slot] && setup.clothing.definitions[slot].columns)
            .map(slot => ({id: `worn:${slot}`, name: `${setup.clothing.definitions[slot].name}${slot === 'backpack' ? '' : ' pockets'}`,
                columns: setup.clothing.definitions[slot].columns, rows: setup.clothing.definitions[slot].rows}));
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
        }
        // Opening an empty trunk never restocks it.
        State.create(State.passage);
        return container;
    }
    function placements(container) {
        return ensure().containers[container.id] || [];
    }
    function fits(container, item, x, y, ignoreId) {
        const definition = items[item.type];
        if (!definition || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
            x + definition.width > container.columns || y + definition.height > container.rows) return false;
        return !placements(container).some(other => {
            if (other.id === ignoreId) return false;
            const size = items[other.type];
            return size && x < other.x + size.width && x + definition.width > other.x &&
                y < other.y + size.height && y + definition.height > other.y;
        });
    }
    function transfer(fromId, toId, itemId, x, y, trunkId) {
        const accessible = worn();
        if (trunkId) {
            const rear = trunk(trunkId);
            if (!rear) return {ok: false, message: 'Stand behind the car to access its trunk.'};
            accessible.push(rear);
        }
        const from = accessible.find(container => container.id === fromId), to = accessible.find(container => container.id === toId);
        if (!from || !to) return {ok: false, message: 'That storage is not accessible.'};
        const item = placements(from).find(item => item.id === itemId);
        if (!item) return {ok: false, message: 'That item is no longer here.'};
        if (!fits(to, item, x, y, fromId === toId ? itemId : null)) return {ok: false, message: 'Not enough adjoining free blocks at that square.'};
        const state = ensure();
        state.containers[fromId] = placements(from).filter(other => other.id !== itemId);
        state.containers[toId] = [...(state.containers[toId] || []), {...item, x, y}];
        State.create(State.passage);
        return {ok: true, message: `${items[item.type].name} moved to ${to.name.toLowerCase()}.`};
    }
    return {items, ensure, worn, trunk, openTrunk, placements, fits, transfer};
})();
