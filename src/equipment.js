/* Removed garments carry their own pocket arrays, including nested items.
   Pocket IDs are active only while worn; failed moves never detach anything. */
setup.equipment=(()=>{
    const sizes={shirt:[2,2],pants:[2,2],shoes:[2,1],backpack:[2,3]};
    const slotFor=type=>setup.clothing.slots.find(slot=>setup.clothing.choices[slot].includes(type)&&type!=='none');
    function preview(slot) {
        const type=State.variables.character?.clothing[slot];
        return sizes[type]?{id:`equipped:${slot}`,type}:null;
    }
    const failed=message=>({ok:false,message});
    function commit(message) {
        State.create(State.passage);$(document).trigger(':equipmentchange');$(document).trigger(':interactionchange');
        return {ok:true,message};
    }
    function remove(slot,toId,x,y,externalId) {
        const item=preview(slot),inventory=setup.inventory;
        const accessible=inventory.accessible(externalId),target=accessible?.find(container=>container.id===toId);
        if(!item||!target) return failed('That clothing or destination is not accessible.');
        const pockets=setup.clothing.definitions[item.type].pockets;
        if(pockets.some(pocket=>pocket.id===toId)) return failed('A garment cannot be placed inside its own pockets.');
        if(!inventory.fits(target,item,x,y)) return failed('Not enough adjoining free blocks. Your clothing stays on.');
        const state=inventory.ensure();
        const serial=(State.variables.garmentSerial||0)+1;
        const id=State.variables.wornGarmentIds?.[slot]||`garment:${serial}`;
        item.id=id;item.x=x;item.y=y;
        item.pockets=Object.fromEntries(pockets.map(pocket=>[pocket.id,state.containers[pocket.id]||[]]));
        State.variables.garmentSerial=serial;
        for(const pocket of pockets) delete state.containers[pocket.id];
        State.variables.character.clothing[slot]='none';
        State.variables.wornGarmentIds={...State.variables.wornGarmentIds,[slot]:null};
        (state.containers[toId] ||= []).push(item);
        return commit(`${setup.clothing.definitions[item.type].name} removed with its pocket contents.`);
    }
    function equip(fromId,itemId,externalId) {
        const inventory=setup.inventory,source=inventory.accessible(externalId)?.find(container=>container.id===fromId);
        const item=source&&inventory.placements(source).find(item=>item.id===itemId),slot=item&&slotFor(item.type);
        if(!slot) return failed('That clothing is not accessible.');
        if(State.variables.character.clothing[slot]!=='none') return failed(`Remove the current ${setup.clothing.labels[slot].toLowerCase()} first.`);
        const state=inventory.ensure(),pockets=setup.clothing.definitions[item.type].pockets;
        if(pockets.some(pocket=>state.containers[pocket.id]?.length)) return failed('Existing pocket contents must be recovered before equipping this garment.');
        state.containers[fromId]=inventory.placements(source).filter(entry=>entry.id!==itemId);
        State.variables.character.clothing[slot]=item.type;
        for(const pocket of pockets) state.containers[pocket.id]=item.pockets?.[pocket.id]||[];
        State.variables.wornGarmentIds={...State.variables.wornGarmentIds,[slot]:item.id};
        return commit(`You put on ${setup.clothing.definitions[item.type].name.toLowerCase()}. Its pocket contents are restored.`);
    }
    function move(from,to,itemId,x,y,externalId) {
        if(from.startsWith('equipped:')) return remove(from.slice(9),to,x,y,externalId);
        return setup.inventory.transfer(from,to,itemId,x,y,externalId);
    }
    function drop(from,itemId,externalId) {
        const container=setup.groundItems.current();
        const item=from.startsWith('equipped:')?preview(from.slice(9)):setup.inventory.placements({id:from}).find(item=>item.id===itemId);
        if(!container||!item) return failed('That item is no longer accessible.');
        const fit=setup.inventory.firstFit(container,item,setup.inventory.placements(container));
        return fit?move(from,container.id,itemId,fit.x,fit.y,externalId):failed('There is no room on this ground tile.');
    }
    return {sizes,slotFor,preview,remove,equip,move,drop};
})();
