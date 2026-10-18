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

test('head has adult proportions at both height endpoints and stays joined to the body',async()=>{
    const slider=page.getByRole('slider',{name:'Height'});
    for(const key of ['Home','End']) {
        await slider.focus();await slider.press(key);
        const proportions=await page.evaluate(()=>{
            function height(id) {
                const canvas=document.getElementById(id),ctx=canvas.getContext('2d');
                const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                let min=canvas.height,max=0;
                for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>150){min=Math.min(min,y);max=Math.max(max,y);}
                return max-min+1;
            }
            return {head:height('head-layer'),figure:height('character-canvas')};
        });
        assert.ok(proportions.head/proportions.figure>=.16 && proportions.head/proportions.figure<=.20,'head fits the stylized adult figure without the oversized or undersized extremes');
    }
});

test('the three longest hairstyles preserve the rendered eyes, nose, and mouth',async()=>{
    await page.getByLabel('Eye Color',{exact:true}).selectOption('Blue');
    for(const key of ['Home','End']) {
        await page.getByRole('slider',{name:'Height'}).press(key);
        for(const skin of ['Pale','Dark']) for(const color of ['Blonde','Black']) for(const length of ['Waist','Knee','Floor']) {
            await page.getByLabel('Skin Tone',{exact:true}).selectOption(skin);
            await page.getByLabel('Hair Color',{exact:true}).selectOption(color);
            await page.getByLabel('Hair Length',{exact:true}).selectOption(length);
            const face=await page.evaluate(()=>{
                const head=document.getElementById('head-layer'),preview=document.getElementById('character-canvas');
                const original=head.getContext('2d').getImageData(0,0,head.width,head.height).data;
                const rendered=preview.getContext('2d').getImageData(0,0,preview.width,preview.height).data;
                const body=document.getElementById('body-layer').getContext('2d').getImageData(0,0,head.width,head.height).data;
                const eyes=[];
                for(let y=0;y<head.height;y++) for(let x=0;x<head.width;x++) {
                    const i=(y*head.width+x)*4;
                    if(original[i]===83 && original[i+1]===155 && original[i+2]===220 && original[i+3]===255) eyes.push({x,y});
                }
                const startX=Math.min(...eyes.map(p=>p.x))-1,startY=Math.min(...eyes.map(p=>p.y))-1;
                let checked=0,obscured=0;
                for(let y=startY;y<head.height;y++) for(let x=startX;x<head.width;x++) {
                    const i=(y*head.width+x)*4;
                    // Source skin has near-opaque alpha; include it as well
                    // as irises. Exclude the neck where body pixels overlap.
                    if(original[i+3]<180 || body[i+3]>0) continue;
                    checked++;
                    if([0,1,2,3].some(k=>original[i+k]!==rendered[i+k])) obscured++;
                }
                return {eyeCount:eyes.length,checked,obscured};
            });
            assert.ok(face.eyeCount>=1 && face.checked>10,'the test locates the rendered face');
            assert.equal(face.obscured,0,`${length}, ${skin}, ${color}, ${key}: face remains unobscured`);
        }
    }
});

test('long hair keeps its left curtain continuous, inside the canvas, at both height endpoints',async()=>{
    await page.getByLabel('Hair Color',{exact:true}).selectOption('Blonde');
    for(const key of ['Home','End']) {
        await page.getByRole('slider',{name:'Height'}).press(key);
        for(const length of ['Chest','Waist','Knee','Floor']) {
            await page.getByLabel('Hair Length',{exact:true}).selectOption(length);
            const hair=await page.evaluate(()=>{
                const head=document.getElementById('head-layer'),canvas=document.getElementById('hair-layer');
                const headPixels=head.getContext('2d').getImageData(0,0,head.width,head.height).data;
                const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
                let headBottom=0,bottom=0,left=canvas.width,right=0;
                for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
                    if(headPixels[(y*canvas.width+x)*4+3]>150) headBottom=Math.max(headBottom,y);
                    if(pixels[(y*canvas.width+x)*4+3]>150){bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
                }
                const gaps=[];
                for(let y=headBottom+1;y<bottom-6;y++) {
                    let visible=false;
                    for(let x=0;x<72;x++) if(pixels[(y*canvas.width+x)*4+3]>150) visible=true;
                    if(!visible) gaps.push(y);
                }
                return {left,right,gaps,bottom};
            });
            assert.deepEqual(hair.gaps,[],`${length} has no left-side gaps at ${key}`);
            assert.ok(hair.left>2 && hair.right<141,'the complete hair silhouette fits inside the stage');
            assert.equal(await page.locator('#preview-status').innerText(),'');
        }
    }
});

