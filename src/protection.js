/* Protection points add across equipped slots: one point = 1% less damage.
   Equipment is the source of truth; empty and broken items contribute zero. */
setup.protection=(()=>{
    const cap=80;
    const round=value=>Number(value.toFixed(2));
    function calculate(character=State.variables.character) {
        const rows=setup.clothing.slots.map(slot=>{
            const type=character?.clothing?.[slot],definition=setup.clothing.choices[slot].includes(type)&&type!=='none'?setup.clothing.definitions[type]:null;
            const durability=definition?setup.clothingCondition.current(slot,character):null;
            const raw=definition?.protection??0,effective=definition?setup.clothingCondition.effectiveStat(type,'protection',durability):0;
            return {slot,item:definition?.name??'Empty',raw:Number.isFinite(raw)?raw:0,points:Number.isFinite(effective)?Math.max(0,effective):0,broken:durability===0};
        });
        const total=rows.reduce((sum,row)=>sum+row.points,0),reduction=Math.max(0,Math.min(cap,total));
        return {total,reduction,cap,rows};
    }
    function previewDamage(amount,character=State.variables.character) {
        if(!Number.isFinite(amount)||amount<0)return {ok:false,message:'Enter a nonnegative damage amount.'};
        const {total,reduction}=calculate(character),incoming=round(amount),damage=round(incoming*(1-reduction/100));
        return {ok:true,incoming,total,reduction,blocked:round(incoming-damage),damage};
    }
    return {cap,calculate,previewDamage};
})();
