/* Test the same percentage check future encounters will call. No world NPCs,
   time, XP or detection flags are changed by this developer view. */
setup.developerStealth=(()=>{
    function show(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Stealth calculation';
        const result=setup.stealth.calculate(),summary=document.createElement('div');summary.id='developer-stealth-summary';
        for(const text of [
            `Base stealth: ${result.base} / 100`,
            `Equipped clothing modifier: ${result.clothing>=0?'+':''}${result.clothing}`,
            `Stealth = base + clothing, capped at 0–100 = ${result.score} / 100`,
            `Remain undetected: ${result.score}% · Detected: ${result.detectionChance}%`
        ]){const line=document.createElement('p');line.textContent=text;summary.append(line);}
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Stealth by clothing slot');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Equipped stealth modifiers';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Item modifier','Applied modifier']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}head.append(header);
        const body=document.createElement('tbody');
        for(const row of result.rows){const line=document.createElement('tr');line.dataset.slot=row.slot;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item+(row.broken?' (Broken)':''),row.raw,row.modifier].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=index>=2&&value>0?`+${value}`:String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const help=document.createElement('p');help.className='world-note';help.textContent='Empty slots, stored items, augmentations and broken clothing contribute 0. Positive clothing values increase stealth; negative values reduce it. The existing Stealth skill is separate; no level modifier is defined yet. Test rolls spend no time or XP and do not alert NPCs.';
        const test=document.createElement('button');test.type='button';test.textContent='Test stealth check';
        const outcome=document.createElement('p');outcome.id='developer-stealth-result';outcome.setAttribute('role','status');
        test.addEventListener('click',()=>{const roll=setup.stealth.check();outcome.textContent=roll.ok?`Roll: ${roll.roll} / 100 · Needed: ${roll.chance} or lower · ${roll.success?'Remain undetected':'Detected'}`:roll.message;});
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,summary,scroll,help,test,outcome,previous);
    }
    return {show};
})();
