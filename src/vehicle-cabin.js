/* Seating uses an exterior anchor; it never grants access to the trunk. */
setup.vehicleCabin = (() => {
    function current() {
        const seat=State.variables.vehicleSeat,world=State.variables.world;
        if(!seat) return null;
        const map=setup.worldMaps[seat.mapId],car=map?.interactables.find(object=>object.id===seat.vehicleId&&object.kind==='car');
        if(!car||world?.mapId!==seat.mapId||world.x!==seat.x||world.y!==seat.y||setup.vehicles.edge(car,world)!=='side') {
            delete State.variables.vehicleSeat;return null;
        }
        return {car,map,seat};
    }
    function changed() {
        State.create(State.passage);$(document).trigger(':vehiclechange');
    }
    function enter(objectId) {
        if(current()) return {ok:false,message:'You are already inside a vehicle.'};
        const world=State.variables.world,car=setup.worldMaps[world?.mapId]?.interactables.find(object=>object.id===objectId&&object.kind==='car');
        if(!car||setup.vehicles.edge(car,world)!=='side'||!setup.interactions.isOpen(car.id)) return {ok:false,message:'Open a car door and stand beside it before getting in.'};
        State.variables.vehicleSeat={version:1,mapId:world.mapId,vehicleId:car.id,x:world.x,y:world.y};
        setup.vehicleContents.ensure(car);changed();
        return {ok:true,vehicleChanged:true,message:`You get into ${car.name.toLowerCase()}. The engine is off. Hotwiring is not available yet.`};
    }
    function leave() {
        const cabin=current();if(!cabin) return {ok:false,message:'You are not inside a vehicle.'};
        const {car,map,seat}=cabin;
        if(!map.tileAt(seat.x,seat.y).walkable) return {ok:false,message:'The way out is blocked.'};
        if(setup.doorLocks.isLocked(car)) setup.interactions.run(car.id,'unlock');
        if(!setup.interactions.isOpen(car.id)) setup.interactions.run(car.id,'open');
        delete State.variables.vehicleSeat;changed();
        return {ok:true,vehicleChanged:true,message:`You get out of ${car.name.toLowerCase()}.`};
    }
    function container(objectId) {
        const cabin=current();if(!cabin||cabin.car.id!==objectId) return null;
        return {id:`cabin:${cabin.map.id}:${objectId}`,name:`${cabin.car.name} cabin`,columns:4,rows:3};
    }
    function actions(car) {
        const contents=setup.vehicleContents.ensure(car);
        return [
            {id:'cabin-inventory',label:'Cabin inventory',result:()=>({externalId:`cabin:${car.id}`,message:'You look through the cabin storage.'})},
            ...(contents.money>0?[{id:'take-money',label:`Take ${setup.playerState.formatMoney(contents.money)}`,result:()=>setup.vehicleContents.take(car.id)}]:[]),
            {id:'hotwire',label:'Hotwire',enabled:()=>false,unavailableMessage:'Hotwiring is not available yet.',result:()=>({ok:false,message:'Hotwiring is not available yet.'})},
            {id:'get-out',label:'Get out of car',result:leave}
        ];
    }
    return {current,enter,leave,container,actions};
})();
