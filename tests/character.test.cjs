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
beforeEach(async context=>{
    page=await browser.newPage({viewport:{width:1440,height:1100}});
    page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
    await page.goto(base);
    await page.getByRole('link',{name:'Character Creation',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#character-canvas')?.hasAttribute('data-variation'));
    // Inventory regressions use owned vehicle fixtures; security tests use the default unowned cars.
    if(/opening apartment and car doors|trunk blocks|packing rejects|inventory fits narrow|pointer drag follows|carried coffee/.test(context.name)) {
        await page.evaluate(()=>{SugarCube.State.variables.ownedVehicles=['apartments:parked-car-1','apartments:parked-car-2'];});
    }
});
afterEach(async()=>{assert.deepEqual(page.errors,[]);await page.close();});
const image=()=>page.locator('#character-canvas').evaluate(canvas=>canvas.toDataURL());
const value=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.character));

async function stableAtlas() {
    // The story margin transitions when changing from the menu to the sidebar.
    await page.locator('#story').evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
    await page.waitForFunction(()=>{const canvas=document.getElementById('world-map');return canvas&&canvas.width===Math.round(canvas.clientWidth)&&canvas.height===Math.round(canvas.clientHeight);});
}

test('fixed bases replace size controls and preserve the original male artwork',async()=>{
    assert.equal(await page.getByLabel('Body Size',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Breast Size',{exact:true}).count(),0);
    const male=await image();
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
    assert.notEqual(await image(),male);
    assert.equal(await page.locator('#character-canvas').getAttribute('data-variation'),'Female-Fixed');
    assert.equal(await page.locator('#preview-status').innerText(),'');
    await page.getByLabel('Gender',{exact:true}).selectOption('Male');
    assert.equal(await image(),male);
    assert.equal((await value()).genitals,'Male');
});

test('every eye color, hair color, hair length, and skin tone changes the pixels',async()=>{
    const fields={
        'Eye Color':['Blue','Green','Brown'],
        'Hair Color':['Blonde','Black','Brown','Orange','Gray'],
        'Hair Length':['Shaved','Ear','Neck','Chest','Waist','Knee','Floor'],
        'Skin Tone':['Pale','Tan','Olive','Dark']
    };
    for(const gender of ['Male','Female']) for(const [label,choices] of Object.entries(fields)) {
        await page.getByLabel('Gender',{exact:true}).selectOption(gender);
        const images=new Set();
        for(const choice of choices) {await page.getByLabel(label,{exact:true}).selectOption(choice);images.add(await image());}
        assert.equal(images.size,choices.length,`${gender} ${label} has distinct visual choices`);
    }
});

test('each clothing layer toggles independently on both fixed bases without changing the body',async()=>{
    for(const gender of ['Male','Female']) for(const size of ['Medium']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(gender);
        assert.equal(await page.getByLabel('Body Size',{exact:true}).count(),0);
        const body=await page.locator('#body-layer').evaluate(canvas=>canvas.toDataURL());
        for(const slot of ['top','bottoms','shoes','storage']) await page.locator(`#clothing-${slot}`).selectOption('none');
        const naked=await image();
        for(const slot of ['top','bottoms','shoes','storage']) {
            await page.locator(`#clothing-${slot}`).selectOption(({top:'shirt',bottoms:'pants',shoes:'shoes',storage:'backpack'})[slot]);
            assert.notEqual(await image(),naked,`${gender} ${size} ${slot} is visible`);
            assert.equal(await page.locator('#body-layer').evaluate(canvas=>canvas.toDataURL()),body);
            await page.locator(`#clothing-${slot}`).selectOption('none');
            assert.equal(await image(),naked);
        }
    }
});

test('both fixed bases have proportional heads',async()=>{
    for(const key of ['Male','Female']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(key);
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
    for(const key of ['Male','Female']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(key);
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

test('long hair keeps its left curtain continuous and inside the canvas on both fixed bases',async()=>{
    await page.getByLabel('Hair Color',{exact:true}).selectOption('Blonde');
    for(const key of ['Male','Female']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(key);
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
                    for(let x=0;x<144;x++) if(pixels[(y*canvas.width+x)*4+3]>150) visible=true;
                    if(!visible) gaps.push(y);
                }
                return {left,right,gaps,bottom};
            });
            assert.deepEqual(hair.gaps,[],`${length} has no left-side gaps at ${key}`);
            assert.ok(hair.left>2 && hair.right<285,'the complete hair silhouette fits inside the stage');
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
    for(const [label,choice] of Object.entries({'Gender':'Female','Genitals':'Both','Start date':'2026-06-21','Eye Color':'Green','Hair Color':'Gray','Hair Length':'Floor','Skin Tone':'Dark'})) {
        await page.getByLabel(label,{exact:true}).selectOption(choice);
    }
    await page.locator('#clothing-storage').selectOption('backpack');
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
    await page.waitForSelector('#character-gender');assert.equal((await value()).bodySize,'Medium');
    await page.evaluate(()=>{SugarCube.State.variables.character={gender:'Unknown',genitals:'Both',heightInches:900,bodyFat:'Fat'};SugarCube.Engine.play('CharacterCreation');});
    await page.waitForSelector('#character-gender');const character=await value();
    assert.equal(character.gender,'Male');assert.equal(character.genitals,'Both');assert.equal(character.bodySize,'Medium');assert.equal(character.heightInches,undefined);assert.equal(character.bodyFat,undefined);assert.deepEqual(character.clothing,{top:'shirt',bottoms:'pants',shoes:'shoes',storage:'none',handheld:'none'});
    assert.equal(character.breastSize,'Medium');assert.equal(character.version,8);
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
    assert.equal(character.skills.Focus,0);assert.equal(character.skills.Combat,undefined);assert.equal(character.skills['Melee Combat'],0);
});

test('creator fits narrow screens and large-text preference without horizontal scrolling',async()=>{
    for(const width of [390,320]) {
        await page.setViewportSize({width,height:844});
        await page.evaluate(()=>document.documentElement.classList.add('large-text'));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.equal(await page.locator('#character-controls select:visible').count(),12);
        await page.getByLabel('Gender',{exact:true}).selectOption('Female');
        assert.equal(await page.locator('#character-controls select:visible').count(),12);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.getByLabel('Gender',{exact:true}).selectOption('Male');
        await page.getByRole('link',{name:'Save & return to menu'}).click();
        assert.equal(await page.locator('.main-menu a').count(),3);
        await page.getByRole('link',{name:'Character Creation',exact:true}).click();
    }
});

test('character and stats are read-only dialogs over the unchanged Apartments screen',async()=>{
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
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
    assert.match(await dialog.locator('#character-details').textContent(),/Base modelBodysuit base/);
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
    const groups=await stats.locator('.skill-category').evaluateAll(nodes=>nodes.map(node=>({
        title:node.querySelector('h3').textContent,skills:Array.from(node.querySelectorAll('[data-skill]'),row=>row.dataset.skill)
    })));
    assert.deepEqual(groups,[
        {title:'Physical',skills:['Athleticism','Endurance','Agility','Swimming','Dancing']},
        {title:'Combat',skills:['Melee Combat','Ranged']},
        {title:'Covert',skills:['Stealth','Lockpicking']},
        {title:'Practical',skills:['Tending','Housekeeping','Medical','Crafting']},
        {title:'Social',skills:['Charm','Deception','Intimidation']},
        {title:'Mental',skills:['Perception','Focus']}
    ]);
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

test('movement buttons, keyboard, and adjacent map clicks advance five seconds, scroll, and persist on reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.waitForSelector('#local-map[data-player-x]');
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await stableAtlas();
    const initial=await world(),local=page.locator('#local-map'),overview=page.locator('#world-map');
    const original=await local.evaluate(canvas=>canvas.toDataURL());
    const originalOverview=await overview.evaluate(canvas=>canvas.toDataURL());
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('#local-map').dataset.animating==='false');
    assert.deepEqual(await world(),{...initial,x:initial.x+1,elapsedSeconds:5});
    assert.notEqual(await local.evaluate(canvas=>canvas.toDataURL()),original);
    assert.equal(await overview.evaluate(canvas=>canvas.toDataURL()),originalOverview);
    assert.equal(Number(await local.getAttribute('data-camera-x')),initial.x+1-12);
    await page.getByRole('button',{name:'Move north',exact:true}).click();
    await page.keyboard.press('a');
    await page.waitForFunction(()=>document.querySelector('#local-map').dataset.animating==='false');
    assert.deepEqual(await world(),{...initial,y:initial.y-1,elapsedSeconds:15});
    const target=await local.evaluate(canvas=>{
        const r=canvas.getBoundingClientRect(),world=SugarCube.State.variables.world;
        return {x:(world.x-Number(canvas.dataset.cameraX)+1.5)/25*r.width,
            y:(world.y-Number(canvas.dataset.cameraY)+.5)/35*r.height};
    });
    await local.click({position:target});
    assert.equal((await world()).elapsedSeconds,20);
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

test('walls, parked cars, trees, map bounds, and distant clicks do not advance time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const [x,y,dx,dy] of [[30,15,0,-1],[14,32,0,1],[13,35,1,0],[27,21,0,-1],[0,0,-1,0],[49,49,1,0]]) {
        const result=await page.evaluate(({x,y,dx,dy})=>{
            SugarCube.State.variables.world={mapId:'apartments',x,y,elapsedSeconds:35};
            const result=SugarCube.setup.worldMovement.move(dx,dy);
            return {result,world:structuredClone(SugarCube.State.variables.world)};
        },{x,y,dx,dy});
        assert.equal(result.result.moved,false);assert.equal(result.world.elapsedSeconds,35);assert.equal(result.world.x,x);assert.equal(result.world.y,y);
    }
    await page.evaluate(()=>{delete SugarCube.State.variables.world;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x]');
    await page.locator('#local-map').click({position:{x:10,y:10}});
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
    assert.match(await page.locator('#movement-status').textContent(),/adjacent square/);
    const results=await page.evaluate(()=>{
        const cases=[undefined,{mapId:'constructor',x:NaN,y:50,elapsedSeconds:-1},{mapId:'apartments',x:30,y:10,elapsedSeconds:20}];
        return cases.map(value=>{SugarCube.State.variables.world=value;return structuredClone(SugarCube.setup.worldMovement.ensure());});
    });
    for(const result of results) {assert.equal(result.x,30);assert.equal(result.y,23);assert.equal(result.mapId,'apartments');}
    assert.equal(results[2].elapsedSeconds,20);
});

test('movement position and time round-trip through disk saves',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.getByRole('button',{name:'Move north',exact:true}).click();
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'movement.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.getByRole('button',{name:'Move east',exact:true}).click();
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    const previousMap=await page.locator('#local-map').elementHandle();
    await chooser.setFiles(save);
    // Disk import is asynchronous; an unchanged selector can match the old map.
    await page.waitForFunction(previous=>document.getElementById('local-map')!==previous,previousMap);
    await page.waitForSelector('#local-map[data-player-x]');
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),expected);
});

test('held keys move at a controlled pace, stop on release/blur/dialogs, and respect obstacles',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const initial=await world();
    await page.keyboard.down('ArrowRight');assert.equal((await world()).elapsedSeconds,5);
    await page.clock.runFor(199);assert.equal((await world()).elapsedSeconds,5);
    await page.clock.runFor(1);assert.equal((await world()).elapsedSeconds,10);
    // Native keyboard repeats cannot speed up the game's own timer.
    await page.keyboard.down('ArrowRight');assert.equal((await world()).elapsedSeconds,10);
    await page.clock.runFor(400);assert.equal((await world()).elapsedSeconds,20);
    await page.keyboard.up('ArrowRight');
    const released=await world();assert.equal(released.x,initial.x+4);
    await page.clock.runFor(800);assert.deepEqual(await world(),released);
    await page.keyboard.down('s');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    const blurred=await world();await page.clock.runFor(600);assert.deepEqual(await world(),blurred);
    await page.keyboard.up('s');
    await page.keyboard.down('s');
    await page.getByRole('button',{name:'Character',exact:true}).click();
    const paused=await world();await page.clock.runFor(600);assert.deepEqual(await world(),paused);
    await page.keyboard.up('s');await page.keyboard.press('Escape');
    await page.evaluate(()=>{
        SugarCube.State.variables.world={version:1,mapId:'apartments',x:30,y:16,elapsedSeconds:0};
        SugarCube.Engine.play('Apartments');
    });
    await page.waitForSelector('#local-map[data-player-y="16"]');
    await page.keyboard.down('w');await page.clock.runFor(1000);await page.keyboard.up('w');
    assert.equal((await world()).elapsedSeconds,5);assert.equal((await world()).y,15);
    assert.match(await page.locator('#movement-status').textContent(),/blocks the way/);
});

test('holding a direction button repeats without an extra release step and cleans up on navigation',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const east=page.getByRole('button',{name:'Move east',exact:true});
    const bounds=await east.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.mouse.down();assert.equal((await world()).elapsedSeconds,5);
    await page.clock.runFor(600);assert.equal((await world()).elapsedSeconds,20);
    await page.mouse.up();const released=await world();
    await page.clock.runFor(600);assert.deepEqual(await world(),released,'release does not add a click step');
    const south=page.getByRole('button',{name:'Move south',exact:true});
    await south.evaluate(button=>button.addEventListener('pointerdown',event=>{button.dataset.testPointer=event.pointerId;},{once:true}));
    const southBounds=await south.boundingBox();await page.mouse.move(southBounds.x+southBounds.width/2,southBounds.y+southBounds.height/2);
    await page.mouse.down();
    await south.dispatchEvent('pointercancel',{pointerId:Number(await south.getAttribute('data-test-pointer'))});
    await page.mouse.up();
    const cancelled=await world();await page.clock.runFor(600);assert.deepEqual(await world(),cancelled);
    await page.keyboard.down('s');
    await page.getByRole('link',{name:'Main menu',exact:true}).click();
    const left=await world();await page.clock.runFor(600);assert.deepEqual(await world(),left);
    await page.keyboard.up('s');
    await page.getByRole('link',{name:'Continue',exact:true}).click();
    await page.keyboard.press('s');assert.equal((await world()).elapsedSeconds,left.elapsedSeconds+5,'no stale or duplicated repeat listeners');
});

