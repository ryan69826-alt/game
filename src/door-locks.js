/* Lock data is saved independently of door position and open/closed state.
 * Both sides of a building entrance share one lock ID. */
setup.doorLocks = (() => {
    const id=(object,mapId=State.variables.world.mapId)=>object.lockId||`${mapId}:${object.id}`;
    const difficulty=object=>Number.isInteger(object.lockLevel)&&object.lockLevel>=1&&object.lockLevel<=5?object.lockLevel:1;
    function chance(skill,level) {
        if(!Number.isFinite(skill)||!Number.isInteger(level)||level<1||level>5) return 0;
        const ratio=Math.max(0,skill)/level;
        return Math.max(0,Math.min(100,ratio<=1?(ratio-.5)*100:50+(ratio-1)*50));
    }
    const skill=()=>setup.characterRules.progress(setup.character.ensure().skills.Lockpicking).level;
    function isLocked(object,mapId=State.variables.world.mapId) {
        const value=State.variables.doorLocks?.[id(object,mapId)];
        if(typeof value==='boolean') return value;
        // Preserve already-open doors from saves made before locks existed.
        const locked=!!object.unitId&&!setup.interactions.isOpen(object.id,mapId);
        const old=State.variables.doorLocks;
        State.variables.doorLocks={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[id(object,mapId)]:locked};
        return locked;
    }
    const hasKey=object=>!!object.unitId&&setup.housing.canEnter(object.unitId);
    function canUseLatch(object) {
        const room=setup.rooms.current();
        return !!object.exit||!!object.unitId&&room.unit?.id===object.unitId||
            !!object.interiorOf&&room.unit?.id===object.interiorOf&&room.bathroom;
    }
    function set(object,locked) {
        const old=State.variables.doorLocks;
        State.variables.doorLocks={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[id(object)]:locked};
        State.create(State.passage);$(document).trigger(':interactionchange');
    }
    function unlock(object) {
        if(!isLocked(object)) return {ok:false,message:'The door is already unlocked.'};
        if(!hasKey(object)&&!canUseLatch(object)) return {ok:false,message:'You do not have the matching key. You can try to lockpick this door.'};
        set(object,false);return {ok:true,message:hasKey(object)?'You unlock the door with its key.':'You turn the inside latch and unlock the door.'};
    }
    function lock(object) {
        if(setup.interactions.isOpen(object.id)) return {ok:false,message:'Close the door before locking it.'};
        if(isLocked(object)) return {ok:false,message:'The door is already locked.'};
        if(!hasKey(object)&&!canUseLatch(object)) return {ok:false,message:'You need the matching key to lock this door from this side.'};
        set(object,true);return {ok:true,message:'You lock the door.'};
    }
    function pick(object) {
        if(!isLocked(object)) return {ok:false,message:'The door is already unlocked.'};
        const percent=chance(skill(),difficulty(object));
        const success=percent>0&&(percent>=100||random(1,10000)<=Math.round(percent*100));
        if(success) {set(object,false);return {ok:true,chance:percent,message:'You pick the lock. The door is unlocked, but still closed.'};}
        return {ok:false,chance:percent,message:'You fail to pick the lock. The door remains locked.'};
    }
    function actions(object) {
        return [
            {id:'unlock',label:'Unlock',enabled:()=>isLocked(object),result:()=>unlock(object)},
            {id:'lock',label:'Lock',enabled:()=>!isLocked(object)&&!setup.interactions.isOpen(object.id),result:()=>lock(object)},
            {id:'lockpick',label:`Lockpick · ${Number(chance(skill(),difficulty(object)).toFixed(1))}% chance`,enabled:()=>isLocked(object),result:()=>pick(object)}
        ];
    }
    return {id,difficulty,chance,skill,isLocked,actions};
})();
