/* Equipment choices, separate pocket definitions, and serializable item IDs. */
setup.clothing = (() => {
    const slots=['hat','facewear','overtop','top','undertop','waist','wrists','hands','bottoms','underbottoms','ankles','feet','shoes','storage','handheld'];
    const creatorSlots=['top','bottoms','shoes','storage','handheld'];
    const labels = {hat:'Hat',facewear:'Face Wear',overtop:'Over Top',undertop:'Under Top',waist:'Waist',wrists:'Wrists',hands:'Hands',underbottoms:'Under Bottom',ankles:'Ankles',feet:'Feet',top: 'Top', bottoms: 'Bottoms', shoes: 'Shoes', storage: 'Wearable Storage', handheld: 'Handheld'};
    const choices = {...Object.fromEntries(slots.map(slot=>[slot,['none']])),top: ['none','shirt'], bottoms: ['none','pants'], shoes: ['none','shoes'], storage: ['none','backpack'], handheld: ['none']};
    const definitions = {
        none: {name: 'None', pockets: []},
        shirt: {allure:0, covers:['undertop'], waterProtection:0, protection:1, stealth:0, maxDurability:50, name: 'Generic shirt', warmth:4, pockets: [{id: 'worn:shirt', name: 'Shirt pocket', columns: 1, rows: 1}]},
        pants: {allure:0, covers:['underbottoms','ankles','feet'], waterProtection:0, protection:2, stealth:5, maxDurability:75, name: 'Generic pants', warmth:5, pockets: ['Front left','Front right','Back left','Back right'].map((name,index) =>
            ({id: `worn:pants:${index+1}`, name: `Pants · ${name.toLowerCase()} pocket`, columns: 1, rows: 1}))},
        shoes: {allure:0, covers:['feet'], waterProtection:0, protection:1, stealth:-15, maxDurability:30, name: 'Generic shoes', warmth:3, pockets: []},
        backpack: {allure:0, covers:[], waterProtection:0, protection:0, stealth:-30, maxDurability:100, name: 'Backpack', pockets: [{id: 'worn:backpack', name: 'Backpack', columns: 4, rows: 4}]}
    };
    // Freeze the original five creator dropdowns before expanding gameplay equipment.
    const creatorChoices=Object.fromEntries(creatorSlots.map(slot=>[slot,[...choices[slot]]]));
    for(const item of setup.clothingCatalog.items){definitions[item.id]=item;choices[item.slot].push(item.id);}
    const slotLabel=slot=>({bottoms:'Bottom',storage:'Back'}[slot]||labels[slot]);
    const defaults = () => ({...Object.fromEntries(slots.map(slot=>[slot,'none'])),top: 'shirt', bottoms: 'pants', shoes: 'shoes', storage: 'none', handheld: 'none'});
    function normalize(value) {
        const result = defaults();
        if (!value || typeof value !== 'object') return result;
        const legacy = {top: 'shirt', bottoms: 'pants', shoes: 'shoes', storage: 'backpack'};
        for (const slot of slots) {
            if (choices[slot].includes(value[slot])) result[slot] = value[slot];
            else if (typeof value[legacy[slot]] === 'boolean') result[slot] = value[legacy[slot]] ? legacy[slot] : 'none';
        }
        return result;
    }
    const equipped = character => slots.map(slot => character.clothing[slot]).filter(id => id !== 'none'&&Object.hasOwn(definitions,id));
    const summary = character => equipped(character).map(id => definitions[id].name).join(', ') || 'Base outfit only';
    const storage = character => equipped(character).flatMap(id => definitions[id].pockets);
    return {slots, creatorSlots, creatorChoices, labels, slotLabel, choices, definitions, defaults, normalize, equipped, summary, storage};
})();
