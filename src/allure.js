/* Outfit allure is a sum of visible item points, not an attraction percentage.
   NPC preferences and responses remain separate from clothing visibility. */
setup.allure=(()=>{
    function calculate(character=State.variables.character) {
        const rows=setup.clothingVisibility.calculate(character).map(entry=>{
            const raw=Number.isFinite(entry.item?.allure)?entry.item.allure:0;
            return {slot:entry.slot,item:entry.item?.name??'Empty',raw,visible:entry.visible,hiddenBy:entry.hiddenBy,
                contribution:entry.visible?raw:0};
        });
        return {total:rows.reduce((sum,row)=>sum+row.contribution,0),rows};
    }
    return {calculate};
})();