test('held directions alternate at one shared pace and releasing a key resumes the others',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const initial=await world();
    await page.keyboard.down('ArrowUp');
    assert.deepEqual(await world(),{...initial,y:22,elapsedSeconds:5});
    await page.keyboard.down('w'); // An alias must not give north extra turns.
    await page.keyboard.down('ArrowRight');
    assert.equal((await world()).elapsedSeconds,5,'adding held keys does not add immediate steps');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:31,y:22,elapsedSeconds:10});
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:31,y:21,elapsedSeconds:15});
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:32,y:21,elapsedSeconds:20});
    await page.keyboard.up('ArrowRight');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:32,y:20,elapsedSeconds:25},'the original Up key resumes when Right is released');
    await page.keyboard.up('ArrowUp');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:32,y:19,elapsedSeconds:30},'W remains active after the other keys are released');
    await page.keyboard.up('w');const released=await world();
    await page.clock.runFor(600);assert.deepEqual(await world(),released);
    await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowRight');
    assert.equal((await world()).x,31);
    await page.clock.runFor(200);assert.equal((await world()).x,32);
    await page.clock.runFor(200);assert.equal((await world()).x,31,'opposite directions also alternate');
    await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
});

test('a blocked held direction remains active and can resume after another direction clears it',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{
        SugarCube.State.variables.world={version:1,mapId:'apartments',x:26,y:20,elapsedSeconds:0};
        SugarCube.Engine.play('Apartments');
    });
    await page.waitForSelector('#local-map[data-player-x="26"]');
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.keyboard.down('d');await page.clock.runFor(400);
    assert.equal((await world()).elapsedSeconds,0,'the tree blocks east without advancing time');
    await page.keyboard.down('s');await page.clock.runFor(200);
    assert.equal((await world()).y,21);assert.equal((await world()).elapsedSeconds,5);
    await page.clock.runFor(200);assert.equal((await world()).x,27);assert.equal((await world()).elapsedSeconds,10,'east is still held and now unblocked');
    await page.keyboard.up('s');await page.clock.runFor(200);
    assert.equal((await world()).x,28);assert.equal((await world()).elapsedSeconds,15);
    await page.keyboard.up('d');const released=await world();
    await page.clock.runFor(600);assert.deepEqual(await world(),released);
});

test('interaction reach uses door squares and full car footprints, excluding diagonals',async()=>{
    const reach=await page.evaluate(()=>{
        const api=SugarCube.setup.interactions,map=SugarCube.setup.worldMaps.apartments;
        const has=(id,x,y)=>api.nearby({mapId:'apartments',x,y}).some(target=>target.object.id===id);
        return {count:map.interactables.length,unique:new Set(map.interactables.map(object=>object.id)).size,
            doorAdjacent:has('apartment-door-1',30,16),doorOn:has('apartment-door-1',30,15),doorDiagonal:has('apartment-door-1',31,16),
            carLeft:has('parked-car-1',10,28),carRight:has('parked-car-1',13,29),carBelow:has('parked-car-1',12,30),carDiagonal:has('parked-car-1',13,30)};
    });
    assert.deepEqual(reach,{count:13,unique:13,doorAdjacent:true,doorOn:true,doorDiagonal:false,carLeft:true,carRight:true,carBelow:true,carDiagonal:false});
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'Interact [E]',exact:true}).isDisabled());
    await page.keyboard.press('e');assert.equal(await page.getByRole('dialog').count(),0);
    assert.match(await page.locator('#movement-status').textContent(),/Nothing to interact/);
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
});

test('E opens a door action window over the location and pauses held movement without advancing time',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(let i=0;i<7;i++) await page.keyboard.press('w');
    assert.equal(await page.locator('#interaction-hint').textContent(),'Apartment 1 door');
    assert.ok(await page.getByRole('button',{name:'Interact [E]',exact:true}).isEnabled());
    await page.keyboard.down('w');
    const expected=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),length:SugarCube.State.length}));
    const location=await page.locator('.world-content').elementHandle();
    await page.keyboard.press('e');
    const dialog=page.getByRole('dialog',{name:'Interact',exact:true});await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.getByRole('heading',{name:'Apartment 1 door',exact:true}).count(),1);
    assert.ok(await dialog.getByRole('button',{name:'Open',exact:true}).isEnabled());
    await dialog.getByRole('button',{name:'Knock',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'You knock on the door.');
    await page.clock.runFor(800);await page.keyboard.up('w');
    assert.deepEqual(await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),length:SugarCube.State.length})),expected);
    assert.ok(await location.evaluate(node=>node===document.querySelector('.world-content')));
    assert.equal(await page.evaluate(()=>SugarCube.State.passage),'Apartments');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Interact [E]',exact:true}).click();await dialog.waitFor({state:'visible'});
});

test('car actions, nearby object selection, ground objects, and NPC definitions share one interaction system',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=13;SugarCube.State.variables.world.y=29;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="13"]');
    await page.keyboard.press('e');
    const dialog=page.getByRole('dialog',{name:'Interact',exact:true});await dialog.waitFor({state:'visible'});
    await dialog.getByRole('button',{name:'Look through window',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/No one is inside/);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
        const map=SugarCube.setup.worldMaps.apartments;
        map.interactables.push({id:'test-note',name:'Folded note',kind:'ground',x:30,y:23,
            actions:[{id:'read',label:'Read',result:'A short handwritten message.'}]},
            {id:'test-resident',name:'Test resident',kind:'npc',x:31,y:23,description:'A resident standing nearby.'});
        SugarCube.State.variables.world.x=30;SugarCube.State.variables.world.y=23;SugarCube.Engine.play('Apartments');
    });
    await page.waitForSelector('#local-map[data-player-x="30"]');
    assert.equal(await page.locator('#interaction-hint').textContent(),'2 objects nearby');
    await page.keyboard.press('e');await dialog.waitFor({state:'visible'});
    await dialog.getByRole('button',{name:'Test resident',exact:true}).click();
    await dialog.getByRole('button',{name:'Inspect',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'A resident standing nearby.');
    await dialog.getByRole('button',{name:'Back to nearby objects',exact:true}).click();
    await dialog.getByRole('button',{name:'Folded note',exact:true}).click();
    await dialog.getByRole('button',{name:'Read',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'A short handwritten message.');
    await page.evaluate(()=>{SugarCube.State.variables.world.x=40;SugarCube.State.variables.world.y=40;});
    await dialog.getByRole('button',{name:'Read',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/no longer within reach/);
});


test('opening apartment and car doors updates both maps and persists across movement, reload, and disk saves',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=30;SugarCube.State.variables.world.y=16;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="16"]');
    await stableAtlas();
    const pixels=()=>page.locator('#local-map').evaluate(canvas=>canvas.toDataURL());
    const closed=await pixels();
    const overviewClosed=await page.locator('#world-map').evaluate(canvas=>canvas.toDataURL());
    const elapsedSeconds=await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'You open the door.');
    await dialog.locator('.interaction-actions').getByRole('button',{name:'Close',exact:true}).waitFor({state:'visible'});assert.equal(await dialog.getByRole('button',{name:'Open',exact:true}).count(),0);
    assert.notEqual(await pixels(),closed,'open door is drawn on the map');
    assert.equal(await page.locator('#world-map').evaluate(canvas=>canvas.toDataURL()),overviewClosed,'world atlas stays independent of local doors');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),elapsedSeconds);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map[data-player-y="16"]');
    assert.notEqual(await pixels(),closed,'open appearance survives reload');
    await page.keyboard.press('e');await dialog.locator('.interaction-actions').getByRole('button',{name:'Close',exact:true}).waitFor({state:'visible'});assert.equal(await dialog.getByRole('button',{name:'Open',exact:true}).count(),0);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{SugarCube.State.variables.world.x=13;SugarCube.State.variables.world.y=29;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="13"]');
    const carClosed=await pixels();
    await page.keyboard.press('e');await dialog.getByRole('button',{name:'Open door',exact:true}).click();
    assert.equal(await dialog.getByRole('button',{name:'Open door',exact:true}).count(),0);assert.ok(await dialog.getByRole('button',{name:'Close door',exact:true}).isVisible());
    assert.notEqual(await pixels(),carClosed);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Move south',exact:true}).click();
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.openedObjects));
    assert.deepEqual(expected,{'apartments:apartment-door-1':true,'lock:building-1':true,'apartments:parked-car-1':true,'lock:vehicle:apartments:parked-car-1':true});
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'interactions.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.evaluate(()=>{SugarCube.State.variables.openedObjects={};});
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    await chooser.setFiles(save);await page.waitForFunction(()=>SugarCube.State.variables.openedObjects?.['apartments:apartment-door-1']===true);
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.openedObjects)),expected);
});

test('car edges restrict side actions, rear trunk access, front access, and diagonals',async()=>{
    const edges=await page.evaluate(()=>{
        const setup=SugarCube.setup, map=setup.worldMaps.apartments, car=map.interactables.find(object=>object.kind==='car');
        const cases=[[10,28],[10,29],[13,28],[13,29],[11,30],[12,30],[11,27],[12,27],[10,30],[13,30],[10,27],[13,27]];
        return cases.map(([x,y])=>{
            const world={mapId:'apartments',x,y};
            return {x,y,actions:setup.interactions.actionsFor(car,world).map(action=>action.id),near:setup.interactions.nearby(world).some(target=>target.object.id===car.id)};
        });
    });
    edges.slice(0,4).forEach(edge=>{assert.deepEqual(edge.actions,['look-inside','open','unlock','lockpick']);assert.ok(edge.near);});
    edges.slice(4,6).forEach(edge=>{assert.deepEqual(edge.actions,['trunk','unlock','lockpick']);assert.ok(edge.near);});
    edges.slice(6).forEach(edge=>{assert.deepEqual(edge.actions,[]);assert.equal(edge.near,false);});
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const rejected=await page.evaluate(()=>{
        SugarCube.State.variables.world.x=12;SugarCube.State.variables.world.y=30;
        return SugarCube.setup.interactions.run('parked-car-1','open');
    });assert.equal(rejected.ok,false);
});

test('no equipment means no invisible storage; shoes add none and a backpack adds sixteen blocks',async()=>{
    for(const slot of ['top','bottoms','shoes','storage']) await page.locator(`#clothing-${slot}`).selectOption('none');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const location=await page.locator('.world-content').elementHandle();
    const history=await page.evaluate(()=>SugarCube.State.length);
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Inventory',exact:true});await dialog.waitFor({state:'visible'});
    assert.match(await dialog.textContent(),/No carrying space/);assert.equal(await dialog.locator('.inventory-grid').count(),0);
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.inventory.worn()),[]);
    assert.deepEqual(await page.evaluate(()=>SugarCube.State.variables.inventory.containers),{});
    assert.equal(await page.evaluate(()=>SugarCube.State.length),history);
    assert.ok(await location.evaluate(node=>node===document.querySelector('.world-content')));
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    const capacities=await page.evaluate(()=>{
        const setup=SugarCube.setup, character=SugarCube.State.variables.character;
        character.clothing.shoes='shoes';const shoes=setup.inventory.worn();
        character.clothing.storage='backpack';const backpack=setup.inventory.worn();
        return {shoes,backpack};
    });
    assert.deepEqual(capacities.shoes,[]);assert.equal(capacities.backpack.length,1);
    assert.equal(capacities.backpack[0].columns*capacities.backpack[0].rows,16);
});

