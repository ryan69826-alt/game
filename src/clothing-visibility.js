/* Visibility comes from explicit garment coverage, not placeholder sprite
   pixels. A covered slot contributes no allure, even if its cover has zero. */
setup.clothingVisibility=(()=>{
    function calculate(character=State.variables.character) {
        const equipped=setup.clothing.slots.map(slot=>{
            const type=character?.clothing?.[slot];
            return {slot,type,item:setup.clothing.choices[slot].includes(type)&&type!=='none'?setup.clothing.definitions[type]:null};
        });
        return equipped.map(entry=>{
            const hiddenBy=entry.item?equipped.filter(other=>other.slot!==entry.slot&&other.item?.covers?.includes(entry.slot)).map(other=>({slot:other.slot,name:other.item.name})):[];
            return {...entry,visible:!!entry.item&&!hiddenBy.length,hiddenBy};
        });
    }
    return {calculate};
})();
