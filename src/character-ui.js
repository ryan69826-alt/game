/* DOM controls live outside save data. SugarCube owns the serializable values. */
$(document).on(':passagedisplay', () => {
    const root=document.getElementById('character-controls');
    if(!root) return;
    const character=setup.character.ensure();
    const canvas=document.getElementById('character-canvas');
    const images=Array.from(document.querySelectorAll('.character-source'));
    const sources=Object.fromEntries(images.map(image=>[image.id,image]));
    const layers=Object.fromEntries(['body','head','hair'].map(name=>[name,document.getElementById(`${name}-layer`)]));
    const status=document.getElementById('preview-status');
    let ready=images.every(image=>image.complete && image.naturalWidth>0);
    const groups=[
        ['Identity',[['gender','Gender'],['genitals','Genitals']]],
        ['Body',[['heightInches','Height'],['bodyFat','Body Fat'],['muscleMass','Muscle Mass'],['breastSize','Breast Size']]],
        ['Appearance',[['eyeColor','Eye Color'],['hairColor','Hair Color'],['hairLength','Hair Length'],['skinTone','Skin Tone']]]
    ];
    function update() {
        const breast=document.getElementById('character-breastSize');
        if(breast) {
            breast.disabled=character.gender!=='Female';
            breast.closest('.character-field').hidden=character.gender!=='Female';
        }
        document.getElementById('build-description').textContent=`${character.bodyFat} build · ${character.muscleMass} muscle`;
        document.getElementById('appearance-description').textContent=setup.character.heightLabel(character.heightInches);
        if(ready) {
            try { setup.characterPreview.draw(sources,layers,canvas,character); status.textContent=''; }
            catch(error) { status.textContent='Preview could not render. Your selections are retained.';console.error(error); }
        }
    }
    for(const [title,items] of groups) {
        const group=document.createElement('fieldset');group.className='customization-group';
        const legend=document.createElement('legend');legend.textContent=title;group.append(legend);
        const grid=document.createElement('div');grid.className='control-grid';group.append(grid);
        for(const [key,label] of items) {
            const row=document.createElement('div');row.className='character-field';
            const labelNode=document.createElement('label');labelNode.htmlFor=`character-${key}`;labelNode.textContent=label;row.append(labelNode);
            const input=document.createElement(key==='heightInches'?'input':'select');input.id=labelNode.htmlFor;input.name=key;
            if(key==='heightInches') {
                row.classList.add('height-field');input.type='range';input.min='48';input.max='84';input.step='1';
                const output=document.createElement('output');output.htmlFor=input.id;output.id='height-output';output.textContent=setup.character.heightLabel(character.heightInches);labelNode.append(output);
                const limits=document.createElement('div');limits.className='range-limits';limits.innerHTML='<span>4 ft</span><span>7 ft</span>';
                row.append(input,limits);
            } else {
                for(const value of setup.character.choices[key]) input.append(new Option(value,value));
                row.append(input);
            }
            input.value=character[key];
            input.addEventListener(key==='heightInches'?'input':'change',()=>{
                character[key]=key==='heightInches'?Number(input.value):input.value;
                if(key==='heightInches') {
                    document.getElementById('height-output').textContent=setup.character.heightLabel(character.heightInches);
                    input.setAttribute('aria-valuetext',setup.character.heightLabel(character.heightInches));
                }
                update();
            });
            if(key==='heightInches') input.setAttribute('aria-valuetext',setup.character.heightLabel(character.heightInches));
            grid.append(row);
        }
        root.append(group);
    }
    for(const image of images) {
        image.addEventListener('load',()=>{if(root.isConnected){ready=images.every(image=>image.complete && image.naturalWidth>0);update();}},{once:true});
        image.addEventListener('error',()=>{status.textContent='Character artwork could not load. Your selections are retained.';},{once:true});
    }
    setup.characterCreationBuild.mount(root, character);
    if(!ready) status.textContent='Loading appearance…';
    update();
});
