/* Stealth is a derived percentage, separate from Stealth skill XP. Only worn,
   unbroken items modify it; world encounters explicitly request checks. */
setup.stealth=(()=>{
    const startingBase=80;
    const clamp=value=>Math.max(0,Math.min(100,value));
    function calculate(character=State.variables.character) {
        const base=Number.isFinite(State.variables.player?.baseStealth)?clamp(State.variables.player.baseStealth):startingBase;
        const rows=setup.clothing.slots.map(slot=>{
            const type=character?.clothing?.[slot],definition=setup.clothing.choices[slot].includes(type)&&type!=='none'?setup.clothing.definitions[type]:null;
            const durability=definition?setup.clothingCondition.current(slot,character):null;
            const raw=definition?.stealth??0,effective=definition?setup.clothingCondition.effectiveStat(type,'stealth',durability):0;
            return {slot,item:definition?.name??'Empty',raw:Number.isFinite(raw)?raw:0,modifier:Number.isFinite(effective)?effective:0,broken:durability===0};
        });
        const clothing=rows.reduce((sum,row)=>sum+row.modifier,0),score=clamp(base+clothing);
        return {base,clothing,score,detectionChance:100-score,rows};
    }
    function resolve(chance,roll) {
        if(!Number.isFinite(chance)||!Number.isFinite(roll)||roll<=0||roll>100)return {ok:false,message:'Invalid stealth check.'};
        chance=clamp(chance);const success=roll<=chance;
        return {ok:true,chance,roll,success,detected:!success};
    }
    function check(character=State.variables.character) {
        if(!State.variables.worldStarted)return {ok:false,message:'Start the game before making a stealth check.'};
        return resolve(calculate(character).score,random(1,10000)/100);
    }
    return {startingBase,calculate,resolve,check};
})();
