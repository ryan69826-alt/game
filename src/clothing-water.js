/* Water exposure is explicit, per garment. Weather, layer shielding and timed
   drying are intentionally left for their own mechanics. */
setup.clothingWater=(()=>{
    function status(slot,character=State.variables.character) {
        const type=character?.clothing?.[slot],item=setup.clothing.definitions[type];
        const raw=item?.waterProtection??null,supported=setup.clothing.choices[slot]?.includes(type)&&[0,1].includes(raw);
        const durability=setup.clothingCondition.current(slot,character),wet=setup.clothingCondition.isWet(slot,character);
        return {type,name:item?.name??'Empty',supported:!!supported,raw,
            waterproof:setup.clothingCondition.effectiveStat(type,'waterProtection',durability)===1,wet,
            baseWarmth:item?.warmth??null,warmth:item?.warmth==null?null:setup.clothingCondition.effectiveStat(type,'warmth',durability,wet)};
    }
    function setWet(slot,wet) {
        const info=status(slot);
        if(!State.variables.worldStarted||typeof wet!=='boolean'||!info.supported)return {ok:false,message:'Choose an equipped clothing item with a water-protection value.'};
        setup.clothingCondition.assign(slot,setup.clothingCondition.current(slot),State.variables.character,wet);
        State.create(State.passage);$(document).trigger(':equipmentchange');$(document).trigger(':interactionchange');
        const next=status(slot),message=wet&&next.waterproof?`${next.name} repels the water and stays dry.`:next.wet?`${next.name} is wet; its warmth is halved.`:`${next.name} is dry.`;
        return {ok:true,wet:next.wet,message};
    }
    const expose=slot=>setWet(slot,true);
    const dry=slot=>setWet(slot,false);
    return {status,setWet,expose,dry};
})();
