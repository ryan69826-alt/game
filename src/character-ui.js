/* DOM controls live outside save data. SugarCube owns the serializable values. */
$(document).on(':passagedisplay', () => {
    const root=document.getElementById('character-controls');
    if(!root) return;
    const character=setup.character.ensure();
    const preview=setup.characterDisplay.mount(character);
    const groups=[
        ['Identity',[['gender','Gender'],['genitals','Genitals']]],
        ['Body',[['bodySize','Body Size'],['breastSize','Breast Size']]],
        ['Appearance',[['eyeColor','Eye Color'],['hairColor','Hair Color'],['hairLength','Hair Length'],['skinTone','Skin Tone']]]
    ];
    function update() {
        const breast=document.getElementById('character-breastSize');
        if(breast) {
            breast.disabled=character.gender!=='Female';
            breast.closest('.character-field').hidden=character.gender!=='Female';
        }
        document.getElementById('build-description').textContent=`${character.gender} · ${character.bodySize} body`;
        document.getElementById('appearance-description').textContent=Object.entries(character.clothing).filter(([, worn]) => worn).map(([slot]) => setup.clothing.definitions[slot].name).join(' · ') || 'Underwear only';
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
            for(const value of setup.character.choices[key]) input.append(new Option(value,value));
            row.append(input);input.value=character[key];
            input.addEventListener('change',()=>{character[key]=input.value;update();});
            grid.append(row);
        }
        root.append(group);
    }
    const clothing = document.createElement('fieldset');clothing.className = 'customization-group';
    const legend = document.createElement('legend');legend.textContent = 'Clothing';clothing.append(legend);
    const grid = document.createElement('div');grid.className = 'clothing-choices';
    for (const slot of setup.clothing.slots) {
        const definition = setup.clothing.definitions[slot];
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox';input.id = `clothing-${slot}`;input.checked = character.clothing[slot];
        input.addEventListener('change', () => {character.clothing[slot] = input.checked;update();});
        label.append(input, ` ${definition.name} · ${definition.columns * definition.rows} blocks`);grid.append(label);
    }
    const note = document.createElement('p');note.className = 'world-note';
    note.textContent = 'Only worn pockets and bags provide storage. Underwear and shoes have no storage.';
    clothing.append(grid, note);root.append(clothing);
    setup.characterCreationBuild.mount(root, character);
    update();
});
