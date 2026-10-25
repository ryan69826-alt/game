/* Preview is read-only. Applying test damage explicitly exercises the real
   health handler, without adding combat encounters or equipment wear. */
setup.developerProtection=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Protection calculation';
        const result=setup.protection.calculate(),summary=document.createElement('div');summary.id='developer-protection-summary';
        for(const text of [`Equipped protection: ${result.total} points`,`Damage reduction: ${result.reduction}% (maximum ${result.cap}%)`]){
            const line=document.createElement('p');line.textContent=text;summary.append(line);
        }
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Protection by clothing slot');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Equipped protection contributions';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Item protection','Applied protection']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);
        const body=document.createElement('tbody');
        for(const row of result.rows){const line=document.createElement('tr');line.dataset.slot=row.slot;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item+(row.broken?' (Broken)':''),row.raw,row.points].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const help=document.createElement('p');help.className='world-note';help.textContent='Protection adds equally across equipped slots. Empty slots, stored items, augmentations and broken clothing contribute 0. Above 0 durability, each item provides its full protection. Damage taken = incoming damage × (1 − reduction ÷ 100). Health and damage use two decimal places. Preview leaves health unchanged; Apply test damage reduces health without spending time, awarding XP or damaging clothing.';
        const form=document.createElement('form');form.className='rental-form';
        const label=document.createElement('label');label.htmlFor='developer-protection-damage';label.textContent='Incoming damage';
        const input=document.createElement('input');input.id=label.htmlFor;input.type='number';input.min='0';input.step='.01';input.value='100';input.required=true;
        const preview=document.createElement('button');preview.type='submit';preview.textContent='Preview damage';
        const apply=document.createElement('button');apply.type='button';apply.textContent='Apply test damage';
        const outcome=document.createElement('p');outcome.id='developer-protection-result';outcome.setAttribute('role','status');
        function display(damage){outcome.textContent=damage.ok?`${damage.incoming} incoming × (1 − ${damage.reduction} ÷ 100) = ${damage.damage} damage · ${damage.blocked} blocked${damage.health!==undefined?` · Health: ${damage.health} / 100 (${damage.healthLost} lost)`: ' · Preview only; health unchanged'}`:damage.message;}
        form.addEventListener('submit',event=>{event.preventDefault();display(setup.protection.previewDamage(input.valueAsNumber));});
        apply.addEventListener('click',()=>{if(form.reportValidity())display(setup.playerState.takeDamage(input.valueAsNumber));});
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        form.append(label,input,preview,apply);root.append(heading,summary,scroll,help,form,outcome,previous);
        display(setup.protection.previewDamage(input.valueAsNumber));
    }
    return {show};
})();
