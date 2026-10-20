/* Installed augmentations are independent of wearable storage and item packing.
   Player actions cannot remove the ID chip; explicit empty slots can support
   later story-event changes without silently reinstalling it on every load. */
setup.augmentations=(()=>{
    const definitions={'basic-id-chip':{name:'Basic ID chip',removable:false}};
    function ensure() {
        const old=State.variables.augmentations;
        const saved=old?.version===1&&Array.isArray(old.slots);
        const slots=Array.from({length:4},(_,index)=>saved?(Object.hasOwn(definitions,old.slots[index])?old.slots[index]:null):index===0?'basic-id-chip':null);
        State.variables.augmentations={version:1,slots};return State.variables.augmentations;
    }
    const has=id=>ensure().slots.includes(id);
    function remove(index) {
        const id=ensure().slots[index];
        return {ok:false,message:id==='basic-id-chip'?'The Basic ID chip cannot be removed by the player.':'There is no removable augmentation in this slot.'};
    }
    return {definitions,ensure,has,remove};
})();
