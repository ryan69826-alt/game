/* Exposure shares the same visible outer layers as allure. Bare-region values
   are supplied separately from the clothing catalog. */
setup.exposure=(()=>{
    const bare=Object.freeze({upper:50,lower:50});
    function calculate(character=State.variables.character,uncovered=bare) {
        if(!Number.isFinite(uncovered?.upper)||!Number.isFinite(uncovered?.lower))throw new Error('Bare-body exposure values are required.');
        const visible=setup.clothingVisibility.calculate(character);
        const rows=visible.map(entry=>{
            const raw=Number.isFinite(entry.item?.exposure)?entry.item.exposure:0;
            return {slot:entry.slot,item:entry.item?.name??'Empty',raw,visible:entry.visible,hiddenBy:entry.hiddenBy,
                contribution:entry.visible?raw:0};
        });
        const bareUpper=visible.some(entry=>entry.visible&&['overtop','top','undertop'].includes(entry.slot))?0:uncovered.upper;
        const bareLower=visible.some(entry=>entry.visible&&['bottoms','underbottoms'].includes(entry.slot))?0:uncovered.lower;
        const clothing=rows.reduce((sum,row)=>sum+row.contribution,0),rawTotal=clothing+bareUpper+bareLower;
        return {total:Math.max(0,Math.min(100,rawTotal)),rawTotal,clothing,bareUpper,bareLower,rows};
    }
    return {bare,calculate};
})();