test('independent identity and appearance survive menu, reload, and disk save round trip',async()=>{
    await page.getByRole('checkbox',{name:'Nerd',exact:true}).check();
    await page.getByRole('checkbox',{name:'Beautiful',exact:true}).check();
    await page.getByRole('spinbutton',{name:'XP allocated to Lockpicking',exact:true}).fill('150');
    await page.getByRole('spinbutton',{name:'XP allocated to Lockpicking',exact:true}).press('Tab');
    await page.getByRole('spinbutton',{name:'XP allocated to Stealth',exact:true}).fill('100');
    await page.getByRole('spinbutton',{name:'XP allocated to Stealth',exact:true}).press('Tab');
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
    assert.equal(character.breastSize,'Medium');assert.equal(character.version,3);
    assert.deepEqual(character.traits,[]);assert.ok(Object.values(character.skills).every(xp=>xp===0));
});

test('all requested traits toggle independently without inventing stat effects',async()=>{
    const names=['Nerd','Athlete','Delinquent','Promiscuous','Exhibitionist','Deviant','Beautiful','Lustful','Masochist','Sadist','Polyamorous','Nudist','Insane','Ugly','Innocent'];
    assert.equal(await page.getByRole('checkbox').count(),15);
    for(const name of names) await page.getByRole('checkbox',{name,exact:true}).check();
    assert.deepEqual((await value()).traits,names);
    await page.getByRole('checkbox',{name:'Nerd',exact:true}).uncheck();
    assert.deepEqual((await value()).traits,names.slice(1));
    assert.ok(Object.values((await value()).skills).every(xp=>xp===0),'traits have no undefined effects');
});

