/* Equipment definitions and six explicit sprite fits, shared by art and storage. */
setup.clothing = {
    slots: ['shirt', 'pants', 'shoes', 'backpack'],
    definitions: {
        shirt: {name: 'Generic shirt', columns: 2, rows: 1},
        pants: {name: 'Generic pants', columns: 2, rows: 2},
        shoes: {name: 'Generic shoes', columns: 0, rows: 0},
        backpack: {name: 'Backpack', columns: 4, rows: 4}
    },
    defaults: () => ({shirt: true, pants: true, shoes: true, backpack: false}),
    fits: {
        'Male-Small': {shoulder: 15, waist: 10, hip: 12, arm: 5, leg: 7},
        'Male-Medium': {shoulder: 19, waist: 12, hip: 14, arm: 6, leg: 8},
        'Male-Large': {shoulder: 23, waist: 14, hip: 16, arm: 7, leg: 9},
        'Female-Small': {shoulder: 11, waist: 7, hip: 15, arm: 4, leg: 7},
        'Female-Medium': {shoulder: 13, waist: 8, hip: 18, arm: 5, leg: 8},
        'Female-Large': {shoulder: 15, waist: 10, hip: 21, arm: 6, leg: 9}
    }
};
