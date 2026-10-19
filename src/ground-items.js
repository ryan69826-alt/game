/* A pile belongs to a map tile. Empty piles leave no marker or carrying space. */
setup.groundItems=(()=>{
    function current() {
        const world=State.variables.world;
        if(!State.variables.worldStarted||!world) return null;
        const seated=setup.vehicleCabin.current();
        if(seated) return setup.vehicleCabin.container(seated.car.id);
        return {id:`ground:${world.mapId}:${world.x}:${world.y}`,name:'Ground at your feet',columns:8,rows:8};
    }
    function objects(mapId) {
        return Object.entries(State.variables.inventory?.containers||{}).flatMap(([id,items])=>{
            const match=/^ground:([^:]+):(\d+):(\d+)$/.exec(id);
            if(!match||match[1]!==mapId||!items.length) return [];
            return [{id,kind:'ground',name:'Items on the ground',x:Number(match[2]),y:Number(match[3]),
                actions:[{id:'items',label:'View items',result:()=>({externalId:id})}]}];
        });
    }
    function container(id) {
        if(setup.vehicleCabin.current()) return null;
        const world=State.variables.world,match=/^ground:([^:]+):(\d+):(\d+)$/.exec(id||'');
        if(!world||!match||match[1]!==world.mapId) return null;
        const object={x:Number(match[2]),y:Number(match[3])},map=setup.worldMaps[world.mapId];
        if(!map.tileAt(object.x,object.y).walkable||Math.abs(object.x-world.x)+Math.abs(object.y-world.y)>1||!setup.rooms.cellVisible(map,object.x,object.y,world)) return null;
        return {id,name:'Items on the ground',columns:8,rows:8};
    }
    return {current,objects,container};
})();
