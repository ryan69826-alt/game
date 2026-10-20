/* Prototype tools change real saved values without spending game time. */
setup.developerTools=(()=>{
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
            root.append(help,action,clearance,clothing,result);
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
