/* Developer-only equipment injection. Replacements use normal removal first,
   preserving the old garment's identity and nested pocket contents. */
setup.developerClothing=(()=>{
    function equip(type,slot=setup.equipment.slotFor(type)) {
        if(!State.variables.worldStarted||!setup.clothing.slots.includes(slot)||!setup.clothing.choices[slot].includes(type))
            return {ok:false,message:'Choose a clothing item and a matching slot in the world.'};
        const old=State.variables.character.clothing[slot];
        if(old===type)return {ok:true,message:type==='none'?'That slot is already empty.':'That item is already equipped.'};
        if(old!=='none') {
            const result=setup.equipment.drop(`equipped:${slot}`,`equipped:${slot}`);
            if(!result.ok)return {ok:false,message:`The previous garment stays equipped. ${result.message} Move to a clear tile and try again.`};
        }
        if(type==='none')return {ok:true,message:'Clothing removed. The garment and its pocket contents remain at your feet.'};
        const definition=setup.clothing.definitions[type],inventory=setup.inventory.ensure();
        const serial=(State.variables.garmentSerial||0)+1;State.variables.garmentSerial=serial;
        State.variables.character.clothing[slot]=type;
        State.variables.wornGarmentIds={...State.variables.wornGarmentIds,[slot]:`garment:${serial}`};
        for(const pocket of definition.pockets)inventory.containers[pocket.id]=[];
        State.create(State.passage);$(document).trigger(':equipmentchange');$(document).trigger(':interactionchange');
        return {ok:true,message:`${definition.name} equipped. Any previous garment and its contents remain at your feet.`};
    }
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Clothing selector';
        const help=document.createElement('p');help.className='world-note';help.textContent='Equip test clothing without passing time. Replaced clothes keep their pockets and go to the ground or cabin floor. Character creation is unchanged.';
        const form=document.createElement('form');form.className='rental-form developer-clothing-form';
        const slotLabel=document.createElement('label');slotLabel.htmlFor='developer-clothing-slot';slotLabel.textContent='Clothing slot';
        const slots=document.createElement('select');slots.id=slotLabel.htmlFor;
        for(const slot of setup.clothing.slots)slots.append(new Option(setup.clothing.slotLabel(slot),slot));
        const itemLabel=document.createElement('label');itemLabel.htmlFor='developer-clothing-item';itemLabel.textContent='Clothing item';
        const items=document.createElement('select');items.id=itemLabel.htmlFor;
        const detail=document.createElement('p');detail.className='world-note';detail.id='developer-clothing-detail';
        const apply=document.createElement('button');apply.type='submit';apply.textContent='Equip clothing';
        const result=document.createElement('p');result.id='developer-clothing-result';result.setAttribute('role','status');
        function describe() {
            const item=setup.clothing.definitions[items.value],blocks=item.pockets.reduce((sum,p)=>sum+p.columns*p.rows,0);
            const pockets=item.pockets.map(p=>`${p.columns}×${p.rows}`).join(', ')||'None';
            detail.textContent=`Warmth: ${item.warmth??'N/A'} · Storage: ${blocks} blocks · Compartments: ${pockets}`;
            apply.textContent=items.value==='none'?'Remove clothing':'Equip clothing';
        }
        function populate() {
            items.replaceChildren();
            for(const type of setup.clothing.choices[slots.value])items.append(new Option(setup.clothing.definitions[type].name+(type!=='none'&&!setup.clothing.definitions[type].slot?' (legacy)':''),type));
            items.value=State.variables.character.clothing[slots.value]||'none';describe();
        }
        slots.addEventListener('change',populate);items.addEventListener('change',describe);
        form.addEventListener('submit',event=>{event.preventDefault();result.textContent=equip(items.value,slots.value).message;});
        const chip=document.createElement('p');chip.className='world-note';chip.textContent=`Augmentations · Basic ID chip: ${setup.augmentations.has('basic-id-chip')?'installed, fixed in place':'not installed'}.`;
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        form.append(slotLabel,slots,itemLabel,items,detail,apply);root.append(heading,help,form,result,chip,previous);populate();slots.focus();
    }
    return {equip,show};
})();
