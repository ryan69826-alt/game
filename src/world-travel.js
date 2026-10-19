/* Portals retain the same compass orientation as the outdoor building. */
setup.worldTravel = (() => {
    function enter(object) {
        const destination=object.destination,map=setup.worldMaps[destination?.mapId];
        if(!map || !map.tileAt(destination.x,destination.y).walkable) return {ok:false,message:'This entrance is unavailable.'};
        const world=setup.worldMovement.ensure();
        State.variables.world={...world,...destination};
        Dialog.close();Engine.play('Apartments');
        return {message:`You enter ${map.name}.`,travelled:true};
    }
    function edge(world,dx,dy) {
        const source=setup.worldMaps[world.mapId];
        const direction=dx===-1&&world.x===0?'west':dx===1&&world.x===source.width-1?'east':dy===-1&&world.y===0?'north':dy===1&&world.y===source.height-1?'south':null;
        const destination=setup.worldMaps[source.exits?.[direction]];
        if(!destination) return null;
        const x=direction==='west'?destination.width-1:direction==='east'?0:Math.round(world.x*(destination.width-1)/Math.max(1,source.width-1));
        const y=direction==='north'?destination.height-1:direction==='south'?0:Math.round(world.y*(destination.height-1)/Math.max(1,source.height-1));
        return destination.tileAt(x,y).walkable?{mapId:destination.id,x,y}:null;
    }
    return {enter,edge};
})();
