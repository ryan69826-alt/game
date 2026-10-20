/* DOM controls live outside save data. SugarCube owns the serializable values. */
$(document).on(':passagedisplay', () => {
    const root=document.getElementById('character-controls');
    if(!root) return;
    const character=setup.character.ensure();
    const preview=setup.characterDisplay.mount(character);
    const groups=[
        ['Identity',[['gender','Gender'],['genitals','Genitals']]],
        ['Starting date',[['startDate','Start date']]],
        ['Appearance',[['eyeColor','Eye Color'],['hairColor','Hair Color'],['hairLength','Hair Length'],['skinTone','Skin Tone']]]
    ];
    function update() {
        document.getElementById('build-description').textContent=`${character.gender} · Fixed base model`;
        document.getElementById('appearance-description').textContent=setup.clothing.summary(character);
        preview.refresh();
    }
    for(const [title,items] of groups) {
        const group=document.createElement('fieldset');group.className='customization-group';
        const legend=document.createElement('legend');legend.textContent=title;group.append(legend);
        const grid=document.createElement('div');grid.className='control-grid';group.append(grid);
        for(const [key,label] of items) {
            const row=document.createElement('div');row.className='character-field';
            const labelNode=document.createElement('label');labelNode.htmlFor=`character-${key}`;labelNode.textContent=label;row.append(labelNode);
            const input=document.createElement('select');input.id=labelNode.htmlFor;input.name=key;
            for(const value of setup.character.choices[key]) input.append(new Option(key==='startDate'?setup.gameClock.startLabel(value):value,value));
            row.append(input);input.value=character[key];
            input.addEventListener('change',()=>{character[key]=input.value;update();});
            grid.append(row);
        }
        root.append(group);
    }
    const clothing = document.createElement('fieldset');clothing.className = 'customization-group';
    const legend = document.createElement('legend');legend.textContent = 'Clothing';clothing.append(legend);
    const grid = document.createElement('div');grid.className = 'control-grid';
    for (const slot of setup.clothing.creatorSlots) {
        const row = document.createElement('div');row.className = 'character-field';
        const label = document.createElement('label'), input = document.createElement('select');
        input.id = `clothing-${slot}`;input.name = slot;label.htmlFor = input.id;label.textContent = setup.clothing.labels[slot];
        for (const id of setup.clothing.creatorChoices[slot]) {
            const definition = setup.clothing.definitions[id];
            const blocks = definition.pockets.reduce((sum,pocket) => sum + pocket.columns*pocket.rows,0);
            input.append(new Option(`${definition.name}${blocks ? ` · ${blocks} block${blocks === 1 ? '' : 's'}` : ''}`, id));
        }
        input.value = character.clothing[slot];
        input.addEventListener('change', () => {character.clothing[slot] = input.value;update();});
        row.append(label,input);grid.append(row);
    }
    const note = document.createElement('p');note.className = 'world-note';
    note.textContent = 'Shirt: one single-block pocket. Pants: four separate single-block pockets. Backpack: 16 blocks. No handheld items are available yet.';
    clothing.append(grid, note);root.append(clothing);
    setup.characterCreationBuild.mount(root, character);
    update();
});
