/* Only position and successful movement turns are serialized. */
setup.worldMovement = (() => {
    function ensure() {
        const value = State.variables.world;
        const map = Object.values(setup.worldMaps).find(map => map.id === value?.mapId) || setup.worldMaps.apartments;
        const valid = value && map.tileAt(value.x, value.y).walkable;
        State.variables.world = {
            version: 1, mapId: map.id,
            x: valid ? value.x : map.spawn.x, y: valid ? value.y : map.spawn.y,
            turn: Number.isSafeInteger(value?.turn) && value.turn >= 0 ? value.turn : 0
        };
        return State.variables.world;
    }
    function move(dx, dy) {
        const world = ensure(), map = setup.worldMaps[world.mapId];
        if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return {moved: false, reason: 'Choose one adjacent square.'};
        const target = map.tileAt(world.x + dx, world.y + dy);
        if (!target.walkable) return {moved: false, reason: target.kind === 'boundary' ? 'You have reached the edge of Apartments.' : `${target.label} blocks the way.`};
        world.x += dx;world.y += dy;world.turn = Math.min(Number.MAX_SAFE_INTEGER, world.turn + 1);
        // Create a SugarCube moment without rebuilding the DOM. This also saves
        // the step to the browser session, so a reload retains the last move.
        State.create(State.passage);
        return {moved: true, reason: target.kind === 'entrance' ? `${target.label}. Interiors are not available yet.` : `You move onto ${target.label.toLowerCase()}.`};
    }
    return {ensure, move};
})();
