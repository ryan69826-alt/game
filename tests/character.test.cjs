const {test,before,after,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {existsSync,mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {chromium}=require('playwright');

let server,browser,page;
const base='http://127.0.0.1:8765';
const temp=mkdtempSync(join(tmpdir(),'meridian-test-'));
before(async()=>{
    execFileSync('python3',['scripts/project.py','build'],{stdio:'inherit'});
    server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','dist'],{stdio:'ignore'});
    let ready=false;
    for(let i=0;i<100;i++) {
        try {const response=await fetch(base);if(response.ok){ready=true;break;}} catch {}
        await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(ready,'test server starts');
    const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
    browser=await chromium.launch({executablePath,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();server?.kill();rmSync(temp,{recursive:true,force:true});});
beforeEach(async()=>{
    page=await browser.newPage({viewport:{width:1440,height:1100}});
    page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
    await page.goto(base);
    await page.getByRole('link',{name:'Character Creation',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#character-canvas')?.hasAttribute('data-variation'));
});
afterEach(async()=>{assert.deepEqual(page.errors,[]);await page.close();});
const image=()=>page.locator('#character-canvas').evaluate(canvas=>canvas.toDataURL());
const value=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.character));

test('all 16 independent body combinations have distinct visible renders',async()=>{
    const images=new Set();
    for(const fat of ['Skinny','Petite','Average','Fat']) for(const muscle of ['Skinny','Toned','Athletic','Muscular']) {
        await page.getByLabel('Body Fat',{exact:true}).selectOption(fat);
        await page.getByLabel('Muscle Mass',{exact:true}).selectOption(muscle);
        const character=await value();assert.equal(character.bodyFat,fat);assert.equal(character.muscleMass,muscle);
        assert.equal(await page.locator('#preview-status').innerText(),'');
        images.add(await image());
    }
    assert.equal(images.size,16);
});

test('all 64 body variants keep head and hair pixels fixed and connect at the neck',async()=>{
    const images=new Set();
    const head=await page.locator('#head-layer').evaluate(canvas=>canvas.toDataURL());
    const hair=await page.locator('#hair-layer').evaluate(canvas=>canvas.toDataURL());
    let headRegion;
    for(const gender of ['Male','Female']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(gender);
        for(const breast of (gender==='Female'?['Small','Medium','Large']:['Medium'])) {
            if(gender==='Female') await page.getByLabel('Breast Size',{exact:true}).selectOption(breast);
            for(const fat of ['Skinny','Petite','Average','Fat']) for(const muscle of ['Skinny','Toned','Athletic','Muscular']) {
                await page.getByLabel('Body Fat',{exact:true}).selectOption(fat);
                await page.getByLabel('Muscle Mass',{exact:true}).selectOption(muscle);
                assert.equal(await page.locator('#preview-status').innerText(),'');
                assert.equal(await page.locator('#head-layer').evaluate(canvas=>canvas.toDataURL()),head,'head layer does not change');
                assert.equal(await page.locator('#hair-layer').evaluate(canvas=>canvas.toDataURL()),hair,'hair stays attached to the head');
                const geometry=await page.locator('#character-canvas').evaluate(canvas=>{
                    const neckY=Number(canvas.dataset.neckY),neckX=Number(canvas.dataset.neckX),ctx=canvas.getContext('2d');
                    const region=Array.from(ctx.getImageData(0,0,canvas.width,neckY).data);
                    const neck=ctx.getImageData(neckX-1,neckY-1,3,6).data;
                    return {region,connected:Array.from(neck).filter((_,i)=>i%4===3).every(alpha=>alpha>180)};
                });
                if(!headRegion) headRegion=geometry.region;
                assert.deepEqual(geometry.region,headRegion,'visible head region is pixel-identical');
                assert.ok(geometry.connected,`neck is connected: ${gender} ${breast} ${fat} ${muscle}`);
                images.add(await image());
            }
        }
    }
    assert.equal(images.size,64);
});

test('gender changes body model; female breast size is visible, independent, and retained',async()=>{
    const male=await image();
    assert.equal(await page.getByLabel('Breast Size',{exact:true}).isVisible(),false);
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
    assert.equal(await page.getByLabel('Breast Size',{exact:true}).isVisible(),true);
    const renders=new Set();
    for(const size of ['Small','Medium','Large']) {
        await page.getByLabel('Breast Size',{exact:true}).selectOption(size);
        const rendered=await image();renders.add(rendered);assert.notEqual(rendered,male);
    }
    assert.equal(renders.size,3);
    await page.getByLabel('Gender',{exact:true}).selectOption('Male');
    assert.equal(await image(),male);assert.equal(await page.getByLabel('Breast Size',{exact:true}).isVisible(),false);
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
    assert.equal(await page.getByLabel('Breast Size',{exact:true}).inputValue(),'Large');
    assert.equal((await value()).genitals,'Male','body model never changes genital choice');
});

test('every eye color, hair color, hair length, and skin tone changes the pixels',async()=>{
    const fields={
        'Eye Color':['Blue','Green','Brown'],
        'Hair Color':['Blonde','Black','Brown','Orange','Gray'],
        'Hair Length':['Shaved','Ear','Neck','Chest','Waist','Knee','Floor'],
        'Skin Tone':['Pale','Tan','Olive','Dark']
    };
    for(const [label,choices] of Object.entries(fields)) {
        const images=new Set();
        for(const choice of choices) {await page.getByLabel(label,{exact:true}).selectOption(choice);images.add(await image());}
        assert.equal(images.size,choices.length,`${label} has distinct visual choices`);
    }
});

test('height slider is keyboard accessible from 4 ft to 7 ft and scales the figure',async()=>{
    const slider=page.getByRole('slider',{name:'Height'});
    const spriteHeight=()=>page.locator('#character-canvas').evaluate(canvas=>{
        const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
        let top=canvas.height,bottom=0;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(data[(y*canvas.width+x)*4+3]>150){top=Math.min(top,y);bottom=Math.max(bottom,y);}
        return bottom-top;
    });
    await slider.focus();await slider.press('Home');assert.equal((await value()).heightInches,48);
    assert.equal(await page.locator('#height-output').textContent(),'4 ft 0 in');const short=await spriteHeight();
    await slider.press('End');assert.equal((await value()).heightInches,84);
    assert.equal(await page.locator('#height-output').textContent(),'7 ft 0 in');const tall=await spriteHeight();
    assert.ok(tall/short>1.6 && tall/short<1.9,'height visibly scales while feet stay on the baseline');
});

test('independent identity and appearance survive menu, reload, and disk save round trip',async()=>{
    for(const [label,choice] of Object.entries({'Gender':'Female','Genitals':'Both','Body Fat':'Fat','Muscle Mass':'Muscular','Breast Size':'Large','Eye Color':'Green','Hair Color':'Gray','Hair Length':'Floor','Skin Tone':'Dark'})) {
        await page.getByLabel(label,{exact:true}).selectOption(choice);
    }
    await page.getByRole('slider',{name:'Height'}).press('End');
    const expected=await value();assert.equal(expected.age,26);
    await page.getByRole('link',{name:'Save & return to menu'}).click();
    await page.reload();await page.waitForSelector('.main-menu');assert.deepEqual(await value(),expected);
    await page.locator('.main-menu a').filter({hasText:'Import/Export Saves'}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'character.save');await download.saveAs(save);
    await page.locator('#ui-dialog-close').click();
    await page.getByRole('link',{name:'Character Creation',exact:true}).click();
    assert.equal(await page.getByLabel('Genitals',{exact:true}).inputValue(),'Both');
    await page.getByLabel('Genitals',{exact:true}).selectOption('Female');
    await page.getByRole('link',{name:'Save & return to menu'}).click();
    await page.locator('.main-menu a').filter({hasText:'Import/Export Saves'}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    await chooser.setFiles(save);
    await page.waitForFunction(()=>SugarCube.State.variables.character.genitals==='Both');
    assert.deepEqual(await value(),expected);
});

test('old saves without character data open safely; malformed fields normalize',async()=>{
    await page.evaluate(()=>{delete SugarCube.State.variables.character;SugarCube.Engine.play('CharacterCreation');});
    await page.waitForSelector('#character-gender');assert.equal((await value()).heightInches,66);
    await page.evaluate(()=>{SugarCube.State.variables.character={gender:'Unknown',genitals:'Both',heightInches:900,bodyFat:'Fat'};SugarCube.Engine.play('CharacterCreation');});
    await page.waitForSelector('#character-gender');const character=await value();
    assert.equal(character.gender,'Male');assert.equal(character.genitals,'Both');assert.equal(character.heightInches,84);assert.equal(character.bodyFat,'Fat');
    assert.equal(character.breastSize,'Medium');assert.equal(character.version,2);
});

test('creator fits narrow screens and large-text preference without horizontal scrolling',async()=>{
    for(const width of [390,320]) {
        await page.setViewportSize({width,height:844});
        await page.evaluate(()=>document.documentElement.classList.add('large-text'));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('#character-controls select:visible').count(),8);
        await page.getByLabel('Gender',{exact:true}).selectOption('Female');
        assert.equal(await page.locator('#character-controls select:visible').count(),9);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.getByLabel('Gender',{exact:true}).selectOption('Male');
        await page.getByRole('link',{name:'Save & return to menu'}).click();
        assert.equal(await page.locator('.main-menu a').count(),3);
        await page.getByRole('link',{name:'Character Creation',exact:true}).click();
    }
});
