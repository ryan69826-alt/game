/* Developer-only exposure/drying controls use the same saved garment state
   future rain, swimming and drying actions can use. */
setup.developerWater=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Water protection';
        const help=document.createElement('p');help.className='world-note';help.textContent='Water protection 0: exposure makes this garment wet and halves its warmth. Water protection 1: it stays dry and keeps its warmth. Broken clothing has no water protection or warmth. These tests affect only the selected item and spend no game time. Rain, protection for inner layers and timed drying are not added yet.';
        const label=document.createElement('label');label.htmlFor='developer-water-slot';label.textContent='Clothing slot';
        const slots=document.createElement('select');slots.id=label.htmlFor;
        for(const slot of setup.clothing.slots)slots.append(new Option(setup.clothing.slotLabel(slot),slot));
        const form=document.createElement('div');form.className='rental-form';form.append(label,slots);
        const detail=document.createElement('p');detail.id='developer-water-detail';detail.className='world-note';
        const expose=document.createElement('button');expose.type='button';expose.textContent='Expose to water';
        const dry=document.createElement('button');dry.type='button';dry.textContent='Dry item';
        const actions=document.createElement('div');actions.className='developer-durability-presets';actions.append(expose,dry);
        const outcome=document.createElement('p');outcome.id='developer-water-result';outcome.setAttribute('role','status');
        function refresh(){
            const info=setup.clothingWater.status(slots.value);expose.disabled=dry.disabled=!info.supported;
            detail.textContent=info.supported?`${info.name} · Water protection: ${info.raw} (effective ${info.waterproof?1:0}) · ${info.wet?'Wet':'Dry'} · Base warmth: ${info.baseWarmth??'N/A'} · Current warmth: ${info.warmth??'N/A'}`:`${info.name} · Water protection: N/A`;
        }
        expose.addEventListener('click',()=>{outcome.textContent=setup.clothingWater.expose(slots.value).message;refresh();});
        dry.addEventListener('click',()=>{outcome.textContent=setup.clothingWater.dry(slots.value).message;refresh();});
        slots.addEventListener('change',()=>{outcome.textContent='';refresh();});
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,help,form,detail,actions,outcome,previous);refresh();slots.focus();
    }
    return {show};
})();
