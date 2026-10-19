/* Object definitions and action handlers are separate from movement/save data.
 * Ground items and NPCs can use the same rectangular reach test and supply their
 * own actions. Car access follows the same orientation as the map sprite.
 */
setup.interactions = (() => {
    const inspect = {id: 'inspect', label: 'Inspect', result: object => object.description || `You examine ${object.name.toLowerCase()}.`};
    function isOpen(objectId, mapId = State.variables.world?.mapId) {
        const object=setup.worldMaps[mapId]?.interactables.find(object=>object.id===objectId);
        const shared=object?.lockId&&State.variables.openedObjects?.[`lock:${object.lockId}`];
        return typeof shared==='boolean'?shared:State.variables.openedObjects?.[`${mapId}:${objectId}`]===true;
    }
    function setOpen(object,opened) {
        const stored=State.variables.openedObjects;
        State.variables.openedObjects={...(stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{}),
            [`${State.variables.world.mapId}:${object.id}`]:opened,...(object.lockId?{[`lock:${object.lockId}`]:opened}:{})};
    }
    function openDoor(object) {
        if(['door','car','car-trunk'].includes(object.kind)&&setup.doorLocks.isLocked(object)) return {ok:false,message:`This ${object.kind==='car-trunk'?'trunk':'door'} is locked. Unlock it with the matching key or try lockpicking first.`};
        setOpen(object,true);
        State.create(State.passage);
        $(document).trigger(':interactionchange');
        return 'You open the door.';
    }
    const open = {id: 'open', label: 'Open', enabled: object => !isOpen(object.id), result: openDoor};
    const close={id:'close',label:'Close',enabled:object=>isOpen(object.id),unavailableMessage:'The door is already closed.',result:object=>{
        setOpen(object,false);
        State.create(State.passage);$(document).trigger(':interactionchange');return object.kind==='car-trunk'?'You close the trunk.':'You close the door.';
    }};
    const doorToggle=object=>isOpen(object.id)?close:open;
    const types = {
        door: [{id: 'knock', label: 'Knock', result: 'You knock on the door.'}, open],
        car: [{id: 'look-inside', label: 'Look through window', result: object=>setup.vehicleContents.inspect(object)}, {...open, label: 'Open door'}],
        ground: [inspect], npc: [inspect]
    };
    function nearby(world = State.variables.world) {
        const map = setup.worldMaps[world?.mapId];
        if (!map) return [];
        return (map.interactables || []).map(object => {
            const dx = Math.max(object.x - world.x, 0, world.x - (object.x + (object.width || 1) - 1));
            const dy = Math.max(object.y - world.y, 0, world.y - (object.y + (object.height || 1) - 1));
            const atCounter=object.interactionTiles?.some(tile=>tile.x===world.x&&tile.y===world.y);
            return {object, distance: atCounter ? 1 : dx + dy};
        }).filter(target => target.distance <= 1 && actionsFor(target.object, world).length)
            .filter(target=>setup.rooms.objectVisible(target.object,world))
            .sort((a, b) => a.distance - b.distance || a.object.name.localeCompare(b.object.name));
    }
    function actionsFor(object, world = State.variables.world) {
        if(object.kind==='bed') return [
            {id:'sit',label:'Sit',result:()=>setup.rest.sit(object.id)},
            {id:'nap',label:'Nap for 1 hour',result:()=>setup.rest.sleep(object.id,1)},
            {id:'sleep',label:'Sleep',result:()=>({message:'Choose how long to sleep.',sleepBedId:object.id})}
        ];
        if(object.role==='housing') return [
            {id:'talk',label:'Talk',result:()=>({message:'How can I help you?',conversation:'housing'})},
            {id:'attack',label:'Attack',result:'Combat is not implemented yet. No attack is made.'}
        ];
        if(object.kind==='door' && object.destination) return [types.door[0],doorToggle(object),...setup.doorLocks.actions(object),{
            id:'enter',label:object.exit?'Exit':'Enter',
            enabled:()=>isOpen(object.id),unavailableMessage:'Open the door first.',result:()=>setup.worldTravel.enter(object)
        }];
        if (object.kind === 'car') {
            if (!world) return [];
            const edge = setup.vehicles.edge(object,world);
            if(edge==='side') return [types.car[0],{...doorToggle(object),label:isOpen(object.id)?'Close door':'Open door'},...setup.doorLocks.actions(object)];
            if(edge==='rear') {
                const trunk=setup.vehicles.trunk(object),opened=isOpen(trunk.id);
                return [opened?{...close,id:'close-trunk',label:'Close trunk',enabled:()=>isOpen(trunk.id),result:()=>close.result(trunk)}:
                    {id:'trunk',label:'Open trunk',result:()=>{const result=openDoor(trunk);return typeof result==='object'?result:{message:'You open the trunk.',trunkId:object.id};}},
                    ...(opened?[{id:'inventory',label:'View trunk inventory',result:()=>({trunkId:object.id,message:'You look inside the trunk.'})}]:[]),
                    ...setup.doorLocks.actions(trunk)];
            }
            return [];
        }
        if(object.kind==='door') return [types.door[0],doorToggle(object),...setup.doorLocks.actions(object)];
        return object.actions || (Object.hasOwn(types, object.kind) ? types[object.kind] : [inspect]);
    }
    function run(objectId, actionId) {
        // Revalidate proximity on every action, even if an object later moves.
        const target = nearby().find(target => target.object.id === objectId);
        if (!target) return {ok: false, message: 'That object is no longer within reach.'};
        const action = actionsFor(target.object).find(action => action.id === actionId);
        if (!action) return {ok: false, message: 'That interaction is not available.'};
        if (action.enabled && !action.enabled(target.object)) return {ok: false, message: action.unavailableMessage || 'The door is already open.'};
        const result = typeof action.result === 'function' ? action.result(target.object) : action.result;
        return {ok: true, ...(typeof result==='object'?result:{message:result})};
    }
    return {nearby, actionsFor, run, isOpen};
})();