test('trunk blocks support UI transfers, reject insufficient space, and persist without restocking',async()=>{
    await page.locator('#clothing-storage').selectOption('backpack');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=12;SugarCube.State.variables.world.y=30;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="30"]');
    const elapsedSeconds=await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds);
    await page.keyboard.press('e');
    const actions=page.getByRole('dialog',{name:'Interact',exact:true});
    assert.equal(await actions.getByRole('button',{name:'Look through window',exact:true}).count(),0);
    assert.equal(await actions.getByRole('button',{name:'Open door',exact:true}).count(),0);
    await actions.getByRole('button',{name:'Open trunk',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await dialog.waitFor({state:'visible'});
    const trunk=dialog.locator('[data-container="trunk:apartments:parked-car-1"]');
    const shirt=dialog.locator('[data-container="worn:shirt"]'), pants=dialog.locator('[data-container="worn:pants:1"]'), backpack=dialog.locator('[data-container="worn:backpack"]');
    assert.equal(await trunk.locator('.inventory-item').count(),3);
    await trunk.getByRole('button',{name:/Tool kit,/}).click();
    await shirt.locator('[data-x="0"][data-y="0"]').click();
    assert.match(await dialog.locator('#inventory-status').textContent(),/Not enough adjoining/);
    assert.equal(await trunk.locator('.inventory-item').count(),3);
    await pants.locator('[data-x="0"][data-y="0"]').click();
    assert.match(await dialog.locator('#inventory-status').textContent(),/Not enough adjoining/);
    await backpack.locator('[data-x="0"][data-y="0"]').click();
    assert.equal(await backpack.locator('.storage-count').textContent(),'4 / 16 blocks');
    await trunk.getByRole('button',{name:/Water bottle,/}).click();
    await backpack.locator('[data-x="2"][data-y="0"]').click();
    await trunk.getByRole('button',{name:/Cleaning cloth,/}).click();
    await shirt.locator('[data-x="0"][data-y="0"]').click();
    assert.equal(await trunk.locator('.inventory-item').count(),0);
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),elapsedSeconds);
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory));
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.reload();await page.waitForSelector('#local-map[data-player-y="30"]');
    await page.keyboard.press('e');await actions.getByRole('button',{name:'View trunk inventory',exact:true}).click();await dialog.waitFor({state:'visible'});
    assert.equal(await trunk.locator('.inventory-item').count(),0,'an emptied trunk never restocks');
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory)),expected);
    await backpack.getByRole('button',{name:/Tool kit,/}).click();
    await trunk.locator('[data-x="2"][data-y="1"]').click();
    assert.equal(await trunk.locator('.inventory-item').count(),1,'items can be returned to the trunk');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const player=page.getByRole('dialog',{name:'Inventory',exact:true});await player.waitFor({state:'visible'});
    assert.equal(await player.locator('[data-container^="trunk:"]').count(),0);
    assert.equal(await player.locator('.inventory-item').count(),2);
    await page.keyboard.press('Escape');await player.waitFor({state:'hidden'});
    const portable=await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory));
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'inventory.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.evaluate(()=>{delete SugarCube.State.variables.inventory;});
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);
    await chooser.setFiles(save);await page.waitForFunction(()=>SugarCube.State.variables.inventory?.containers['worn:backpack']?.length===1);
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory)),portable);
});

test('packing rejects overlap, overflow, fractional positions, remote trunks and unworn storage without losing items',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const results=await page.evaluate(()=>{
        const {State,setup}=SugarCube;State.variables.world.x=12;State.variables.world.y=30;
        const inv=setup.inventory, container=inv.openTrunk('parked-car-1');
        const item=inv.placements(container)[0];const before=JSON.stringify(State.variables.inventory);
        const attempts=[
            inv.transfer(container.id,container.id,item.id,2,0,'parked-car-1'),
            inv.transfer(container.id,container.id,item.id,5,3,'parked-car-1'),
            inv.transfer(container.id,container.id,item.id,.5,1,'parked-car-1'),
            inv.transfer(container.id,'worn:backpack',item.id,0,0,'parked-car-1')
        ];
        const unchanged=before===JSON.stringify(State.variables.inventory);
        State.variables.world.x=13;State.variables.world.y=29;
        const remote=inv.transfer(container.id,'worn:pants:1',item.id,0,0,'parked-car-1');
        return {attempts,unchanged,remote,finalUnchanged:before===JSON.stringify(State.variables.inventory)};
    });
    assert.ok(results.attempts.every(result=>!result.ok));assert.ok(results.unchanged);assert.equal(results.remote.ok,false);assert.ok(results.finalUnchanged);
});

test('inventory fits narrow screens and large text and blocks movement while open',async()=>{
    await page.locator('#clothing-storage').selectOption('backpack');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=12;SugarCube.State.variables.world.y=30;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="30"]');
    await page.keyboard.press('e');await page.getByRole('button',{name:'Open trunk',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await dialog.waitFor({state:'visible'});
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.keyboard.press('ArrowDown');assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),expected);
    for(const width of [1440,700,390,320]) {
        await page.setViewportSize({width,height:844});await page.evaluate(()=>document.documentElement.classList.add('large-text'));
        // SugarCube repositions its fixed dialog after a resize. Its old
        // left/right insets can temporarily collapse the wrapper to zero width.
        await page.waitForFunction(()=>{
            const node=document.getElementById('ui-dialog'),rect=node?.getBoundingClientRect();
            return node?.clientWidth>0 && rect.left>=0 && rect.right<=innerWidth;
        });
        const layout=await dialog.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth,
            overflow:Array.from(node.querySelectorAll('*')).filter(child=>child.scrollWidth>child.clientWidth+1).map(child=>({tag:child.tagName,cls:child.className,client:child.clientWidth,scroll:child.scrollWidth}))}));
        assert.ok(layout.scroll<=layout.client,`dialog has no horizontal overflow at ${width}: ${JSON.stringify(layout)}`);
        const grid=await dialog.locator('.inventory-grid').first().boundingBox();const bounds=await dialog.boundingBox();
        assert.ok(grid.x>=bounds.x && grid.x+grid.width<=bounds.x+bounds.width+1,`trunk grid stays inside dialog at ${width}`);
    }
});

test('five clothing dropdown categories grant one shirt pocket and four independent pants pockets',async()=>{
    const categories={top:'Top',bottoms:'Bottoms',shoes:'Shoes',storage:'Wearable Storage',handheld:'Handheld'};
    for(const [slot,label] of Object.entries(categories)) assert.equal(await page.getByRole('combobox',{name:label,exact:true}).getAttribute('id'),`clothing-${slot}`);
    assert.equal(await page.locator('#character-controls input[type="checkbox"]').count(),15,'clothing adds no checkboxes');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const pockets=await page.evaluate(()=>SugarCube.setup.inventory.worn());
    assert.equal(pockets.length,5);assert.ok(pockets.every(pocket=>pocket.columns===1 && pocket.rows===1));
    assert.equal(new Set(pockets.map(pocket=>pocket.id)).size,5);
    assert.equal(await page.locator('.pocket-group .inventory-grid').count(),4);
    const result=await page.evaluate(()=>{
        const inv=SugarCube.setup.inventory;
        return inv.fits(inv.worn().find(pocket=>pocket.id==='worn:pants:1'),{type:'tools'},0,0);
    });assert.equal(result,false,'four separate pockets never combine into a 2 by 2 space');
});

test('pointer drag follows the mouse, drops into storage, and preserves items on invalid/outside drops',async()=>{
    await page.locator('#clothing-storage').selectOption('backpack');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=12;SugarCube.State.variables.world.y=30;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="30"]');await page.keyboard.press('e');await page.getByRole('button',{name:'Open trunk',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await dialog.waitFor({state:'visible'});
    const trunk=dialog.locator('[data-container="trunk:apartments:parked-car-1"]'),bag=dialog.locator('[data-container="worn:backpack"]');
    const tool=trunk.getByRole('button',{name:/Tool kit,/});const start=await tool.boundingBox();
    await page.mouse.move(start.x+6,start.y+6);await page.mouse.down();await page.mouse.move(start.x+46,start.y+26,{steps:3});
    const ghost=page.locator('.inventory-drag-ghost');await ghost.waitFor({state:'visible'});
    const floating=await ghost.boundingBox();assert.ok(Math.abs(floating.x-(start.x+40))<1 && Math.abs(floating.y-(start.y+20))<1,'item stays at the grabbed mouse offset');
    const target=await bag.locator('[data-x="0"][data-y="0"]').boundingBox();
    await page.mouse.move(target.x+6,target.y+6,{steps:5});assert.equal(await ghost.getAttribute('data-valid'),'true');await page.mouse.up();
    assert.equal(await ghost.count(),0);assert.equal(await bag.locator('.inventory-item').count(),1);assert.equal(await trunk.locator('.inventory-item').count(),2);
    const before=await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.inventory));
    const moved=await bag.getByRole('button',{name:/Tool kit,/}).boundingBox(),pocket=await dialog.locator('[data-container="worn:pants:1"] .inventory-cell').boundingBox();
    await page.mouse.move(moved.x+6,moved.y+6);await page.mouse.down();await page.mouse.move(pocket.x+6,pocket.y+6,{steps:5});
    assert.equal(await ghost.getAttribute('data-valid'),'false');await page.mouse.up();
    assert.equal(await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.inventory)),before);
    assert.match(await dialog.locator('#inventory-status').textContent(),/Not enough adjoining/);
    const still=await bag.getByRole('button',{name:/Tool kit,/}).boundingBox();
    await page.mouse.move(still.x+6,still.y+6);await page.mouse.down();await page.mouse.move(5,5,{steps:5});await page.mouse.up();
    assert.equal(await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.inventory)),before);assert.equal(await ghost.count(),0);
    const cloth=trunk.getByRole('button',{name:/Cleaning cloth,/});assert.equal(await cloth.textContent(),'Cloth');assert.equal(await cloth.getAttribute('title'),'Cleaning cloth');
    assert.equal(await cloth.evaluate(node=>getComputedStyle(node).whiteSpace),'nowrap');
    const again=await bag.getByRole('button',{name:/Tool kit,/}).boundingBox();
    await page.mouse.move(again.x+6,again.y+6);await page.mouse.down();await page.mouse.move(again.x+25,again.y+25);await ghost.waitFor({state:'visible'});
    await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await ghost.count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('inventory-dragging')),false);
    assert.equal(await page.evaluate(()=>JSON.stringify(SugarCube.State.variables.inventory)),before);
});

test('legacy clothing and oversized old pocket contents migrate without hidden storage or lost items',async()=>{
    await page.evaluate(()=>{
        const {State,setup}=SugarCube;
        State.variables.character.clothing={shirt:true,pants:true,shoes:true,backpack:false};
        State.variables.character.version=4;
        State.variables.inventory={version:1,containers:{
            'worn:shirt':[{id:'trunk:apartments:parked-car-1:cloth',type:'cloth',x:1,y:0}],
            'worn:pants':[{id:'trunk:apartments:parked-car-1:tools',type:'tools',x:0,y:0}],
            'trunk:apartments:parked-car-1':[{id:'trunk:apartments:parked-car-1:water',type:'water',x:0,y:0}]
        }};
        setup.character.ensure();
    });
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    assert.match(await page.locator('.inventory-migration').textContent(),/Tool kit → Parked car 1 trunk/);
    const migrated=await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory));
    assert.equal(migrated.version,2);assert.equal(migrated.containers['worn:pants'],undefined);
    const items=Object.values(migrated.containers).flat();assert.equal(items.length,3);assert.equal(new Set(items.map(item=>item.id)).size,3);
    assert.equal(migrated.containers['worn:shirt'].length,1);assert.equal(migrated.containers['trunk:apartments:parked-car-1'].length,2);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Move south',exact:true}).click();await page.reload();await page.waitForSelector('#local-map');
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.inventory)),migrated);
});

test('detailed sprite rendering uses crisp opaque pixels at native preview resolution',async()=>{
    for(const gender of ['Male','Female']) for(const size of ['Medium']) {
        await page.getByLabel('Gender',{exact:true}).selectOption(gender);assert.equal(await page.getByLabel('Body Size',{exact:true}).count(),0);
        const result=await page.locator('#character-canvas').evaluate(canvas=>{
            const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            let soft=0;for(let i=3;i<pixels.length;i+=4) if(pixels[i]!==0 && pixels[i]!==255) soft++;
            return {width:canvas.width,height:canvas.height,soft,smoothing:canvas.getContext('2d').imageSmoothingEnabled};
        });
        assert.deepEqual(result,{width:288,height:416,soft:0,smoothing:false},`${gender} ${size} has no blurred alpha edges`);
    }
});

