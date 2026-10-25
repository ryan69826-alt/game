/* Read-only visibility diagnostics for testing outfits before NPC attraction. */
setup.developerAllure=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Allure calculation';
        const result=setup.allure.calculate(),summary=document.createElement('p');summary.id='developer-allure-summary';summary.textContent=`Visible clothing allure: ${result.total} points`;
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Allure by clothing visibility');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Visible clothing allure contributions';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Item allure','Visibility','Applied allure']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);
        const body=document.createElement('tbody');
        for(const row of result.rows){const line=document.createElement('tr');line.dataset.slot=row.slot;
            const visibility=row.item==='Empty'?'Empty':row.visible?'Visible':`Hidden by ${row.hiddenBy.map(item=>item.name).join(', ')}`;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item,row.raw,visibility,row.contribution].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const help=document.createElement('p');help.className='world-note';help.textContent='Only visible equipped items count. A zero-allure covering item still hides the layer beneath it. Outer tops hide Top, Under Top, Waist and Wrists; tops hide Under Top. Long sleeves hide Wrists; trousers hide Under Bottom, Ankles and Feet; shorts and skirts hide Under Bottom. Closed shoes hide Feet; boots also hide Ankles. Sandals leave socks visible. Items are treated as closed and opaque with whole-slot visibility; tears do not reveal underlayers yet. Wetness and durability do not change allure. This is an outfit total, not an NPC attraction chance.';
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,summary,scroll,help,previous);
    }
    return {show};
})();
