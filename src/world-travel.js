/* Portals retain the same compass orientation as the outdoor building. */
setup.worldTravel = (() => {
    function enter(object) {
        const destination=object.destination,map=setup.worldMaps[destination?.mapId];
        if(!map || !map.tileAt(destination.x,destination.y).walkable) return {ok:false,message:'This entrance is unavailable.'};
        const world=setup.worldMovement.ensure();
        State.variables.world={...world,...destination,turn:Math.min(Number.MAX_SAFE_INTEGER,world.turn+1)};
        Dialog.close();Engine.play('Apartments');
        return {message:`You enter ${map.name}.`,travelled:true};
    }
    return {enter};
})();
