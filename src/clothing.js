/* Equipment choices, separate pocket definitions, and serializable item IDs. */
setup.clothing = (() => {
    const slots = ['top', 'bottoms', 'shoes', 'storage', 'handheld'];
    const labels = {top: 'Top', bottoms: 'Bottoms', shoes: 'Shoes', storage: 'Wearable Storage', handheld: 'Handheld'};
    const choices = {top: ['none','shirt'], bottoms: ['none','pants'], shoes: ['none','shoes'], storage: ['none','backpack'], handheld: ['none']};
    const definitions = {
        none: {name: 'None', pockets: []},
        shirt: {name: 'Generic shirt', pockets: [{id: 'worn:shirt', name: 'Shirt pocket', columns: 1, rows: 1}]},
        pants: {name: 'Generic pants', pockets: ['Front left','Front right','Back left','Back right'].map((name,index) =>
            ({id: `worn:pants:${index+1}`, name: `Pants · ${name.toLowerCase()} pocket`, columns: 1, rows: 1}))},
        shoes: {name: 'Generic shoes', pockets: []},
        backpack: {name: 'Backpack', pockets: [{id: 'worn:backpack', name: 'Backpack', columns: 4, rows: 4}]}
    };
    const defaults = () => ({top: 'shirt', bottoms: 'pants', shoes: 'shoes', storage: 'none', handheld: 'none'});
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
    const equipped = character => slots.map(slot => character.clothing[slot]).filter(id => id !== 'none');
    const summary = character => equipped(character).map(id => definitions[id].name).join(', ') || 'Base outfit only';
    const storage = character => equipped(character).flatMap(id => definitions[id].pockets);
    return {slots, labels, choices, definitions, defaults, normalize, equipped, summary, storage};
})();