test('legacy female size fields normalize to the fixed base without affecting equipment or skills',async()=>{
    const result=await page.evaluate(()=>SugarCube.setup.character.normalize({gender:'Female',bodySize:'Large',breastSize:'Small',
        clothing:{top:'none',bottoms:'pants',shoes:'none',storage:'backpack',handheld:'none'},skills:{Focus:150},traits:['Nerd']}));
    assert.equal(result.version,8);assert.equal(result.bodySize,'Medium');assert.equal(result.breastSize,'Medium');
    assert.equal(result.clothing.storage,'backpack');assert.equal(result.clothing.top,'none');
    assert.equal(result.skills.Focus,150);assert.deepEqual(result.traits,['Nerd']);
});

test('cars park nose-in toward bay ends and expose trunks to the driving aisles',async()=>{
    const results=await page.evaluate(()=>{
        const {setup}=SugarCube,map=setup.worldMaps.apartments;
        return map.cars.map((car,index)=>{
            const object=map.interactables.find(object=>object.id===`parked-car-${index+1}`);
            const bay=map.parkingBays.find(bay=>bay.x===car.x && bay.y===car.y);
            const rear={mapId:map.id,x:car.x,y:car.facing==='north'?car.y+car.height:car.y-1};
            const front={mapId:map.id,x:car.x,y:car.facing==='north'?car.y-1:car.y+car.height};
            const side={mapId:map.id,x:car.x-1,y:car.y};
            return {y:car.y,facing:car.facing,bay:bay.facing,object:object.facing,rearWalkable:map.tileAt(rear.x,rear.y).walkable,
                rear:setup.interactions.actionsFor(object,rear).map(action=>action.id),front:setup.interactions.actionsFor(object,front),
                side:setup.interactions.actionsFor(object,side).map(action=>action.id)};
        });
    });
    assert.equal(results.length,8);
    for(const car of results) {
        const expected=[28,37].includes(car.y)?'north':'south';
        assert.equal(car.facing,expected);assert.equal(car.bay,expected);assert.equal(car.object,expected);
        assert.ok(car.rearWalkable,'trunk can be reached from the aisle');assert.deepEqual(car.rear,['trunk','unlock','lockpick']);assert.deepEqual(car.front,[]);assert.deepEqual(car.side,['look-inside','open','unlock','lockpick']);
    }
    const headings=await page.evaluate(()=>{
        const {setup}=SugarCube,car={kind:'car',x:10,y:10,width:2,height:2};
        const points={north:{x:10,y:9},east:{x:12,y:10},south:{x:10,y:12},west:{x:9,y:10}};
        return Object.keys(points).map(facing=>({facing,edges:Object.fromEntries(Object.entries(points).map(([side,position])=>[side,setup.vehicles.edge({...car,facing},position)]))}));
    });
    const opposite={north:'south',south:'north',east:'west',west:'east'};
    for(const result of headings) {assert.equal(result.edges[result.facing],'front');assert.equal(result.edges[opposite[result.facing]],'rear');assert.equal(Object.values(result.edges).filter(edge=>edge==='side').length,2);}
});

test('parked car headlights and taillights render in the same direction used by interactions',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=16;SugarCube.State.variables.world.y=34;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="16"]');
    const lamps=await page.evaluate(()=>{
        const canvas=document.getElementById('local-map'),ctx=canvas.getContext('2d');
        const ox=Number(canvas.dataset.cameraX)*16,oy=Number(canvas.dataset.cameraY)*16;
        return SugarCube.setup.worldMaps.apartments.cars.map(car=>{
            const north=car.facing==='north',x=car.x*16-ox,y=car.y*16-oy;
            return {front:Array.from(ctx.getImageData(x+(north?8:23),y+(north?3:28),1,1).data),
                rear:Array.from(ctx.getImageData(x+(north?8:23),y+(north?29:3),1,1).data)};
        });
    });
    for(const lamp of lamps) {assert.deepEqual(lamp.front,[233,227,186,255]);assert.deepEqual(lamp.rear,[182,106,97,255]);}
});

test('female shirt and pants are separate assets with no cross-garment pixels',async()=>{
    await page.getByLabel('Gender',{exact:true}).selectOption('Female');
    for(const slot of ['top','bottoms','shoes','storage']) await page.locator(`#clothing-${slot}`).selectOption('none');
    const base=await page.locator('#body-layer').evaluate(canvas=>canvas.toDataURL());
    const bounds=async()=>page.locator('#clothing-layer').evaluate(canvas=>{
        const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let min=canvas.height,max=0,count=0;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(data[(y*canvas.width+x)*4+3]) {min=Math.min(min,y);max=Math.max(max,y);count++;}
        return {min,max,count};
    });
    await page.locator('#clothing-top').selectOption('shirt');const shirt=await bounds();
    assert.ok(shirt.count>500);assert.ok(shirt.min>90 && shirt.max<210,'shirt contains no waistband or legs');
    await page.locator('#clothing-top').selectOption('none');await page.locator('#clothing-bottoms').selectOption('pants');
    const pants=await bounds();assert.ok(pants.count>1000);assert.ok(pants.min>180 && pants.max>350,'pants contain no shirt');
    assert.equal(await page.locator('#body-layer').evaluate(canvas=>canvas.toDataURL()),base);
});

// Reuse actual movement rules when traversing the larger world in integration checks.
async function walkTo(x,y) {
    const result=await page.evaluate(({x,y})=>{
        const {setup,State}=SugarCube,world=State.variables.world,map=setup.worldMaps[world.mapId];
        const queue=[{x:world.x,y:world.y,path:[]}],seen=new Set();
        for(let i=0;i<queue.length;i++) {
            const current=queue[i],key=`${current.x},${current.y}`;
            if(seen.has(key)||!map.tileAt(current.x,current.y).walkable) continue;
            seen.add(key);
            if(current.x===x&&current.y===y) {
                for(const [dx,dy] of current.path) {const step=setup.worldMovement.move(dx,dy);if(!step.moved) return step;}
                SugarCube.Engine.play('Apartments');return {moved:true};
            }
            for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) queue.push({x:current.x+dx,y:current.y+dy,path:[...current.path,[dx,dy]]});
        }
        return {moved:false,reason:'No connected walking route'};
    },{x,y});
    assert.ok(result.moved,result.reason);
    await page.waitForFunction(({x,y})=>{const map=document.getElementById('local-map');return Number(map?.dataset.playerX)===x&&Number(map?.dataset.playerY)===y;},{x,y});
}
async function openPortal(label,mapId) {
    const name=await page.evaluate(label=>SugarCube.setup.interactions.nearby().find(target=>target.object.destination&&!!target.object.exit===(label==='Exit'))?.object.name,label);
    assert.ok(name,'a portal is within reach');
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    await dialog.getByRole('heading',{name,exact:true}).waitFor({state:'visible'});
    const toggle=dialog.locator('.interaction-actions').getByRole('button',{name:/^(Open|Close)$/});
    await toggle.waitFor({state:'visible'});if(await toggle.textContent()==='Open') await toggle.click();
    await dialog.getByRole('button',{name:label,exact:true}).click();
    await page.waitForFunction(id=>document.getElementById('local-map')?.dataset.mapId===id,mapId);
}

test('legacy Combat is removed without changing Athleticism; Melee Combat is independently allocatable',async()=>{
    const result=await page.evaluate(()=>{
        const {setup}=SugarCube;
        const first=setup.character.normalize({version:6,skills:{Athleticism:75,Combat:100,Focus:50}});
        return {first,second:setup.character.normalize(first),categories:setup.characterRules.skillCategories.flatMap(category=>category.skills)};
    });
    assert.equal(result.first.version,8);assert.equal(result.first.skills.Athleticism,75);assert.equal(result.first.skills.Focus,50);
    assert.equal(result.first.skills.Combat,undefined);assert.equal(result.first.skills['Melee Combat'],0);assert.deepEqual(result.second,result.first);
    assert.equal(new Set(result.categories).size,18);assert.equal(result.categories.length,18);
    const melee=page.getByRole('spinbutton',{name:'XP allocated to Melee Combat',exact:true});
    await melee.fill('150');await melee.press('Tab');assert.equal((await value()).skills['Melee Combat'],150);
    assert.equal(await page.locator('#skill-budget').textContent(),'100 / 250 XP remaining');
});

test('four single-floor interiors rotate their six furnished units and exits to match the buildings',async()=>{
    const layouts=await page.evaluate(()=>{
        const {setup}=SugarCube;
        return setup.worldMaps.apartments.buildings.map((building,index)=>{
            const map=setup.worldMaps[`apartment-${index+1}`],exit=map.interactables.find(object=>object.exit);
            const seen=new Set(),queue=[map.spawn];
            for(let i=0;i<queue.length;i++) {const p=queue[i],key=`${p.x},${p.y}`;
                if(seen.has(key)||!map.tileAt(p.x,p.y).walkable) continue;seen.add(key);
                for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) queue.push({x:p.x+dx,y:p.y+dy});
            }
            return {facing:building.facing,width:map.width,height:map.height,exit:{x:exit.x,y:exit.y},
                units:map.units.map(unit=>({id:unit.id,reached:seen.has(`${unit.door.x},${unit.door.y}`)&&seen.has(`${unit.anchor.x},${unit.anchor.y}`)})),
                beds:map.furniture.filter(f=>f.style==='bed').length,kitchens:map.furniture.filter(f=>f.style==='kitchen').length,
                bathrooms:map.furniture.filter(f=>f.style==='bath').length,
                blocked:map.furniture.every(f=>!map.tileAt(f.x,f.y).walkable),
                outside:setup.worldMaps.apartments.tileAt(exit.destination.x,exit.destination.y).walkable,
                spawn:map.tileAt(map.spawn.x,map.spawn.y).walkable};
        });
    });
    assert.equal(layouts.length,4);const ids=[];
    for(const map of layouts) {
        assert.equal(map.units.length,6);assert.ok(map.units.every(unit=>unit.reached));ids.push(...map.units.map(unit=>unit.id));
        assert.equal(map.beds,6);assert.equal(map.kitchens,6);assert.equal(map.bathrooms,6);assert.ok(map.blocked&&map.outside&&map.spawn);
        if(map.facing==='north') assert.equal(map.exit.y,0);
        if(map.facing==='south') assert.equal(map.exit.y,map.height-1);
        if(map.facing==='east') assert.equal(map.exit.x,map.width-1);
        if(map.facing==='west') assert.equal(map.exit.x,0);
    }
    assert.equal(new Set(ids).size,24);
});

test('all four building entrances and exits work through the interaction window',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const approaches=await page.evaluate(()=>SugarCube.setup.worldMaps.apartments.buildings.map(b=>({
        x:b.door.x+({west:-1,east:1}[b.facing]||0),y:b.door.y+({north:-1,south:1}[b.facing]||0)
    })));
    for(let index=0;index<approaches.length;index++) {
        const outside=approaches[index];await walkTo(outside.x,outside.y);await openPortal('Enter',`apartment-${index+1}`);
        assert.equal(await page.locator('#location-title').textContent(),`Apartment ${index+1}`);
        const inside=await page.evaluate(()=>{
            const {setup,State}=SugarCube,map=setup.worldMaps[State.variables.world.mapId],exit=map.interactables.find(o=>o.exit);
            return {x:exit.x+({west:1,east:-1}[map.facing]||0),y:exit.y+({north:1,south:-1}[map.facing]||0)};
        });
        await walkTo(inside.x,inside.y);await openPortal('Exit','apartments');
        const world=await page.evaluate(()=>SugarCube.State.variables.world);assert.equal(world.x,outside.x);assert.equal(world.y,outside.y);
    }
});

