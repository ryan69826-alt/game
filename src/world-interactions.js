/* Object definitions and action handlers are separate from movement/save data.
 * Ground items and NPCs can use the same rectangular reach test and supply their
 * own actions. This feature adds no inventory, interiors, or NPC simulation.
 */
setup.interactions = (() => {
    const inspect = {id: 'inspect', label: 'Inspect', result: object => object.description || `You examine ${object.name.toLowerCase()}.`};
    function isOpen(objectId, mapId = State.variables.world?.mapId) {
        return State.variables.openedObjects?.[`${mapId}:${objectId}`] === true;
    }
    function openDoor(object) {
        const stored = State.variables.openedObjects;
        State.variables.openedObjects = {...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}),
            [`${State.variables.world.mapId}:${object.id}`]: true};
        State.create(State.passage);
        $(document).trigger(':interactionchange');
        return 'You open the door.';
    }
    const open = {id: 'open', label: 'Open', enabled: object => !isOpen(object.id), result: openDoor};
    const types = {
        door: [{id: 'knock', label: 'Knock', result: 'You knock on the door.'}, open],
        car: [{id: 'look-inside', label: 'Look through window', result: 'You look through the window. No one is inside.'}, {...open, label: 'Open door'}],
        ground: [inspect], npc: [inspect]
    };
    function nearby(world = State.variables.world) {
        const map = setup.worldMaps[world?.mapId];
        if (!map) return [];
        return (map.interactables || []).map(object => {
            const dx = Math.max(object.x - world.x, 0, world.x - (object.x + (object.width || 1) - 1));
            const dy = Math.max(object.y - world.y, 0, world.y - (object.y + (object.height || 1) - 1));
            return {object, distance: dx + dy};
        }).filter(target => target.distance <= 1)
            .sort((a, b) => a.distance - b.distance || a.object.name.localeCompare(b.object.name));
    }
    function actionsFor(object) {
        return object.actions || (Object.hasOwn(types, object.kind) ? types[object.kind] : [inspect]);
    }
    function run(objectId, actionId) {
        // Revalidate proximity on every action, even if an object later moves.
        const target = nearby().find(target => target.object.id === objectId);
        if (!target) return {ok: false, message: 'That object is no longer within reach.'};
        const action = actionsFor(target.object).find(action => action.id === actionId);
        if (!action) return {ok: false, message: 'That interaction is not available.'};
        if (action.enabled && !action.enabled(target.object)) return {ok: false, message: 'The door is already open.'};
        const message = typeof action.result === 'function' ? action.result(target.object) : action.result;
        return {ok: true, message};
    }
    return {nearby, actionsFor, run, isOpen};
})();
