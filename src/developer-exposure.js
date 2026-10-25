/* Read-only diagnostics share clothing visibility with the allure calculation. */
setup.developerExposure=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Exposure calculation';
        const result=setup.exposure.calculate(),summary=document.createElement('div');summary.id='developer-exposure-summary';
        for(const text of [`Visible clothing exposure: ${result.clothing}`,`Bare upper body: ${result.bareUpper} · Bare lower body: ${result.bareLower}`,
            `Exposure = clothing + bare regions = ${result.rawTotal}, capped at 0–100 = ${result.total} / 100`]){
            const line=document.createElement('p');line.textContent=text;summary.append(line);
        }
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Exposure by clothing visibility');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Visible clothing exposure contributions';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Item exposure','Visibility','Applied exposure']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);
        const body=document.createElement('tbody');
        for(const row of result.rows){const line=document.createElement('tr');line.dataset.slot=row.slot;
            const visibility=row.item==='Empty'?'Empty':row.visible?'Visible':`Hidden by ${row.hiddenBy.map(item=>item.name).join(', ')}`;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item,row.raw,visibility,row.contribution].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const help=document.createElement('p');help.className='world-note';help.textContent='Bare upper and lower body each add 50. A visible outer garment replaces that region’s bare value, even when its listed exposure is 0; covered clothing contributes nothing. Visible accessory values are added, including negative values. Visibility uses the same closed, opaque, whole-slot coverage as allure. Wetness, damage and tears do not change exposure yet. This measures skin exposure; NPC reactions are separate.';
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,summary,scroll,help,previous);
    }
    return {show};
})();
