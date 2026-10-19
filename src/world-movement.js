/* Position and elapsed game seconds are serialized. Only successful steps cost time. */
setup.worldMovement = (() => {
    function ensure() {
        const value = State.variables.world;
        const map = Object.values(setup.worldMaps).find(map => map.id === value?.mapId) || setup.worldMaps.apartments;
        const valid = value && map.tileAt(value.x, value.y).walkable;
        State.variables.world = {
            version: 2, mapId: map.id,
            x: valid ? value.x : map.spawn.x, y: valid ? value.y : map.spawn.y,
            elapsedSeconds: setup.gameClock.elapsed(value)
        };
        return State.variables.world;
    }
    function move(dx, dy) {
        const world = ensure(), map = setup.worldMaps[world.mapId];
        if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) + Math.abs(dy) !== 1) return {moved: false, reason: 'Choose one adjacent square.'};
        const target = map.tileAt(world.x + dx, world.y + dy);
        if (!target.walkable) return {moved: false, reason: target.kind === 'boundary' ? `You have reached the edge of ${map.name}.` : `${target.label} blocks the way.`};
        const door=map.interactables.find(object=>object.unitId&&object.x===world.x+dx&&object.y===world.y+dy);
        if(door && (!setup.housing.canEnter(door.unitId)||!setup.interactions.isOpen(door.id)))
            return {moved:false,reason:setup.housing.canEnter(door.unitId)?'The apartment door is closed. Press E to open it.':'This apartment is locked. Rent it at the housing office first.'};
        world.x += dx;world.y += dy;
        world.elapsedSeconds=Math.min(setup.gameClock.maxElapsedSeconds,world.elapsedSeconds+setup.gameClock.stepSeconds);
        setup.housing.collectDue();
        // Create a SugarCube moment without rebuilding the DOM. This also saves
        // the step to the browser session, so a reload retains the last move.
        State.create(State.passage);
        $(document).trigger(':timechange');
        return {moved: true, reason: `You move onto ${target.label.toLowerCase()}.`};
    }
    return {ensure, move};
})();
