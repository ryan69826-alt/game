/* Accessibility is an individual item's 1–10 ease rating, not an outfit total
   or success chance. Covering layers provide context without erasing ratings. */
setup.clothingAccess=(()=>{
    function rating(type) {
        const value=setup.clothing.definitions[type]?.accessibility;
        return Number.isInteger(value)&&value>=1&&value<=10?value:null;
    }
    const describe=type=>rating(type)===null?'Accessibility: N/A':`Accessibility: ${rating(type)}/10 (10 is easiest)`;
    function worn(character=State.variables.character) {
        return setup.clothingVisibility.calculate(character).map(entry=>({slot:entry.slot,type:entry.type,
            item:entry.item?.name??'Empty',rating:entry.item?rating(entry.type):null,visible:entry.visible,coveredBy:entry.hiddenBy}));
    }
    return {rating,describe,worn};
})();
