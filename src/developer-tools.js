/* Prototype tools change real saved values without spending game time. */
setup.developerTools=(()=>{
    function showWarmth(root,back) {
        root.replaceChildren();
        const heading=document.createElement('h2');heading.textContent='Warmth calculation';
        const temperature=setup.weather.temperature(),result=setup.warmth.calculate(State.variables.character,temperature),rows=setup.warmth.clothingBreakdown();
        const format=value=>Number(value.toFixed(3)).toString();
        const summary=document.createElement('div');summary.id='developer-warmth-summary';
        const total=rows.reduce((sum,row)=>sum+row.contribution,0),weight=setup.warmth.totalWeight;
        for(const text of [
            `Current temperature: ${format(temperature)}°F`,
            `Clothing average = weighted total ÷ total weight = ${format(total)} ÷ ${weight} = ${format(result.clothing)}`,
            `World requirement = 10 × (100 − temperature) ÷ (100 − 30), capped at 0–10 = ${format(result.world)}`,
            `Difference = clothing average − world requirement = ${format(result.clothing)} − ${format(result.world)} = ${format(result.difference)}`,
            `How you feel: ${result.category}`
        ]){const line=document.createElement('p');line.textContent=text;summary.append(line);}
        const scroll=document.createElement('div');scroll.className='developer-warmth-table';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Warmth by clothing slot');
        const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Equipped clothing contributions';
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const title of ['Slot','Equipped item','Warmth','Weight','Contribution']){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;header.append(cell);}
        head.append(header);const body=document.createElement('tbody');
        for(const row of rows){const line=document.createElement('tr');line.dataset.slot=row.slot;
            for(const [index,value] of [setup.clothing.slotLabel(row.slot),row.item,row.warmth,`×${row.weight}`,row.contribution].entries()){
                const cell=document.createElement(index===0?'th':'td');if(index===0)cell.scope='row';cell.textContent=String(value);line.append(cell);
            }body.append(line);
        }
        table.append(caption,head,body);scroll.append(table);
        const note=document.createElement('p');note.className='world-note';note.textContent='Empty weighted slots count as 0; total weight stays 23. Metal items can contribute −1 warmth. Waist, Back, Handheld and augmentations are unweighted. Comfort uses the difference rounded to the nearest whole number (halves away from zero): ≤ −4 Freezing; −3 to −2 Cold; −1 to +1 Comfortable; +2 to +3 Warm; ≥ +4 Overheating. Displayed decimals are rounded; calculations use full precision.';
        const previous=document.createElement('button');previous.type='button';previous.textContent='Back to developer tools';previous.addEventListener('click',back);
        root.append(heading,summary,scroll,note,previous);
    }
    function maxStats() {
        if(!State.variables.worldStarted)return false;
        const player=setup.playerState.ensure();player.health=player.maxHealth;player.money=Math.max(player.money,999999999);
        for(const name of setup.characterRules.skills)setup.skills.award(name,setup.characterRules.maxXp);
        State.variables.rest={version:2,tiredness:0,fatigue:0,awakeSeconds:0,recoverySeconds:0,activity:null};
        State.variables.endurance={version:2,used:0,exhausted:false,sprintSteps:0,recoverySeconds:0};
        State.create(State.passage);$(document).trigger(':playerchange');$(document).trigger(':timechange');
        return true;
    }
    function open() {
        if(Dialog.isOpen()||!document.querySelector('.world-sidebar'))return;
        Dialog.setup('Developer tools','character-window developer-window');
        const root=Dialog.body();
        function main(){
            root.replaceChildren();
            const help=document.createElement('p');help.className='world-note';help.textContent='Testing tools. Changes are saved with your character.';
            const action=document.createElement('button');action.type='button';action.textContent='Max out all stats';
            const result=document.createElement('p');result.setAttribute('role','status');
            action.addEventListener('click',()=>{if(maxStats())result.textContent='All skills are level 10. Health is restored, fatigue and tiredness are cleared, endurance is recovered, and you have at least $999,999,999.';});
            const clearance=document.createElement('button');clearance.type='button';
            const label=()=>{clearance.textContent=setup.corporateAccess.authorized()?'Revoke corporate parking clearance':'Grant corporate parking clearance';};label();
            clearance.addEventListener('click',()=>{const granted=setup.corporateAccess.toggleClearance();label();result.textContent=granted?'Your ID implant now has Executive Parking clearance.':'Executive Parking clearance removed from your ID implant.';});
            const clothing=document.createElement('button');clothing.type='button';clothing.textContent='Clothing selector';
            clothing.addEventListener('click',()=>setup.developerClothing.show(root,main));
            const warmth=document.createElement('button');warmth.type='button';warmth.textContent='Warmth calculation';
            warmth.addEventListener('click',()=>showWarmth(root,main));
            root.append(help,action,clearance,clothing,warmth,result);
        }
        main();Dialog.open();
    }
    return {open,maxStats};
})();
$(document).on('keydown.developerTools',event=>{
    if(event.key.toLowerCase()!=='p'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||Dialog.isOpen()||
        event.target.closest('input,select,textarea,[contenteditable="true"]')||!document.querySelector('.world-sidebar'))return;
    event.preventDefault();setup.developerTools.open();
});
