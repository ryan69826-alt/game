/* Read-only item ratings and layering context. Future NPC interactions will
   define their skill, timing and outcome rules separately. */
setup.developerAccessibility=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Clothing accessibility';
        const help=document.createElement('p');help.className='world-note';help.textContent='Each item has an accessibility rating from 1 to 10. Higher means easier to reach underneath or remove; 10 is easiest. Ratings belong to individual items and are not added together or converted to percentages. Covered items keep their own rating; covering layers are shown for future interaction checks. Wetness and durability do not change these ratings. No NPC actions or checks are added yet.';
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Accessibility by clothing item');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Equipped clothing accessibility';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Accessibility','Layers']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);
        const body=document.createElement('tbody');
        for(const row of setup.clothingAccess.worn()){const line=document.createElement('tr');line.dataset.slot=row.slot;
            const layers=row.rating===null?'N/A':row.visible?'Outer / visible':`Covered by ${row.coveredBy.map(item=>item.name).join(', ')}`;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item,row.rating===null?'N/A':`${row.rating} / 10`,layers].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const chip=document.createElement('p');chip.className='world-note';chip.textContent='Basic ID chip: Accessibility N/A. The implant remains fixed in place.';
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,help,scroll,chip,previous);
    }
    return {show};
})();