test('money and health are persistent sidebar stats, with safe transactions and bounded healing',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    assert.equal(await page.locator('#player-money').textContent(),'$99,999');assert.equal(await page.locator('#player-health').textContent(),'100 / 100');
    const nav=page.getByRole('navigation',{name:'Game pages'});assert.equal(await nav.getByRole('link',{name:'Apartments',exact:true}).count(),0);
    assert.deepEqual(await nav.locator('a').allTextContents(),['Character','Inventory','Stats']);
    const changes=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        const rejects=[setup.playerState.spend(-1),setup.playerState.spend(100000),setup.playerState.changeMoney(.5),setup.playerState.changeHealth(NaN)];
        setup.playerState.changeHealth(-35);const damaged=State.variables.player.health;
        setup.playerState.changeHealth(1000);const healed=State.variables.player.health;
        setup.playerState.changeHealth(-1000);setup.playerState.changeMoney(-99999);
        return {rejects,damaged,healed,player:setup.playerState.ensure()};
    });
    assert.deepEqual(changes.rejects,[false,false,false,false]);assert.equal(changes.damaged,65);assert.equal(changes.healed,100);
    assert.equal(changes.player.health,0);assert.equal(changes.player.money,0);
    await page.reload();await page.waitForSelector('#player-money');
    assert.equal(await page.locator('#player-money').textContent(),'$0');assert.equal(await page.locator('#player-health').textContent(),'0 / 100');
    await nav.getByRole('button',{name:'Stats',exact:true}).click();assert.match(await page.locator('#player-stats').textContent(),/Health0 \/ 100Money\$0/);
    assert.equal(await page.locator('body').getByText('Hunger',{exact:true}).count(),0);
    assert.equal(await page.locator('body').getByText('Thirst',{exact:true}).count(),0);
});

test('housing receptionist reach crosses the desk only at its service positions; rental rejects invalid payments',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube,map=setup.worldMaps['housing-office'],npc=map.interactables.find(o=>o.role==='housing');
        const remote=setup.housing.rent('1-2');
        State.variables.world={...State.variables.world,mapId:map.id,x:8,y:7};
        const counter=setup.interactions.nearby().map(t=>t.object.id);
        const blocked=setup.worldMovement.move(0,1);
        const actions=setup.interactions.actionsFor(npc).map(a=>a.id),attack=setup.interactions.run(npc.id,'attack');
        const invalid=setup.housing.rent('missing');State.variables.player.money=599;
        const insufficient=setup.housing.rent('1-2');const before=State.variables.player.money;
        State.variables.player.money=99999;const valid=setup.housing.rent('1-2'),again=setup.housing.rent('1-2');
        return {remote,counter,blocked,actions,attack,invalid,insufficient,before,valid,again,money:State.variables.player.money,
            unit:State.variables.housing.rentedUnit,health:State.variables.player.health,npcBlocked:!map.tileAt(npc.x,npc.y).walkable};
    });
    assert.equal(result.remote.ok,false);assert.deepEqual(result.counter,['housing-receptionist']);assert.equal(result.blocked.moved,false);
    assert.deepEqual(result.actions,['talk','attack']);assert.match(result.attack.message,/not implemented/);assert.ok(result.npcBlocked);
    assert.equal(result.invalid.ok,false);assert.equal(result.insufficient.ok,false);assert.equal(result.before,599);
    assert.equal(result.valid.ok,true);assert.equal(result.again.ok,false);assert.equal(result.money,99399);assert.equal(result.unit,'1-2');assert.equal(result.health,100);
});

test('renting through Talk provides a key to explicitly unlock the selected apartment and survives reloads and disk saves inside it',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await walkTo(42,31);await openPortal('Enter','housing-office');
    await walkTo(8,7);await page.keyboard.press('e');
    const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    assert.deepEqual(await dialog.locator('.interaction-actions button').allTextContents(),['Talk','Attack']);
    await dialog.getByRole('button',{name:'Talk',exact:true}).click();
    assert.deepEqual(await dialog.locator('.interaction-actions button').allTextContents(),['Rent apartment','Back']);
    await dialog.getByRole('button',{name:'Rent apartment',exact:true}).click();
    assert.equal(await dialog.getByLabel('Choose an apartment').locator('option').count(),6);
    await dialog.getByLabel('Choose an apartment').selectOption('3-4');await dialog.getByRole('button',{name:'Rent · $600 first week',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/Apartment 3 · Unit 4/);
    assert.equal(await page.locator('#player-money').textContent(),'$99,399');assert.ok(await dialog.getByRole('button',{name:'Rent · $600 first week',exact:true}).isDisabled());
    await dialog.getByRole('button',{name:'Collect apartment key',exact:true}).click();
    await page.getByRole('button',{name:'Apartment key, 1 by 1 blocks, Receptionist key tray',exact:true}).click();
    await page.getByRole('button',{name:'Empty block 1, 1 in Shirt pocket',exact:true}).click();
    await page.keyboard.press('Escape');await walkTo(8,1);await openPortal('Exit','apartments');
    await walkTo(30,30);await openPortal('Enter','apartment-3');
    // Unit 2 is west of this hallway after rotating the north-facing building.
    await walkTo(11,14);await page.keyboard.press('e');await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/locked/);
    await dialog.getByRole('button',{name:'Unlock',exact:true}).click();await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'You open the door.');await page.keyboard.press('Escape');
    await page.keyboard.press('a');await page.keyboard.press('a');
    assert.match(await page.locator('#position-description').textContent(),/unit 4 living area/);
    const blocked=await page.evaluate(()=>{
        const {setup,State}=SugarCube;const old={...State.variables.world};State.variables.world.x=13;State.variables.world.y=23;
        const open=setup.interactions.run('unit-door-3-1','open'),step=setup.worldMovement.move(1,0);State.variables.world=old;
        return {open,step,otherOpen:setup.interactions.isOpen('unit-door-3-1')};
    });
    assert.match(blocked.open.message,/locked/);assert.equal(blocked.step.moved,false);assert.equal(blocked.otherOpen,false);
    await page.reload();await page.waitForSelector('#local-map[data-map-id="apartment-3"]');
    const expected=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),player:structuredClone(SugarCube.State.variables.player),housing:structuredClone(SugarCube.State.variables.housing)}));
    assert.equal(expected.world.x,9);assert.equal(expected.housing.rentedUnit,'3-4');assert.equal(expected.player.money,99399);
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByText('Save…',{exact:true}).click()]);
    const save=join(temp,'rented-apartment.save');await download.saveAs(save);await page.locator('#ui-dialog-close').click();
    await page.evaluate(()=>{SugarCube.State.variables.player.money=0;SugarCube.State.variables.housing.rentedUnit=null;SugarCube.State.variables.world.mapId='apartments';SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-map-id="apartments"]');await page.getByRole('button',{name:'Saves',exact:true}).click();
    const previous=await page.locator('#local-map').elementHandle();
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByText('Load…',{exact:true}).click()]);await chooser.setFiles(save);
    await page.waitForFunction(old=>document.getElementById('local-map')!==old,previous);await page.waitForSelector('#local-map[data-map-id="apartment-3"]');
    assert.deepEqual(await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),player:structuredClone(SugarCube.State.variables.player),housing:structuredClone(SugarCube.State.variables.housing)})),expected);
});

test('four seasonal start dates use real 2026 weekdays and keep their selection through the menu',async()=>{
    const select=page.getByLabel('Start date',{exact:true});assert.equal(await select.locator('option').count(),4);
    const cases=[['2026-03-20','Spring equinox','Friday, March 20, 2026'],
        ['2026-06-21','Summer solstice','Sunday, June 21, 2026'],
        ['2026-09-23','Autumn equinox','Wednesday, September 23, 2026'],
        ['2026-12-21','Winter solstice','Monday, December 21, 2026']];
    for(const [date,season,weekday] of cases) {
        assert.equal(await select.locator(`option[value="${date}"]`).textContent(),`${season} — ${weekday}`);
        await select.selectOption(date);assert.equal((await value()).startDate,date);
        const clock=await page.evaluate(()=>({date:SugarCube.setup.gameClock.formatDate(SugarCube.setup.gameClock.now()),time:SugarCube.setup.gameClock.formatTime(SugarCube.setup.gameClock.now())}));
        assert.deepEqual(clock,{date:weekday,time:'08:00:00'});
    }
    await page.getByRole('link',{name:'Save & return to menu'}).click();await page.reload();
    await page.getByRole('link',{name:'Character Creation',exact:true}).click();assert.equal(await select.inputValue(),'2026-12-21');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    assert.equal(await page.locator('#player-date').textContent(),'Monday, December 21, 2026');assert.equal(await page.locator('#player-time').textContent(),'08:00:00');
    assert.equal(await page.locator('#movement-turn').count(),0);
    await page.keyboard.press('d');assert.equal(await page.locator('#player-time').textContent(),'08:00:05');
});

test('game time crosses midnight and year boundaries independently of the browser timezone',async()=>{
    await page.getByLabel('Start date',{exact:true}).selectOption('2026-12-21');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{
        const {State}=SugarCube;
        State.variables.world.elapsedSeconds=(Date.parse('2026-12-31T23:59:55Z')-Date.parse('2026-12-21T08:00:00Z'))/1000;
        SugarCube.Engine.play('Apartments');
    });
    await page.waitForFunction(()=>document.getElementById('player-time')?.textContent==='23:59:55');
    assert.equal(await page.locator('#player-date').textContent(),'Thursday, December 31, 2026');
    await page.keyboard.press('d');assert.equal(await page.locator('#player-date').textContent(),'Friday, January 1, 2027');
    assert.equal(await page.locator('#player-time').textContent(),'00:00:00');
    const expected=await page.locator('#player-date').textContent();await page.reload();await page.waitForSelector('#player-date');
    assert.equal(await page.locator('#player-date').textContent(),expected);assert.equal(await page.locator('#player-time').textContent(),'00:00:00');
});

test('opening doors, changing maps, talking, renting, and real-time waiting never advance game time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await walkTo(42,31);const elapsed=await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds);
    await openPortal('Enter','housing-office');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),elapsed);
    await walkTo(8,7);const atDesk=await page.evaluate(()=>SugarCube.setup.gameClock.now());
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    await dialog.getByRole('button',{name:'Talk',exact:true}).click();await dialog.getByRole('button',{name:'Rent apartment',exact:true}).click();
    await dialog.getByRole('button',{name:'Rent · $600 first week',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),atDesk);
    await page.keyboard.press('Escape');await page.clock.install();await page.clock.fastForward(3600000);
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),atDesk);
    assert.equal(await page.locator('#player-time').textContent(),await page.evaluate(()=>SugarCube.setup.gameClock.formatTime(SugarCube.setup.gameClock.now())));
});

test('weekly rent charges once at the exact due time, catches up, and retains unpaid rent without duplicating bills',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const results=await page.evaluate(()=>{
        const {setup,State}=SugarCube,week=setup.housing.weekSeconds;
        State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        const rented=setup.housing.rent('1-2');const first={...State.variables.housing};
        State.variables.world={...State.variables.world,mapId:'apartments',x:30,y:23,elapsedSeconds:week-10};
        setup.worldMovement.move(1,0);const before=State.variables.player.money;
        setup.worldMovement.move(-1,0);const due={money:State.variables.player.money,...State.variables.housing};
        setup.housing.collectDue();setup.housing.collectDue();const repeat=State.variables.player.money;
        State.variables.world.elapsedSeconds=3*week-5;setup.worldMovement.move(1,0);
        const catchup={money:State.variables.player.money,...State.variables.housing};
        State.variables.player.money=100;State.variables.world.elapsedSeconds=4*week-5;setup.worldMovement.move(-1,0);
        const unpaid={money:State.variables.player.money,...State.variables.housing};
        setup.worldMovement.move(1,0);const stillOwed=State.variables.housing.arrears;
        const stamp=setup.gameClock.now();setup.playerState.changeMoney(500);const afterIncome=setup.gameClock.now();setup.worldMovement.move(-1,0);
        return {rented,week,first,before,due,repeat,catchup,unpaid,stillOwed,stamp,afterIncome,
            settled:{money:State.variables.player.money,...State.variables.housing}};
    });
    assert.ok(results.rented.ok);assert.equal(results.first.weeklyRent,600);assert.equal(results.before,99399);
    assert.equal(results.due.money,98799);assert.equal(results.due.nextRentAt,results.first.nextRentAt+results.week);assert.equal(results.repeat,98799);
    assert.equal(results.catchup.money,97599);assert.equal(results.catchup.nextRentAt,results.first.nextRentAt+3*results.week);
    assert.equal(results.unpaid.money,100);assert.equal(results.unpaid.arrears,600);assert.equal(results.stillOwed,600);
    assert.equal(results.stamp,results.afterIncome);assert.equal(results.settled.money,0);assert.equal(results.settled.arrears,0);
    assert.equal(results.settled.rentedUnit,'1-2');
    await page.reload();await page.waitForSelector('#player-money');assert.equal(await page.locator('#player-money').textContent(),'$0');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.housing.arrears),0);
});

