/* One orientation model drives map sprites and side/rear interaction access. */
setup.vehicles = (() => {
    const headings = ['north','east','south','west'];
    const facing = object => headings.includes(object.facing) ? object.facing : 'north';
    const angle = object => headings.indexOf(facing(object))*Math.PI/2;
    function edge(object, position) {
        if(!position) return null;
        const w=object.width || 1,h=object.height || 1;
        let side=null;
        if(position.x>=object.x && position.x<object.x+w) {
            if(position.y===object.y-1) side='north';
            if(position.y===object.y+h) side='south';
        }
        if(position.y>=object.y && position.y<object.y+h) {
            if(position.x===object.x-1) side='west';
            if(position.x===object.x+w) side='east';
        }
        if(!side) return null;
        const direction=headings.indexOf(facing(object));
        return side===headings[direction]?'front':side===headings[(direction+2)%4]?'rear':'side';
    }
    const vehicleId=object=>object.vehicleId||object.id;
    const isOwned=(object,mapId=State.variables.world?.mapId)=>object.ownedByPlayer===true||
        (Array.isArray(State.variables.ownedVehicles)&&State.variables.ownedVehicles.includes(`${mapId}:${vehicleId(object)}`));
    const hasKey=object=>isOwned(object)||setup.inventory.worn().some(container=>setup.inventory.placements(container).some(item=>
        item.type==='vehicleKey'&&item.id===`vehicle-key:${State.variables.world.mapId}:${vehicleId(object)}`));
    const trunk=car=>({...car,id:`${car.id}:trunk`,vehicleId:car.id,kind:'car-trunk',name:`${car.name} trunk`,
        lockId:`${car.lockId||`${State.variables.world?.mapId||'apartments'}:${car.id}`}:trunk`,lockLevel:car.trunkLockLevel||2,locked:car.trunkLocked});
    return {facing,angle,edge,isOwned,hasKey,trunk};
})();