test('18 skills share 250 XP, cross level boundaries, reject overspending, and refund',async()=>{
    assert.equal(await page.getByRole('spinbutton').count(),18);
    const lock=page.getByRole('spinbutton',{name:'XP allocated to Lockpicking',exact:true});
    const stealth=page.getByRole('spinbutton',{name:'XP allocated to Stealth',exact:true});
    const row=page.locator('.skill-row').filter({has:lock});
    const set=async(input,xp)=>{await input.fill(String(xp));await input.press('Tab');};
    assert.equal(await page.locator('#skill-budget').textContent(),'250 / 250 XP remaining');
    await set(lock,49);assert.equal(await row.locator('.skill-level').textContent(),'Level 0 / 10');
    await set(lock,50);assert.equal(await row.locator('.skill-level').textContent(),'Level 1 / 10');
    assert.equal(await row.locator('.skill-progress-label').textContent(),'0 / 100 XP toward level 2');
    await set(lock,149);assert.equal(await row.locator('.skill-level').textContent(),'Level 1 / 10');
    await set(lock,150);assert.equal(await row.locator('.skill-level').textContent(),'Level 2 / 10');
    assert.equal(await row.locator('.skill-progress-label').textContent(),'0 / 200 XP toward level 3');
    await set(stealth,101);assert.equal((await value()).skills.Stealth,0);
    assert.match(await page.locator('.allocation-status').textContent(),/0 to 100 XP/);
    await set(stealth,100);assert.equal(await page.locator('#skill-budget').textContent(),'0 / 250 XP remaining');
    assert.ok(await page.getByRole('button',{name:'Add 10 XP to Lockpicking',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Refund 10 XP from Lockpicking',exact:true}).click();
    assert.equal(await row.locator('.skill-level').textContent(),'Level 1 / 10');
    assert.equal(await row.locator('.skill-progress-label').textContent(),'90 / 100 XP toward level 2');
    await page.getByRole('button',{name:'Add 10 XP to Stealth',exact:true}).click();
    assert.equal((await value()).skills.Stealth,110);
    for(const invalid of ['-1','1.5','']) {await set(lock,invalid);assert.equal((await value()).skills.Lockpicking,140);}
    await page.getByRole('button',{name:'Reset skill XP',exact:true}).click();
    assert.ok(Object.values((await value()).skills).every(xp=>xp===0));
    await set(lock,247);
    await page.getByRole('button',{name:'Add 10 XP to Stealth',exact:true}).click();
    assert.equal((await value()).skills.Stealth,3,'the last partial increment uses only available XP');
    assert.equal(await page.locator('#skill-budget').textContent(),'0 / 250 XP remaining');
});

test('doubling XP thresholds support all ten levels and imported builds stay within budget',async()=>{
    const results=await page.evaluate(()=>{
        const rules=SugarCube.setup.characterRules;
        let cumulative=0;const levels=[];
        for(let level=1;level<=10;level++) {
            cumulative+=50*2**(level-1);
            levels.push([rules.progress(cumulative-1).level,rules.progress(cumulative)]);
        }
        return levels;
    });
    results.forEach(([before,status],i)=>{
        assert.equal(before,i);assert.equal(status.level,i+1);assert.equal(status.xp,0);
        assert.equal(status.nextCost,i===9?null:50*2**(i+1));
    });
    await page.evaluate(()=>{
        SugarCube.State.variables.character={traits:['Nerd','Nerd','Unknown','Ugly'],skills:{Lockpicking:150.9,Stealth:999,Focus:-5,Combat:'100',Swimming:null}};
        SugarCube.Engine.play('CharacterCreation');
    });
    await page.waitForSelector('#skill-lockpicking');
    const character=await value();assert.deepEqual(character.traits,['Nerd','Ugly']);
    assert.equal(character.skills.Lockpicking,150);assert.equal(character.skills.Stealth,100);
    assert.equal(Object.values(character.skills).reduce((a,b)=>a+b,0),250);
    assert.equal(character.skills.Focus,0);assert.equal(character.skills.Combat,0);
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

test('character and stats are read-only dialogs over the unchanged Apartments screen',async()=>{
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
    await page.getByLabel('Breast Size',{exact:true}).selectOption('Large');
    await page.getByLabel('Hair Length',{exact:true}).selectOption('Floor');
    await page.getByRole('checkbox',{name:'Nerd',exact:true}).check();
    const input=page.getByRole('spinbutton',{name:'XP allocated to Lockpicking',exact:true});
    await input.fill('150');await input.press('Tab');
    const expected=await value(),sprite=await image();
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#character-canvas')?.hasAttribute('data-variation'));
    const location=await page.locator('.world-content').elementHandle();
    const history=await page.evaluate(()=>SugarCube.State.length);
    assert.equal(await image(),sprite);
    const nav=page.getByRole('navigation',{name:'Game pages'});
    const trigger=nav.getByRole('button',{name:'Character',exact:true});
    await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Character',exact:true});
    await dialog.waitFor({state:'visible'});
    assert.match(await dialog.locator('#character-details').textContent(),/Breast sizeLarge/);
    assert.equal(await dialog.locator('#character-traits').textContent(),'Nerd');
    assert.equal(await dialog.locator('input,select,textarea,[contenteditable="true"],a').count(),0,'no editing controls or links');
    assert.equal(await page.getByRole('link',{name:'Edit character',exact:true}).count(),0);
    assert.ok(await location.evaluate(node=>node===document.querySelector('.world-content')),'same location DOM remains behind the window');
    assert.equal(await page.evaluate(()=>SugarCube.State.passage),'Apartments');
    assert.equal(await page.evaluate(()=>SugarCube.State.length),history,'opening a window does not add history');
    assert.ok(await page.evaluate(()=>document.getElementById('ui-dialog').contains(document.activeElement)),'focus enters the dialog');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert.ok(await trigger.evaluate(node=>document.activeElement===node),'focus returns to Character button');
    await nav.getByRole('button',{name:'Stats',exact:true}).click();
    const stats=page.getByRole('dialog',{name:'Stats',exact:true});await stats.waitFor({state:'visible'});
    assert.equal(await stats.locator('.world-skill').count(),18);
    const lock=stats.locator('.world-skill[data-skill="Lockpicking"]');
    assert.equal(await lock.locator('.world-skill-level').textContent(),'Level 2 / 10');
    assert.equal(await lock.locator('.world-skill-xp').textContent(),'0 / 200 XP toward level 3');
    await page.getByRole('button',{name:'Close',exact:true}).click();await stats.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>SugarCube.State.passage),'Apartments');
    assert.deepEqual(await value(),expected);assert.equal(await image(),sprite);
    await trigger.click();await dialog.waitFor({state:'visible'});
    await page.mouse.click(10,10);await dialog.waitFor({state:'hidden'});
    await page.getByRole('link',{name:'Main menu',exact:true}).click();
    await page.getByRole('link',{name:'Continue',exact:true}).click();
    assert.deepEqual(await value(),expected);
});

test('world reloads and disk saves retain location and character, without persisting dialogs',async()=>{
    await page.getByRole('checkbox',{name:'Athlete',exact:true}).check();
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.getByRole('navigation',{name:'Game pages'}).getByRole('button',{name:'Stats',exact:true}).click();
    await page.getByRole('dialog',{name:'Stats',exact:true}).waitFor({state:'visible'});
    const expected=await value();
    await page.reload();await page.waitForSelector('.world-sidebar');
    assert.equal(await page.evaluate(()=>SugarCube.State.passage),'Apartments');
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.deepEqual(await value(),expected);
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'world.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.getByRole('link',{name:'Main menu',exact:true}).click();
    await page.locator('.main-menu a').filter({hasText:'Import/Export Saves'}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    await chooser.setFiles(save);await page.waitForSelector('.world-sidebar');
    assert.deepEqual(await value(),expected);
    await page.getByRole('navigation',{name:'Game pages'}).getByRole('button',{name:'Character',exact:true}).click();
    assert.equal(await page.getByRole('dialog',{name:'Character',exact:true}).locator('#character-traits').textContent(),'Athlete');
});

test('sidebar and popups fit desktop and narrow screens while keeping the world behind them',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const width of [1440,700,390,320]) {
        await page.setViewportSize({width,height:844});
        await page.evaluate(()=>document.documentElement.classList.add('large-text'));
        await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.querySelector('#story')).marginLeft)-document.querySelector('.world-sidebar').getBoundingClientRect().width)<1);
        const sidebar=await page.locator('.world-sidebar').boundingBox(),content=await page.locator('.world-content').boundingBox();
        assert.ok(sidebar.x+sidebar.width<=content.x);
        for(const name of ['Character','Stats']) {
            await page.getByRole('navigation',{name:'Game pages'}).getByRole('button',{name,exact:true}).click();
            const dialog=page.getByRole('dialog',{name,exact:true});await dialog.waitFor({state:'visible'});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} fits ${width}px`);
            const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width,'window stays within viewport');
            assert.ok(bounds.width<width,'some of the main screen remains visible around the window');
            assert.ok(await page.locator('.district-map').isVisible());
            await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
        }
    }
});

test('old Character/Stats saves return to Apartments and creation stays closed after starting',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const expected=await value();
    for(const passage of ['Character','Stats','CharacterCreation']) {
        await page.evaluate(name=>SugarCube.Engine.play(name),passage);
        await page.waitForFunction(()=>SugarCube.State.passage==='Apartments' && !!document.querySelector('.world-sidebar'));
        assert.equal(await page.locator('#character-controls').count(),0);
        assert.deepEqual(await value(),expected);
    }
});

test('Apartments has a connected 50 by 50 grid with two roads, parking, park, and four inward entrances',async()=>{
    const layout=await page.evaluate(()=>{
        const map=SugarCube.setup.worldMaps.apartments;
        const seen=new Set(),queue=[map.spawn];
        for(let i=0;i<queue.length;i++) {
            const {x,y}=queue[i],key=`${x},${y}`;
            if(seen.has(key) || !map.tileAt(x,y).walkable) continue;
            seen.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) queue.push({x:x+dx,y:y+dy});
        }
        const towardPark={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
        const sidewalks=new Set(),pathQueue=[{x:25,y:18}];
        for(let i=0;i<pathQueue.length;i++) {
            const {x,y}=pathQueue[i],key=`${x},${y}`;
            if(sidewalks.has(key) || !['path','entrance'].includes(map.tileAt(x,y).kind)) continue;
            sidewalks.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) pathQueue.push({x:x+dx,y:y+dy});
        }
        return {width:map.width,height:map.height,
            horizontal:Array.from({length:50},(_,x)=>map.tileAt(x,46).kind),
            vertical:Array.from({length:46},(_,y)=>map.tileAt(6,y).kind),
            parking:map.tileAt(13,35).kind,park:map.tileAt(28,22).kind,
            horizontalWidth:[43,44,45,46,47,48,49].map(y=>map.tileAt(30,y).kind==='road'),
            verticalWidth:[3,4,5,6,7,8,9].map(x=>map.tileAt(x,5).kind==='road'),
            parkIsUncut:Array.from({length:81},(_,i)=>map.tileAt(26+i%9,19+Math.floor(i/9)).kind).every(kind=>kind==='park'||kind==='tree'),
            ring:Array.from({length:11},(_,i)=>[[25+i,18],[25+i,28],[25,18+i],[35,18+i]]).flat().every(([x,y])=>map.tileAt(x,y).kind==='path'),
            cars:map.cars.map(car=>({area:car.width*car.height,cells:Array.from({length:car.width*car.height},(_,i)=>map.tileAt(car.x+i%car.width,car.y+Math.floor(i/car.width))).every(tile=>tile.kind==='car'&&!tile.walkable)})),
            median:map.tileAt(16,35),
            aisles:[[12,31],[21,31],[12,36],[21,36],[12,40],[21,40]].every(([x,y])=>map.tileAt(x,y).kind==='parking'&&seen.has(`${x},${y}`)),
            entrances:map.buildings.map(building=>{
                const {x,y}=building.door,[dx,dy]=towardPark[building.facing];
                return {reached:seen.has(`${x},${y}`),sidewalkConnected:sidewalks.has(`${x},${y}`),door:map.tileAt(x,y).kind,
                    outward:map.tileAt(x+dx,y+dy).walkable,inward:map.tileAt(x-dx,y-dy).walkable};
            })};
    });
    assert.equal(layout.width,50);assert.equal(layout.height,50);
    assert.ok(layout.horizontal.every(kind=>kind==='road'));assert.ok(layout.vertical.every(kind=>kind==='road'));
    assert.deepEqual(layout.horizontalWidth,[false,true,true,true,true,true,false]);
    assert.deepEqual(layout.verticalWidth,[false,true,true,true,true,true,false]);
    assert.ok(layout.parkIsUncut&&layout.ring,'sidewalk surrounds the intact park');
    assert.ok(layout.cars.length>0);for(const car of layout.cars) assert.deepEqual(car,{area:4,cells:true});
    assert.equal(layout.median.kind,'median');assert.equal(layout.median.walkable,false);assert.ok(layout.aisles);
    assert.equal(layout.parking,'parking');assert.equal(layout.park,'park');assert.equal(layout.entrances.length,4);
    for(const entrance of layout.entrances) assert.deepEqual(entrance,{reached:true,sidewalkConnected:true,door:'entrance',outward:true,inward:false});
});

test('movement buttons, keyboard, and adjacent map clicks spend one turn, scroll, and persist on reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.waitForSelector('#local-map[data-player-x]');
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const initial=await world(),local=page.locator('#local-map'),overview=page.locator('#world-map');
    const original=await local.evaluate(canvas=>canvas.toDataURL());
    const originalOverview=await overview.evaluate(canvas=>canvas.toDataURL());
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('#local-map').dataset.animating==='false');
    assert.deepEqual(await world(),{...initial,x:initial.x+1,turn:1});
    assert.notEqual(await local.evaluate(canvas=>canvas.toDataURL()),original);
    assert.notEqual(await overview.evaluate(canvas=>canvas.toDataURL()),originalOverview);
    assert.equal(Number(await local.getAttribute('data-camera-x')),initial.x+1-12);
    await page.getByRole('button',{name:'Move north',exact:true}).click();
    await page.keyboard.press('a');
    await page.waitForFunction(()=>document.querySelector('#local-map').dataset.animating==='false');
    assert.deepEqual(await world(),{...initial,y:initial.y-1,turn:3});
    const target=await local.evaluate(canvas=>{
        const r=canvas.getBoundingClientRect(),world=SugarCube.State.variables.world;
        return {x:(world.x-Number(canvas.dataset.cameraX)+1.5)/25*r.width,
            y:(world.y-Number(canvas.dataset.cameraY)+.5)/35*r.height};
    });
    await local.click({position:target});
    assert.equal((await world()).turn,4);
    const expected=await world();
    await page.reload();await page.waitForSelector('#local-map[data-player-x]');
    assert.deepEqual(await world(),expected,'the last step survives reload without leaving the location');
    await page.getByRole('button',{name:'Character',exact:true}).click();
    await page.keyboard.press('ArrowRight');await page.keyboard.press('w');
    assert.deepEqual(await world(),expected,'movement is paused while a dialog is open');
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'Main menu',exact:true}).click();
    await page.getByRole('link',{name:'Continue',exact:true}).click();
    assert.deepEqual(await world(),expected);
    const mapBox=await local.boundingBox(),worldBox=await overview.boundingBox();
    assert.ok(worldBox.y>=mapBox.y+mapBox.height,'world map sits below local map');
});

test('walls, parked cars, trees, map bounds, and distant clicks do not spend turns',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const [x,y,dx,dy] of [[30,15,0,-1],[14,32,0,1],[13,35,1,0],[27,21,0,-1],[0,0,-1,0],[49,49,1,0]]) {
        const result=await page.evaluate(({x,y,dx,dy})=>{
            SugarCube.State.variables.world={mapId:'apartments',x,y,turn:7};
            const result=SugarCube.setup.worldMovement.move(dx,dy);
            return {result,world:structuredClone(SugarCube.State.variables.world)};
        },{x,y,dx,dy});
        assert.equal(result.result.moved,false);assert.equal(result.world.turn,7);assert.equal(result.world.x,x);assert.equal(result.world.y,y);
    }
    await page.evaluate(()=>{delete SugarCube.State.variables.world;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x]');
    await page.locator('#local-map').click({position:{x:10,y:10}});
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.turn),0);
    assert.match(await page.locator('#movement-status').textContent(),/adjacent square/);
    const results=await page.evaluate(()=>{
        const cases=[undefined,{mapId:'constructor',x:NaN,y:50,turn:-1},{mapId:'apartments',x:30,y:10,turn:4}];
        return cases.map(value=>{SugarCube.State.variables.world=value;return structuredClone(SugarCube.setup.worldMovement.ensure());});
    });
    for(const result of results) {assert.equal(result.x,30);assert.equal(result.y,23);assert.equal(result.mapId,'apartments');}
    assert.equal(results[2].turn,4);
});

test('movement position and turn round-trip through disk saves',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.getByRole('button',{name:'Move north',exact:true}).click();
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'movement.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.getByRole('button',{name:'Move east',exact:true}).click();
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    await chooser.setFiles(save);await page.waitForSelector('#local-map[data-player-x]');
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),expected);
});