test('legacy turns and monthly leases migrate once without resetting time or charging on load',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        State.variables.world={version:1,mapId:'apartments',x:30,y:23,turn:17};
        State.variables.housing={version:1,rentedUnit:'2-3',monthlyRent:600,monthsPaid:1};
        const world=setup.worldMovement.ensure(),first=setup.housing.ensure();
        const again=setup.worldMovement.ensure(),lease=setup.housing.ensure();
        return {world,again,first,lease,now:setup.gameClock.now(),money:State.variables.player.money,
            invalid:setup.character.normalize({startDate:'2026-02-30'}).startDate};
    });
    assert.equal(result.world.version,2);assert.equal(result.world.turn,undefined);assert.equal(result.world.elapsedSeconds,85);assert.deepEqual(result.again,result.world);
    assert.equal(result.first.version,3);assert.equal(result.first.rentedUnit,'2-3');assert.equal(result.first.weeklyRent,600);
    assert.equal(result.first.monthlyRent,undefined);assert.equal(result.first.nextRentAt,result.now+604800);assert.deepEqual(result.lease,result.first);
    assert.equal(result.money,99999);assert.equal(result.invalid,'2026-03-20');
});

async function placeInWorld(mapId,x,y) {
    const previous=await page.locator('#local-map').elementHandle();
    await page.evaluate(({mapId,x,y})=>{SugarCube.State.variables.world={...SugarCube.State.variables.world,mapId,x,y};SugarCube.Engine.play('Apartments');},{mapId,x,y});
    await page.waitForFunction(old=>document.getElementById('local-map')!==old,previous);
    await page.waitForSelector(`#local-map[data-map-id="${mapId}"][data-player-x="${x}"]`);
}

test('only six units can be rented; a physical key stays on the tray when pockets are full',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        const inventory=setup.inventory.ensure();
        for(const pocket of setup.inventory.worn()) inventory.containers[pocket.id]=[{id:`test-cloth:${pocket.id}`,type:'cloth',x:0,y:0}];
        const hidden=setup.housing.rent('1-1'),moneyBefore=State.variables.player.money;
        const rented=setup.housing.rent('1-2'),tray=setup.housing.counter(),key=setup.inventory.placements(tray)[0];
        const denied=setup.inventory.transfer(tray.id,'worn:shirt',key.id,0,0,'housing-counter');
        const beforeKey=setup.housing.canEnter('1-2');
        // Simulate freeing a pocket; successful placement must be explicit.
        setup.inventory.ensure().containers['worn:shirt']=[];
        const moved=setup.inventory.transfer(tray.id,'worn:shirt',key.id,0,0,'housing-counter');
        const afterKey=setup.housing.canEnter('1-2');setup.housing.ensure();setup.housing.counter();
        const keyCount=Object.values(setup.inventory.ensure().containers).flat().filter(item=>item.type==='apartmentKey').length;
        State.variables.world.mapId='apartments';State.variables.world.x=30;State.variables.world.y=23;
        const remote=setup.inventory.transfer('worn:shirt',tray.id,key.id,0,0,'housing-counter');
        return {ids:setup.housing.listings().map(u=>u.id),hidden,moneyBefore,rented,denied,beforeKey,moved,afterKey,keyCount,remote,
            elapsed:State.variables.world.elapsedSeconds,money:State.variables.player.money};
    });
    assert.deepEqual(result.ids,['1-2','1-5','2-3','3-1','3-4','4-6']);assert.equal(result.hidden.ok,false);assert.equal(result.moneyBefore,99999);
    assert.ok(result.rented.ok);assert.equal(result.denied.ok,false);assert.equal(result.beforeKey,false);assert.equal(result.moved.ok,true);assert.equal(result.afterKey,true);
    assert.equal(result.keyCount,1);assert.equal(result.remote.ok,false);assert.equal(result.money,99399);assert.equal(result.elapsed,0);
});

test('a key only opens its matching door while carried; open doors remain passable after the key is put down',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        setup.housing.rent('1-2');const tray=setup.housing.counter(),key=setup.inventory.placements(tray)[0];
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:13,y:5};
        const without=setup.interactions.run('unit-door-1-2','open');
        State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        setup.inventory.transfer(tray.id,'worn:shirt',key.id,0,0,'housing-counter');
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:11,y:5};
        const wrong=setup.interactions.run('unit-door-1-1','open');
        State.variables.world.x=13;setup.interactions.run('unit-door-1-2','unlock');const right=setup.interactions.run('unit-door-1-2','open');
        setup.inventory.ensure().containers['worn:shirt']=[];setup.inventory.ensure().containers[tray.id]=[key];
        const step=setup.worldMovement.move(1,0);
        return {without,wrong,right,step,opened:setup.interactions.isOpen('unit-door-1-2'),keyCount:Object.values(State.variables.inventory.containers).flat().filter(item=>item.id===key.id).length};
    });
    assert.equal(result.without.ok,false);assert.match(result.without.message,/matching key/);assert.equal(result.wrong.ok,false);
    assert.equal(result.right.ok,true);assert.ok(result.opened&&result.step.moved);assert.equal(result.keyCount,1);
});

test('room masking conceals furniture, reveals only a nearby open room, and hides it again away from the doorway',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await placeInWorld('apartment-1',13,5);
    const bedPixel=()=>page.locator('#local-map').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(16*16+8,3*16+8,1,1).data));
    const hidden=await bedPixel();assert.deepEqual(hidden,[16,28,33,255]);
    const access=await page.evaluate(()=>{
        SugarCube.State.variables.openedObjects={'apartment-1:unit-door-1-2':true};
        const {setup,State}=SugarCube,map=setup.worldMaps['apartment-1'];
        return map.units.map(unit=>({id:unit.id,visible:setup.rooms.cellVisible(map,unit.anchor.x,unit.anchor.y,State.variables.world)}));
    });
    assert.deepEqual(access.filter(unit=>unit.visible).map(unit=>unit.id),['1-2']);
    await placeInWorld('apartment-1',13,5);assert.notDeepEqual(await bedPixel(),hidden);
    await placeInWorld('apartment-1',12,5);assert.deepEqual(await bedPixel(),hidden);
    await placeInWorld('apartment-1',18,3);assert.notDeepEqual(await bedPixel(),hidden);
    const bath=await page.evaluate(()=>{
        const {setup,State}=SugarCube,map=setup.worldMaps['apartment-1'],unit=map.units.find(unit=>unit.id==='1-2');
        State.variables.world.x=19;State.variables.world.y=3;
        const before=setup.rooms.cellVisible(map,22,3);setup.interactions.run('bathroom-door-1-2','open');
        const open=setup.rooms.cellVisible(map,22,3);State.variables.world.x=21;
        setup.interactions.run('bathroom-door-1-2','close');
        return {before,open,inside:setup.rooms.cellVisible(map,22,3),living:setup.rooms.cellVisible(map,unit.anchor.x,unit.anchor.y),
            bedHidden:!setup.interactions.nearby().some(target=>target.object.kind==='bed')};
    });
    assert.deepEqual(bath,{before:false,open:true,inside:true,living:false,bedHidden:true});
});

test('room sounds respond to activity changes and persist without advancing time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',18,3);
    const before=await page.evaluate(()=>SugarCube.setup.gameClock.now());assert.match(await page.locator('#room-sounds').textContent(),/ventilation/i);
    await page.evaluate(()=>SugarCube.setup.rooms.setActivity('apartment-1','1-2','music'));
    assert.match(await page.locator('#room-sounds').textContent(),/Music plays/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),before);
    await page.reload();await page.waitForSelector('#room-sounds');assert.match(await page.locator('#room-sounds').textContent(),/Music plays/);
    await placeInWorld('apartment-1',12,5);assert.match(await page.locator('#room-sounds').textContent(),/footsteps echo/);
});

test('awake tiredness rises exactly every 15 minutes and reductions do not reset that schedule',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        setup.rest.advanceAwake(899);const before=setup.rest.ensure().tiredness;
        setup.rest.advanceAwake(1);const minute15=setup.rest.ensure().tiredness;
        setup.rest.changeTiredness(-1);const afterItem=setup.rest.ensure().tiredness;
        setup.rest.advanceAwake(899);const beforeNext=setup.rest.ensure().tiredness;setup.rest.advanceAwake(1);
        const minute30=setup.rest.ensure().tiredness;
        State.variables.rest={version:1,tiredness:50,exertion:0,awakeSeconds:1800};
        return {before,minute15,afterItem,beforeNext,minute30,scaled:setup.rest.fatigue(),invalid:setup.rest.advanceAwake(-1),clock:State.variables.world.elapsedSeconds};
    });
    assert.deepEqual([result.before,result.minute15,result.afterItem,result.beforeNext,result.minute30],[0,1,0,0,1]);
    assert.equal(result.scaled,20);assert.equal(result.clock,1800);assert.equal(result.invalid.ok,false);
});

test('beds provide sit, one-hour nap, and 1–10 hour sleep; recovery, awake reset and rent all use game time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',18,3);
    await page.evaluate(()=>{SugarCube.State.variables.rest={version:1,tiredness:80,exertion:0,awakeSeconds:800};});
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    assert.deepEqual(await dialog.locator('.interaction-actions button').allTextContents(),['Sit','Nap for 1 hour','Sleep']);
    const time=await page.evaluate(()=>SugarCube.setup.gameClock.now());
    await dialog.getByRole('button',{name:'Sit',exact:true}).click();assert.match(await page.locator('#room-sounds').textContent(),/creaks/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),time);
    await dialog.getByRole('button',{name:'Nap for 1 hour',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),time+3600);
    assert.equal(await page.locator('#player-tiredness').textContent(),'68 / 100');assert.equal(await page.locator('#player-fatigue').textContent(),'27 / 100');
    assert.match(await page.locator('#room-sounds').textContent(),/wake/);
    await dialog.getByRole('button',{name:'Sleep',exact:true}).click();assert.equal(await dialog.getByLabel('Sleep for',{exact:true}).locator('option').count(),10);
    await dialog.getByLabel('Sleep for',{exact:true}).selectOption('8');await dialog.getByRole('button',{name:'Sleep for 8 hours',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),time+9*3600);
    assert.equal(await page.locator('#player-tiredness').textContent(),'0 / 100');assert.equal(await page.locator('#player-fatigue').textContent(),'0 / 100');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.rest.awakeSeconds),0);
    const invalid=await page.evaluate(()=>[0,11,1.5].map(hours=>SugarCube.setup.rest.sleep('bed-1-2',hours).ok));assert.deepEqual(invalid,[false,false,false]);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#player-time');assert.equal(await page.locator('#player-time').textContent(),'17:00:00');
    const due=await page.evaluate(()=>{
        const {setup,State}=SugarCube;State.variables.housing={version:3,rentedUnit:'1-2',keyIssued:true,weeklyRent:600,nextRentAt:setup.gameClock.now()+1800,arrears:0};
        const before=State.variables.player.money;const outcome=setup.rest.sleep('bed-1-2',1);return {before,after:State.variables.player.money,outcome};
    });
    assert.ok(due.outcome.ok);assert.equal(due.after,due.before-600);
});

test('maximum tiredness or fatigue causes collapse, wakes at the recovery target, and stops held movement',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.rest={version:1,tiredness:99,exertion:0,awakeSeconds:899};});
    await page.keyboard.down('d');
    const world=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));assert.equal(world.x,31);assert.equal(world.elapsedSeconds,6005);
    assert.match(await page.locator('#movement-status').textContent(),/collapse/);assert.equal(await page.locator('#player-tiredness').textContent(),'80 / 100');assert.equal(await page.locator('#player-fatigue').textContent(),'32 / 100');
    await page.clock.runFor(1200);assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),world);await page.keyboard.up('d');
    const action=await page.evaluate(()=>{
        const {setup,State}=SugarCube;State.variables.rest={version:1,tiredness:0,exertion:0,awakeSeconds:0};const before=setup.gameClock.now();
        const result=setup.rest.exert(100);return {result,elapsed:setup.gameClock.now()-before,fatigue:setup.rest.fatigue()};
    });
    assert.equal(action.result.ok,false);assert.ok(action.result.collapsed);assert.equal(action.elapsed,60);assert.equal(action.fatigue,99);
});

test('carried coffee is consumed once, lowers tiredness, and leaves the awake schedule and clock unchanged',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await placeInWorld('apartments',15,30);
    const coffee=await page.evaluate(()=>{
        const {setup,State}=SugarCube;const trunk=setup.inventory.openTrunk('parked-car-2');const item=setup.inventory.placements(trunk).find(item=>item.type==='coffee');
        const denied=setup.inventory.consume(trunk.id,item.id);setup.inventory.transfer(trunk.id,'worn:shirt',item.id,0,0,'parked-car-2');
        State.variables.rest={version:1,tiredness:50,exertion:0,awakeSeconds:899};return {id:item.id,denied};
    });
    assert.equal(coffee.denied.ok,false);await page.getByRole('button',{name:'Inventory',exact:true}).click();
    await page.getByRole('button',{name:'Canned coffee, 1 by 1 blocks, Shirt pocket',exact:true}).click();
    const before=await page.evaluate(()=>SugarCube.setup.gameClock.now());await page.getByRole('button',{name:'Drink coffee',exact:true}).click();
    assert.equal(await page.locator('#player-tiredness').textContent(),'40 / 100');assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),before);
    const after=await page.evaluate(id=>({repeat:SugarCube.setup.inventory.consume('worn:shirt',id),awake:SugarCube.State.variables.rest.awakeSeconds,count:Object.values(SugarCube.State.variables.inventory.containers).flat().filter(item=>item.id===id).length}),coffee.id);
    assert.equal(after.repeat.ok,false);assert.equal(after.awake,899);assert.equal(after.count,0);
});

test('fatigue caps at 100, tiredness contributes only 40, and collapse recovery ticks are exact',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        const contribution=setup.rest.fatigue({tiredness:100,exertion:0});
        const cap=setup.rest.fatigue({tiredness:100,exertion:100});
        const recoveries=[];
        for(let tiredness=81;tiredness<=100;tiredness++) {
            State.variables.world.elapsedSeconds=0;
            State.variables.rest={version:1,tiredness,exertion:100-Math.floor(tiredness*.4),awakeSeconds:900};
            const result=setup.rest.collapse();
            recoveries.push({start:tiredness,tiredness:State.variables.rest.tiredness,seconds:State.variables.world.elapsedSeconds,
                clock:setup.gameClock.elapsed(),awake:State.variables.rest.awakeSeconds,collapsed:result.collapsed,fatigue:setup.rest.fatigue()});
        }
        State.variables.world.elapsedSeconds=0;State.variables.rest={version:1,tiredness:0,exertion:0,awakeSeconds:0};
        setup.rest.changeTiredness(100);
        return {contribution,cap,recoveries,tiredOnly:{seconds:State.variables.world.elapsedSeconds,tiredness:State.variables.rest.tiredness,fatigue:setup.rest.fatigue()}};
    });
    assert.equal(result.contribution,40);assert.equal(result.cap,100);
    for(const row of result.recoveries) {
        assert.equal(row.tiredness,80);assert.equal(row.seconds,(row.start-80)*300);assert.equal(row.clock,row.seconds);assert.equal(row.awake,0);assert.ok(row.collapsed&&row.fatigue<100);
    }
    assert.deepEqual(result.tiredOnly,{seconds:6000,tiredness:80,fatigue:32});
});

test('passive fatigue recovery carries partial minutes through movement and reload, respects its floor, and pauses for exertion',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const initial=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        State.variables.rest={version:1,tiredness:50,exertion:30,awakeSeconds:0};
        const migrated=structuredClone(setup.rest.ensure());
        setup.rest.advanceAwake(59);setup.rest.commit();
        return {migrated,fatigue:setup.rest.fatigue(),remainder:State.variables.rest.recoverySeconds};
    });
    assert.equal(initial.migrated.version,2);assert.equal(initial.migrated.fatigue,50);
    assert.equal(initial.fatigue,50);assert.equal(initial.remainder,59);
    await page.reload();await page.waitForSelector('#player-fatigue');
    await page.keyboard.press('d');
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        const moved={fatigue:setup.rest.fatigue(),remainder:State.variables.rest.recoverySeconds};
        State.variables.rest={version:2,tiredness:50,fatigue:22,awakeSeconds:0,recoverySeconds:0};
        setup.rest.advanceAwake(600);const floor=setup.rest.fatigue();
        setup.rest.changeTiredness(-10);const lowered=setup.rest.fatigue();
        setup.rest.advanceAwake(240);const recovered=setup.rest.fatigue();
        const before=State.variables.world.elapsedSeconds;
        setup.rest.exert(10,120);const busy={fatigue:setup.rest.fatigue(),remainder:State.variables.rest.recoverySeconds,seconds:State.variables.world.elapsedSeconds-before};
        setup.rest.advanceAwake(59);const partial=setup.rest.fatigue();setup.rest.advanceAwake(1);const minute=setup.rest.fatigue();
        const invalid=setup.rest.exert(1,-60);
        return {moved,floor,lowered,recovered,busy,partial,minute,invalid};
    });
    assert.deepEqual(result.moved,{fatigue:49,remainder:4});assert.equal(result.floor,20);
    assert.equal(result.lowered,20);assert.equal(result.recovered,16);
    assert.deepEqual(result.busy,{fatigue:26,remainder:0,seconds:120});
    assert.equal(result.partial,26);assert.equal(result.minute,25);assert.equal(result.invalid.ok,false);
});

test('sleep and unconsciousness recover fatigue every minute without going below the tiredness floor',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',18,3);
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        State.variables.rest={version:2,tiredness:50,fatigue:80,awakeSeconds:0,recoverySeconds:0};
        setup.rest.sleep('bed-1-2',1);const hour={tiredness:State.variables.rest.tiredness,fatigue:setup.rest.fatigue()};
        setup.rest.sleep('bed-1-2',1);const floor={tiredness:State.variables.rest.tiredness,fatigue:setup.rest.fatigue()};
        State.variables.rest={version:2,tiredness:60,fatigue:99,awakeSeconds:0,recoverySeconds:0};
        const before=State.variables.world.elapsedSeconds;setup.rest.exert(1);
        const collapse={seconds:State.variables.world.elapsedSeconds-before,tiredness:State.variables.rest.tiredness,fatigue:setup.rest.fatigue()};
        return {hour,floor,collapse};
    });
    assert.deepEqual(result.hour,{tiredness:38,fatigue:20});assert.deepEqual(result.floor,{tiredness:26,fatigue:10});
    assert.deepEqual(result.collapse,{seconds:60,tiredness:60,fatigue:99});
});

test('T opens personal actions, pauses held movement, and Pass Time advances exactly fifteen game minutes',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.rest={version:2,tiredness:50,fatigue:50,awakeSeconds:0,recoverySeconds:0};});
    await page.keyboard.down('d');await page.keyboard.press('t');
    const dialog=page.getByRole('dialog',{name:'Actions',exact:true});await dialog.waitFor({state:'visible'});
    assert.deepEqual(await dialog.locator('.interaction-actions button').allTextContents(),['Pass Time','Rest','Lay down to sleep']);
    const before=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.clock.runFor(1000);await page.keyboard.up('d');
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),before);
    await dialog.getByRole('button',{name:'Pass Time',exact:true}).click();
    assert.match(await dialog.locator('#action-result').textContent(),/pass 15 minutes/);
    const after=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),tiredness:SugarCube.State.variables.rest.tiredness,fatigue:SugarCube.setup.rest.fatigue()}));
    assert.equal(after.world.elapsedSeconds,before.elapsedSeconds+900);assert.equal(after.world.x,before.x);assert.equal(after.world.y,before.y);
    assert.equal(after.tiredness,51);assert.equal(after.fatigue,35);
    await page.keyboard.press('Escape');await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),before.x);
    await page.clock.resume();await page.reload();await page.waitForSelector('#actions-button');assert.equal(await page.locator('#player-time').textContent(),'08:15:05');
    await page.getByRole('button',{name:'Actions [T]',exact:true}).click();await dialog.waitFor({state:'visible'});
});

test('sleep anywhere checks nearby comfort, recovers more slowly on the ground, and retains fatigue and billing rules',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.rest={version:2,tiredness:80,fatigue:50,awakeSeconds:100,recoverySeconds:0};});
    await page.keyboard.press('t');const dialog=page.getByRole('dialog',{name:'Actions',exact:true});
    await dialog.getByRole('button',{name:'Lay down to sleep',exact:true}).click();assert.match(await dialog.textContent(),/7½ minutes/);
    await dialog.getByLabel('Sleep for',{exact:true}).selectOption('1');await dialog.getByRole('button',{name:'Sleep for 1 hour',exact:true}).click();
    assert.equal(await page.locator('#player-tiredness').textContent(),'72 / 100');assert.equal(await page.locator('#player-fatigue').textContent(),'28 / 100');
    assert.equal(await page.locator('#player-time').textContent(),'09:00:00');assert.match(await dialog.locator('#action-result').textContent(),/on the ground/);
    await page.keyboard.press('Escape');await placeInWorld('apartment-1',18,3);
    await page.evaluate(()=>{SugarCube.State.variables.rest={version:2,tiredness:80,fatigue:50,awakeSeconds:100,recoverySeconds:0};});
    await page.keyboard.press('t');await dialog.getByRole('button',{name:'Lay down to sleep',exact:true}).click();assert.match(await dialog.textContent(),/Comfortable sleep/);
    await dialog.getByLabel('Sleep for',{exact:true}).selectOption('1');await dialog.getByRole('button',{name:'Sleep for 1 hour',exact:true}).click();
    assert.equal(await page.locator('#player-tiredness').textContent(),'68 / 100');assert.equal(await page.locator('#player-fatigue').textContent(),'27 / 100');
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        State.variables.world={...State.variables.world,mapId:'apartments',x:30,y:23};
        State.variables.housing={version:3,rentedUnit:'1-2',keyIssued:true,weeklyRent:600,nextRentAt:setup.gameClock.now()+1800,arrears:0};
        const before=State.variables.player.money;setup.rest.sleepAnywhere(1);
        return {awake:State.variables.rest.awakeSeconds,cost:before-State.variables.player.money,invalid:[0,11,1.5].map(hours=>setup.rest.sleepAnywhere(hours).ok)};
    });
    assert.equal(result.awake,0);assert.equal(result.cost,600);assert.deepEqual(result.invalid,[false,false,false]);
});

test('lockpicking chance scales through zero, half, and guaranteed success across all five lock levels',async()=>{
    const result=await page.evaluate(()=>{
        const chance=SugarCube.setup.doorLocks.chance;
        return Array.from({length:5},(_,index)=>{const level=index+1;return {level,values:[0,level/2,level*.75,level,level*1.5,level*2,10].map(skill=>chance(skill,level))};});
    });
    for(const row of result) assert.deepEqual(row.values,[0,0,25,50,75,100,100]);
});

test('door keys unlock separately from opening, allow relocking, and an unlocked room stays unlocked without its key',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await placeInWorld('apartment-1',13,5);
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube,door=setup.worldMaps['apartment-1'].interactables.find(object=>object.id==='unit-door-1-2');
        const before=State.variables.world.elapsedSeconds;
        const without=setup.interactions.run(door.id,'unlock');
        setup.inventory.ensure().containers['worn:shirt']=[{id:'apartment-key:1-1',type:'apartmentKey',x:0,y:0}];
        const wrong=setup.interactions.run(door.id,'unlock');
        setup.inventory.ensure().containers['worn:shirt']=[{id:'apartment-key:1-2',type:'apartmentKey',x:0,y:0}];
        const beforeUnlock=setup.interactions.run(door.id,'open');const unlock=setup.interactions.run(door.id,'unlock');
        const stillClosed=!setup.interactions.isOpen(door.id),unlocked=!setup.doorLocks.isLocked(door);
        const opened=setup.interactions.run(door.id,'open');const lockOpen=setup.interactions.run(door.id,'lock');
        setup.interactions.run(door.id,'close');const relocked=setup.interactions.run(door.id,'lock');
        const blocked=setup.interactions.run(door.id,'open');setup.interactions.run(door.id,'unlock');
        setup.inventory.ensure().containers['worn:shirt']=[];
        setup.interactions.run(door.id,'open');setup.interactions.run(door.id,'close');
        const remainsUnlocked=!setup.doorLocks.isLocked(door);const noKeyLock=setup.interactions.run(door.id,'lock');
        return {without,wrong,beforeUnlock,unlock,stillClosed,unlocked,opened,lockOpen,relocked,blocked,remainsUnlocked,noKeyLock,elapsed:State.variables.world.elapsedSeconds-before};
    });
    assert.equal(result.without.ok,false);assert.equal(result.wrong.ok,false);assert.equal(result.beforeUnlock.ok,false);
    assert.ok(result.unlock.ok&&result.stillClosed&&result.unlocked&&result.opened.ok);assert.equal(result.lockOpen.ok,false);
    assert.ok(result.relocked.ok);assert.equal(result.blocked.ok,false);assert.ok(result.remainsUnlocked);assert.equal(result.noKeyLock.ok,false);assert.equal(result.elapsed,0);
    await page.reload();await page.waitForSelector('#local-map');
    assert.equal(await page.evaluate(()=>SugarCube.setup.doorLocks.isLocked(SugarCube.setup.worldMaps['apartment-1'].interactables.find(object=>object.id==='unit-door-1-2'))),false);
});

test('all doors offer lock actions, lockpicking changes access without opening, and both sides of a portal share their lock',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',11,5);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    assert.match(await dialog.textContent(),/Lock level 2 \/ 5/);assert.ok(await dialog.getByRole('button',{name:'Lockpick · Level 2 · 0% chance',exact:true}).isEnabled());
    await dialog.getByRole('button',{name:'Lockpick · Level 2 · 0% chance',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/fail to pick/);
    await page.keyboard.press('Escape');
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;const worldBefore=State.variables.world.elapsedSeconds;
        State.variables.character.skills.Lockpicking=150;
        const partial=setup.interactions.run('unit-door-1-1','lockpick');
        const partialState=setup.doorLocks.isLocked(setup.worldMaps['apartment-1'].interactables.find(object=>object.id==='unit-door-1-1'));
        State.variables.doorLocks['unit-1-1']=true;setup.skills.award('Lockpicking',600);
        const picked=setup.interactions.run('unit-door-1-1','lockpick');const closed=!setup.interactions.isOpen('unit-door-1-1');
        const unlocked=!setup.doorLocks.isLocked(setup.worldMaps['apartment-1'].interactables.find(object=>object.id==='unit-door-1-1'));
        const open=setup.interactions.run('unit-door-1-1','open');
        const all=Object.values(setup.worldMaps).flatMap(map=>map.interactables.filter(object=>object.kind==='door').map(object=>setup.interactions.actionsFor(object).map(action=>action.id)));
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:12,y:27};
        const lock=setup.interactions.run('exit-apartment-1','lock');
        State.variables.world={...State.variables.world,mapId:'apartments',x:30,y:16};
        const blocked=setup.interactions.run('apartment-door-1','open');
        const pickedEntrance=setup.interactions.run('apartment-door-1','lockpick');
        const entranceOpen=setup.interactions.run('apartment-door-1','open');
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:12,y:27};
        const mirroredOpen=setup.interactions.isOpen('exit-apartment-1');setup.interactions.run('exit-apartment-1','close');
        return {partial,partialState,picked,closed,unlocked,open,all,lock,blocked,pickedEntrance,entranceOpen,mirroredOpen,mirroredClosed:!setup.interactions.isOpen('apartment-door-1','apartments'),elapsed:State.variables.world.elapsedSeconds-worldBefore};
    });
    assert.equal(result.partial.chance,50);assert.equal(result.partialState,!result.partial.ok);
    assert.ok(result.picked.ok&&result.closed&&result.unlocked&&result.open.ok);assert.equal(result.picked.chance,100);
    for(const actions of result.all) {assert.ok(actions.includes('unlock')!==actions.includes('lock'));assert.equal(actions.includes('lockpick'),actions.includes('unlock'));}
    assert.ok(result.lock.ok);assert.equal(result.blocked.ok,false);assert.ok(result.pickedEntrance.ok&&result.entranceOpen.ok&&result.mirroredOpen&&result.mirroredClosed);assert.equal(result.elapsed,0);
});

test('door controls replace open/close and lock/unlock and every apartment lock is level two',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',13,5);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true}),actions=dialog.locator('.interaction-actions');
    assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Unlock','Lockpick · Level 2 · 0% chance']);
    await page.evaluate(()=>{SugarCube.setup.inventory.ensure().containers['worn:shirt']=[{id:'apartment-key:1-2',type:'apartmentKey',x:0,y:0}];});
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Lock']);
    await actions.getByRole('button',{name:'Open',exact:true}).click();assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Close','Lock']);
    await actions.getByRole('button',{name:'Close',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Unlock','Lockpick · Level 2 · 0% chance']);
    const levels=await page.evaluate(()=>Object.values(SugarCube.setup.worldMaps).flatMap(map=>map.interactables.filter(object=>object.unitId&&object.kind==='door').map(object=>SugarCube.setup.doorLocks.difficulty(object))));
    assert.equal(levels.length,24);assert.ok(levels.every(level=>level===2));
});

test('unowned vehicle doors and trunks start independently locked and reject inventory access until unlocked',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',13,29);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true}),actions=dialog.locator('.interaction-actions');
    assert.match(await actions.textContent(),/Lockpick · Level 3 · 0% chance/);
    await actions.getByRole('button',{name:'Open door',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/locked/);
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/matching key/);
    await page.evaluate(()=>{SugarCube.setup.inventory.ensure().containers['worn:shirt']=[{id:'vehicle-key:apartments:parked-car-1',type:'vehicleKey',x:0,y:0}];});
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();await actions.getByRole('button',{name:'Open door',exact:true}).click();
    assert.equal(await actions.getByRole('button',{name:'Open door',exact:true}).count(),0);
    await actions.getByRole('button',{name:'Close door',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    await page.keyboard.press('Escape');await placeInWorld('apartments',12,30);await page.keyboard.press('e');
    assert.match(await actions.textContent(),/Lockpick · Level 2 · 0% chance/);
    await actions.getByRole('button',{name:'Open trunk',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/locked/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.openTrunk('parked-car-1')),null);
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();await actions.getByRole('button',{name:'Open trunk',exact:true}).click();
    const inventory=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await inventory.waitFor({state:'visible'});
    assert.equal(await inventory.locator('[data-container^="trunk:"] .inventory-item').count(),3);
    await page.keyboard.press('Escape');await page.keyboard.press('e');
    await actions.getByRole('button',{name:'Close trunk',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube,car=setup.worldMaps.apartments.interactables.find(object=>object.id==='parked-car-1');return {door:setup.doorLocks.isLocked(car),trunk:setup.doorLocks.isLocked(setup.vehicles.trunk(car)),external:setup.inventory.external(car.id)};});
    assert.deepEqual(result,{door:true,trunk:true,external:null});
    await page.reload();await page.waitForSelector('#local-map');assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.openTrunk('parked-car-1')),null);
});

test('sideways beds rotate their pillows and bedding instead of stretching a horizontal mattress',async()=>{
    const result=await page.evaluate(()=>Object.values(SugarCube.setup.worldMaps).filter(map=>/^apartment-\d$/.test(map.id)).map(map=>{
        const bed=map.furniture.find(item=>item.style==='bed'),canvas=SugarCube.setup.worldMapArt.paint(map),ctx=canvas.getContext('2d');
        const pillow=[];
        for(let y=0;y<bed.height*16;y++) for(let x=0;x<bed.width*16;x++) {
            const pixel=ctx.getImageData(bed.x*16+x,bed.y*16+y,1,1).data;
            if(pixel[0]===214&&pixel[1]===215&&pixel[2]===196) pillow.push({x,y});
        }
        return {facing:map.facing,width:bed.width,height:bed.height,rotation:bed.rotation,
            pillow:{minX:Math.min(...pillow.map(p=>p.x)),maxX:Math.max(...pillow.map(p=>p.x)),minY:Math.min(...pillow.map(p=>p.y)),maxY:Math.max(...pillow.map(p=>p.y))}};
    }));
    for(const bed of result) {
        const p=bed.pillow;
        if(bed.facing==='south') {assert.deepEqual([bed.width,bed.height],[2,3]);assert.ok(p.maxY<16);}
        if(bed.facing==='north') assert.ok(p.minY>=32);
        if(bed.facing==='west') {assert.deepEqual([bed.width,bed.height],[3,2]);assert.ok(p.minX>=32);assert.ok(p.maxY-p.minY>p.maxX-p.minX);}
        if(bed.facing==='east') assert.ok(p.maxX<16);
    }
});

test('world atlas shows an area icon that stays fixed across local movement and entering buildings',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await stableAtlas();const atlas=page.locator('#world-map');
    assert.equal(await atlas.getAttribute('data-location-id'),'apartments');assert.equal(await atlas.getAttribute('data-icon-count'),'1');
    const before=await atlas.evaluate(canvas=>canvas.toDataURL());await page.keyboard.press('d');
    assert.equal(await atlas.evaluate(canvas=>canvas.toDataURL()),before);
    await placeInWorld('apartment-2',12,12);assert.equal(await atlas.evaluate(canvas=>canvas.toDataURL()),before);
    assert.match(await atlas.getAttribute('aria-label'),/Current area: Apartments/);
});

test('Shift sprinting halves input delay, spends two seconds per step and uses endurance; walking recovers it',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.keyboard.down('Shift');await page.keyboard.down('d');
    assert.equal(await page.locator('#player-time').textContent(),'08:00:02');assert.equal(await page.locator('#player-endurance').textContent(),'1 / 25');
    await page.clock.runFor(99);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),31);
    await page.clock.runFor(1);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),32);
    await page.clock.runFor(100);assert.equal(await page.locator('#player-time').textContent(),'08:00:06');assert.equal(await page.locator('#player-endurance').textContent(),'3 / 25');
    await page.keyboard.up('Shift');await page.clock.runFor(199);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),33);
    await page.clock.runFor(1);await page.keyboard.up('d');assert.equal(await page.locator('#player-time').textContent(),'08:00:11');assert.equal(await page.locator('#player-endurance').textContent(),'2 / 25');
    await page.getByRole('button',{name:'Sprint [Shift]',exact:true}).click();await page.keyboard.press('a');
    assert.equal(await page.locator('#player-time').textContent(),'08:00:13');assert.equal(await page.locator('#player-endurance').textContent(),'3 / 25');
    await page.keyboard.press('t');await page.getByRole('button',{name:'Pass Time',exact:true}).click();assert.equal(await page.locator('#player-endurance').textContent(),'0 / 25');
});

test('endurance limits sprinting, awards one earned XP per 25 steps, and adds cumulative level capacity without changing creation XP',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        const caps=Array.from({length:11},(_,level)=>setup.endurance.capacity(level));
        for(let i=0;i<25;i++) setup.worldMovement.move(i%2?-1:1,0,true);
        const exhausted={used:setup.endurance.ensure().used,xp:setup.skills.xp('Endurance'),steps:State.variables.endurance.sprintSteps};
        const before=State.variables.world.elapsedSeconds;const fallback=setup.worldMovement.move(-1,0,true);
        const recovery={used:setup.endurance.ensure().used,seconds:State.variables.world.elapsedSeconds-before,sprinted:fallback.sprinted};
        State.variables.endurance={used:0,sprintSteps:0,recoverySeconds:0};State.variables.character.skills.Endurance=49;State.variables.skillXp={};
        for(let i=0;i<25;i++) setup.worldMovement.move(i%2?-1:1,0,true);
        const levelup={used:setup.endurance.ensure().used,max:setup.endurance.capacity(),xp:setup.skills.xp('Endurance'),base:State.variables.character.skills.Endurance,earned:setup.skills.earned('Endurance')};
        State.variables.endurance.used=10;setup.rest.advanceAwake(4);const partial=setup.endurance.ensure().used;
        setup.rest.commit();return {caps,exhausted,recovery,levelup,partial};
    });
    assert.deepEqual(result.caps,[25,30,40,55,75,100,130,165,205,250,300]);
    assert.deepEqual(result.exhausted,{used:25,xp:1,steps:0});assert.deepEqual(result.recovery,{used:24,seconds:5,sprinted:false});
    assert.deepEqual(result.levelup,{used:25,max:30,xp:50,base:49,earned:1});assert.equal(result.partial,10);
    await page.reload();await page.waitForSelector('#player-endurance');
    const after=await page.evaluate(()=>{SugarCube.setup.rest.advanceAwake(1);return {used:SugarCube.setup.endurance.ensure().used,max:SugarCube.setup.endurance.capacity(),earned:SugarCube.setup.skills.earned('Endurance')};});
    assert.deepEqual(after,{used:9,max:30,earned:1});
    await page.getByRole('button',{name:'Stats',exact:true}).click();const endurance=page.locator('.world-skill[data-skill="Endurance"]');assert.match(await endurance.textContent(),/Level 1 \/ 10/);
});

test('Rest in the T menu waits one awake minute and recovers endurance and fatigue without moving',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{const {State}=SugarCube;State.variables.endurance={used:20,sprintSteps:0,recoverySeconds:0};State.variables.rest={version:2,tiredness:50,fatigue:50,awakeSeconds:899,recoverySeconds:0};});
    const before=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.keyboard.press('t');const dialog=page.getByRole('dialog',{name:'Actions',exact:true});
    await dialog.getByRole('button',{name:'Rest',exact:true}).click();assert.match(await dialog.locator('#action-result').textContent(),/rest for 1 minute/);
    const after=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),tiredness:SugarCube.State.variables.rest.tiredness,awake:SugarCube.State.variables.rest.awakeSeconds}));
    assert.deepEqual(after.world,{...before,elapsedSeconds:before.elapsedSeconds+60});assert.equal(after.tiredness,51);assert.equal(after.awake,959);
    assert.equal(await page.locator('#player-endurance').textContent(),'8 / 25');assert.equal(await page.locator('#player-fatigue').textContent(),'49 / 100');
});
