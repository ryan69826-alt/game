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

test('creator is female-only and legacy male saves migrate without losing character choices',async()=>{
    assert.equal(await page.getByLabel('Body Size',{exact:true}).count(),0);
    assert.equal(await page.getByLabel('Breast Size',{exact:true}).count(),0);
    assert.deepEqual(await page.getByLabel('Gender',{exact:true}).locator('option').allTextContents(),['Female']);
    assert.equal((await value()).gender,'Female');assert.equal((await value()).genitals,'Female');
    assert.equal(await page.locator('#character-canvas').getAttribute('data-variation'),'Female-Fixed');
    const old=await page.evaluate(()=>SugarCube.setup.character.normalize({gender:'Male',genitals:'Both',hairColor:'Gray',skills:{Charm:50},clothing:{top:'none',bottoms:'pants',shoes:'none',storage:'backpack'}}));
    assert.equal(old.gender,'Female');assert.equal(old.genitals,'Both');assert.equal(old.hairColor,'Gray');assert.equal(old.skills.Charm,50);assert.equal(old.clothing.storage,'backpack');
});

test('every eye color, hair color, hair length, and skin tone changes the pixels',async()=>{
    const fields={
        'Eye Color':['Blue','Green','Brown'],
        'Hair Color':['Blonde','Black','Brown','Orange','Gray'],
        'Hair Length':['Shaved','Ear','Neck','Chest','Waist','Knee','Floor'],
        'Skin Tone':['Pale','Tan','Olive','Dark']
    };
    for(const gender of ['Female']) for(const [label,choices] of Object.entries(fields)) {
        await page.getByLabel('Gender',{exact:true}).selectOption(gender);
        const images=new Set();
        for(const choice of choices) {await page.getByLabel(label,{exact:true}).selectOption(choice);images.add(await image());}
        assert.equal(images.size,choices.length,`${gender} ${label} has distinct visual choices`);
    }
});

test('each clothing layer toggles independently on the female base without changing the body',async()=>{
    for(const gender of ['Female']) for(const size of ['Medium']) {
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

test('the female base has a proportional head',async()=>{
    for(const key of ['Female']) {
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
    for(const key of ['Female']) {
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

test('long hair keeps its left curtain continuous and inside the canvas on the female base',async()=>{
    await page.getByLabel('Hair Color',{exact:true}).selectOption('Blonde');
    for(const key of ['Female']) {
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
    assert.equal(character.gender,'Female');assert.equal(character.genitals,'Both');assert.equal(character.bodySize,'Medium');assert.equal(character.heightInches,undefined);assert.equal(character.bodyFat,undefined);assert.deepEqual(Object.fromEntries(['top','bottoms','shoes','storage','handheld'].map(slot=>[slot,character.clothing[slot]])),{top:'shirt',bottoms:'pants',shoes:'shoes',storage:'none',handheld:'none'});assert.ok(Object.entries(character.clothing).filter(([slot])=>!['top','bottoms','shoes','storage','handheld'].includes(slot)).every(([,value])=>value==='none'));
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
        await page.getByLabel('Gender',{exact:true}).selectOption('Female');
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
    assert.equal(await dialog.locator('#traits-title').textContent(),'Traits');assert.equal(await dialog.locator('#character-details dt').filter({hasText:/^Clothing$/}).count(),0);
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

test('Apartments has a connected 90 by 74 grid with two roads, parking, park, and four inward entrances',async()=>{
    const layout=await page.evaluate(()=>{
        const map=SugarCube.setup.worldMaps.apartments;
        const seen=new Set(),queue=[map.spawn];
        for(let i=0;i<queue.length;i++) {
            const {x,y}=queue[i],key=`${x},${y}`;
            if(seen.has(key) || !map.tileAt(x,y).walkable) continue;
            seen.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) queue.push({x:x+dx,y:y+dy});
        }
        const towardPark={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
        const sidewalks=new Set(),pathQueue=[{x:25,y:25}];
        for(let i=0;i<pathQueue.length;i++) {
            const {x,y}=pathQueue[i],key=`${x},${y}`;
            if(sidewalks.has(key) || !['path','entrance'].includes(map.tileAt(x,y).kind)) continue;
            sidewalks.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) pathQueue.push({x:x+dx,y:y+dy});
        }
        return {width:map.width,height:map.height,
            horizontal:Array.from({length:90},(_,x)=>map.tileAt(x,66).kind),
            vertical:Array.from({length:65},(_,y)=>map.tileAt(6,y).kind),
            frontParking:{lots:map.parkingLots.length,entrance:[11,12,13,14].every(x=>map.tileAt(x,63).kind==='parking'&&seen.has(`${x},63`)),aisle:[11,15,19,23].every(x=>[59,60].every(y=>map.tileAt(x,y).kind==='parking'&&seen.has(`${x},${y}`))),path:sidewalks.has('11,56'),bays:map.parkingBays.filter(b=>b.x<25).length},
            parking:map.tileAt(79,55).kind,park:map.tileAt(30,33).kind,
            horizontalWidth:[63,64,65,66,67,68,69].map(y=>map.tileAt(30,y).kind==='road'),
            verticalWidth:[3,4,5,6,7,8,9].map(x=>map.tileAt(x,5).kind==='road'),
            parkIsUncut:Array.from({length:544},(_,i)=>map.tileAt(27+i%34,27+Math.floor(i/34)).kind).every(kind=>kind==='park'||kind==='tree'),
            ring:Array.from({length:38},(_,i)=>[[25+i,25],[25+i,44],...(i<20?[[25,25+i],[62,25+i]]:[])]).flat().every(([x,y])=>map.tileAt(x,y).kind==='path'),
            cars:map.cars.map(car=>({area:car.width*car.height,cells:Array.from({length:car.width*car.height},(_,i)=>map.tileAt(car.x+i%car.width,car.y+Math.floor(i/car.width))).every(tile=>tile.kind==='car'&&!tile.walkable)})),
            median:map.tileAt(82,55),
            aisles:[[78,51],[87,51],[78,56],[87,56],[78,60],[87,60]].every(([x,y])=>map.tileAt(x,y).kind==='parking'&&seen.has(`${x},${y}`)),
            entrances:map.buildings.map(building=>{
                const {x,y}=building.door,[dx,dy]=towardPark[building.facing];
                return {reached:seen.has(`${x},${y}`),sidewalkConnected:sidewalks.has(`${x},${y}`),door:map.tileAt(x,y).kind,
                    outward:map.tileAt(x+dx,y+dy).walkable,inward:map.tileAt(x-dx,y-dy).walkable};
            })};
    });
    assert.equal(layout.width,90);assert.equal(layout.height,74);
    assert.ok(layout.horizontal.every(kind=>kind==='road'));assert.ok(layout.vertical.every(kind=>kind==='road'));
    assert.deepEqual(layout.horizontalWidth,[false,true,true,true,true,true,false]);
    assert.deepEqual(layout.verticalWidth,[false,true,true,true,true,true,false]);
    assert.ok(layout.parkIsUncut&&layout.ring,'sidewalk surrounds the intact park');
    assert.ok(layout.cars.length>0);for(const car of layout.cars) assert.deepEqual(car,{area:4,cells:true});
    assert.equal(layout.median.kind,'median');assert.equal(layout.median.walkable,false);assert.ok(layout.aisles);
    assert.deepEqual(layout.frontParking,{lots:2,entrance:true,aisle:true,path:true,bays:12});
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
            y:(world.y-Number(canvas.dataset.cameraY)+.5)/(canvas.height/16)*r.height};
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
    assert.ok(worldBox.x+worldBox.width<mapBox.x,'world map sits in the left sidebar');
    assert.ok(await overview.evaluate(canvas=>!!canvas.closest('.world-sidebar')));
});

test('walls, parked cars, trees, map bounds, and distant clicks do not advance time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const [x,y,dx,dy] of [[32,23,0,-1],[80,52,0,1],[79,55,1,0],[29,36,0,-1],[4,0,0,-1],[89,73,0,1]]) {
        const result=await page.evaluate(({x,y,dx,dy})=>{
            SugarCube.State.variables.world={version:6,mapId:'apartments',x,y,elapsedSeconds:35};
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
        const cases=[undefined,{mapId:'constructor',x:NaN,y:50,elapsedSeconds:-1},{version:6,mapId:'apartments',x:33,y:20,elapsedSeconds:20}];
        return cases.map(value=>{SugarCube.State.variables.world=value;return structuredClone(SugarCube.setup.worldMovement.ensure());});
    });
    for(const result of results) {assert.equal(result.x,30);assert.equal(result.y,33);assert.equal(result.mapId,'apartments');}
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
        SugarCube.State.variables.world={version:6,mapId:'apartments',x:32,y:24,elapsedSeconds:0};
        SugarCube.Engine.play('Apartments');
    });
    await page.waitForSelector('#local-map[data-player-y="24"]');
    await page.keyboard.down('w');await page.clock.runFor(1000);await page.keyboard.up('w');
    assert.equal((await world()).elapsedSeconds,5);assert.equal((await world()).y,23);
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
    await placeInWorld('apartments',60,60);
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const initial=await world();
    await page.keyboard.down('ArrowUp');
    assert.deepEqual(await world(),{...initial,y:59,elapsedSeconds:5});
    await page.keyboard.down('w'); // An alias must not give north extra turns.
    await page.keyboard.down('ArrowRight');
    assert.equal((await world()).elapsedSeconds,5,'adding held keys does not add immediate steps');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:61,y:59,elapsedSeconds:10});
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:61,y:58,elapsedSeconds:15});
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:62,y:58,elapsedSeconds:20});
    await page.keyboard.up('ArrowRight');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:62,y:57,elapsedSeconds:25},'the original Up key resumes when Right is released');
    await page.keyboard.up('ArrowUp');
    await page.clock.runFor(200);assert.deepEqual(await world(),{...initial,x:62,y:56,elapsedSeconds:30},'W remains active after the other keys are released');
    await page.keyboard.up('w');const released=await world();
    await page.clock.runFor(600);assert.deepEqual(await world(),released);
    await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowRight');
    assert.equal((await world()).x,61);
    await page.clock.runFor(200);assert.equal((await world()).x,62);
    await page.clock.runFor(200);assert.equal((await world()).x,61,'opposite directions also alternate');
    await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
});

test('a blocked held direction remains active and can resume after another direction clears it',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{
        SugarCube.State.variables.world={version:6,mapId:'apartments',x:28,y:35,elapsedSeconds:0};
        SugarCube.Engine.play('Apartments');
    });
    await page.waitForSelector('#local-map[data-player-x="28"]');
    const world=()=>page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.keyboard.down('d');await page.clock.runFor(400);
    assert.equal((await world()).elapsedSeconds,0,'the tree blocks east without advancing time');
    await page.keyboard.down('s');await page.clock.runFor(200);
    assert.equal((await world()).y,36);assert.equal((await world()).elapsedSeconds,5);
    await page.clock.runFor(200);assert.equal((await world()).x,29);assert.equal((await world()).elapsedSeconds,10,'east is still held and now unblocked');
    await page.keyboard.up('s');await page.clock.runFor(200);
    assert.equal((await world()).x,30);assert.equal((await world()).elapsedSeconds,15);
    await page.keyboard.up('d');const released=await world();
    await page.clock.runFor(600);assert.deepEqual(await world(),released);
});

test('interaction reach uses door squares and full car footprints, excluding diagonals',async()=>{
    const reach=await page.evaluate(()=>{
        const api=SugarCube.setup.interactions,map=SugarCube.setup.worldMaps.apartments;
        const has=(id,x,y)=>api.nearby({mapId:'apartments',x,y}).some(target=>target.object.id===id);
        return {count:map.interactables.length,unique:new Set(map.interactables.map(object=>object.id)).size,
            doorAdjacent:has('apartment-door-1',32,24),doorOn:has('apartment-door-1',32,23),doorDiagonal:has('apartment-door-1',33,24),
            carLeft:has('parked-car-1',76,48),carRight:has('parked-car-1',79,49),carBelow:has('parked-car-1',78,50),carDiagonal:has('parked-car-1',79,50)};
    });
    assert.deepEqual(reach,{count:17,unique:17,doorAdjacent:true,doorOn:true,doorDiagonal:false,carLeft:true,carRight:true,carBelow:true,carDiagonal:false});
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
    await placeInWorld('apartments',32,24);
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
    await page.evaluate(()=>{SugarCube.State.variables.world.x=79;SugarCube.State.variables.world.y=49;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="79"]');
    await page.keyboard.press('e');
    const dialog=page.getByRole('dialog',{name:'Interact',exact:true});await dialog.waitFor({state:'visible'});
    await dialog.getByRole('button',{name:'Look through window',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/No one is inside/);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
        const map=SugarCube.setup.worldMaps.apartments;
        map.interactables.push({id:'test-note',name:'Folded note',kind:'ground',x:30,y:33,
            actions:[{id:'read',label:'Read',result:'A short handwritten message.'}]},
            {id:'test-resident',name:'Test resident',kind:'npc',x:31,y:33,description:'A resident standing nearby.'});
        SugarCube.State.variables.world.x=30;SugarCube.State.variables.world.y=33;SugarCube.Engine.play('Apartments');
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
    await page.evaluate(()=>{SugarCube.State.variables.world.x=32;SugarCube.State.variables.world.y=24;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="24"]');
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
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map[data-player-y="24"]');
    assert.notEqual(await pixels(),closed,'open appearance survives reload');
    await page.keyboard.press('e');await dialog.locator('.interaction-actions').getByRole('button',{name:'Close',exact:true}).waitFor({state:'visible'});assert.equal(await dialog.getByRole('button',{name:'Open',exact:true}).count(),0);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{SugarCube.State.variables.world.x=79;SugarCube.State.variables.world.y=49;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="79"]');
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
        const cases=[[76,48],[76,49],[79,48],[79,49],[77,50],[78,50],[77,47],[78,47],[76,50],[79,50],[76,47],[79,47]];
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
        SugarCube.State.variables.world.x=78;SugarCube.State.variables.world.y=50;
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
    await page.evaluate(()=>{SugarCube.State.variables.world.x=78;SugarCube.State.variables.world.y=50;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="50"]');
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
    await page.reload();await page.waitForSelector('#local-map[data-player-y="50"]');
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
    assert.equal(await player.locator('.inventory-grid .inventory-item').count(),2);
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
        const {State,setup}=SugarCube;State.variables.world.x=78;State.variables.world.y=50;
        const inv=setup.inventory, container=inv.openTrunk('parked-car-1');
        const item=inv.placements(container)[0];const before=JSON.stringify(State.variables.inventory);
        const attempts=[
            inv.transfer(container.id,container.id,item.id,2,0,'parked-car-1'),
            inv.transfer(container.id,container.id,item.id,5,3,'parked-car-1'),
            inv.transfer(container.id,container.id,item.id,.5,1,'parked-car-1'),
            inv.transfer(container.id,'worn:backpack',item.id,0,0,'parked-car-1')
        ];
        const unchanged=before===JSON.stringify(State.variables.inventory);
        State.variables.world.x=79;State.variables.world.y=49;
        const remote=inv.transfer(container.id,'worn:pants:1',item.id,0,0,'parked-car-1');
        return {attempts,unchanged,remote,finalUnchanged:before===JSON.stringify(State.variables.inventory)};
    });
    assert.ok(results.attempts.every(result=>!result.ok));assert.ok(results.unchanged);assert.equal(results.remote.ok,false);assert.ok(results.finalUnchanged);
});

test('inventory fits narrow screens and large text and blocks movement while open',async()=>{
    await page.locator('#clothing-storage').selectOption('backpack');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{SugarCube.State.variables.world.x=78;SugarCube.State.variables.world.y=50;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="50"]');
    await page.keyboard.press('e');await page.getByRole('button',{name:'Open trunk',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await dialog.waitFor({state:'visible'});
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.keyboard.press('ArrowDown');assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),expected);
    for(const width of [1440,700,390,320,700,1440,700]) {
        await page.setViewportSize({width,height:844});await page.evaluate(()=>document.documentElement.classList.add('large-text'));
        if(width===700) {
            const stale=await dialog.evaluate(node=>{node.style.left='100px';node.style.right='100px';const rect=node.getBoundingClientRect();return {client:node.clientWidth,scroll:node.scrollWidth,left:rect.left,right:rect.right};});
            assert.ok(stale.scroll<=stale.client&&stale.left>=0&&stale.right<=width,'stale framework insets cannot squeeze inventory contents outside the window');
        }
        // Exercise both shrinking and growing while the dialog stays open.
        // CSS sizing must remain valid before SugarCube's resize callback runs.
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
    await page.evaluate(()=>{SugarCube.State.variables.world.x=78;SugarCube.State.variables.world.y=50;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-y="50"]');await page.keyboard.press('e');await page.getByRole('button',{name:'Open trunk',exact:true}).click();
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
    for(const gender of ['Female']) for(const size of ['Medium']) {
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
    assert.equal(results.length,12);
    for(const car of results) {
        const expected=[48,57].includes(car.y)?'north':'south';
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
    await page.evaluate(()=>{SugarCube.State.variables.world.x=82;SugarCube.State.variables.world.y=54;SugarCube.Engine.play('Apartments');});
    await page.waitForSelector('#local-map[data-player-x="82"]');
    const lamps=await page.evaluate(()=>{
        // Check every lot, including cars outside the current camera viewport.
        const canvas=SugarCube.setup.worldMapArt.paint(SugarCube.setup.worldMaps.apartments),ctx=canvas.getContext('2d');
        const ox=0,oy=0;
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

test('four single-floor interiors rotate their four furnished units and exits to match the buildings',async()=>{
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
        assert.equal(map.units.length,4);assert.ok(map.units.every(unit=>unit.reached));ids.push(...map.units.map(unit=>unit.id));
        assert.equal(map.beds,4);assert.equal(map.kitchens,4);assert.equal(map.bathrooms,4);assert.ok(map.blocked&&map.outside&&map.spawn);
        if(map.facing==='north') assert.equal(map.exit.y,0);
        if(map.facing==='south') assert.equal(map.exit.y,map.height-1);
        if(map.facing==='east') assert.equal(map.exit.x,map.width-1);
        if(map.facing==='west') assert.equal(map.exit.x,0);
    }
    assert.equal(new Set(ids).size,16);
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
    assert.deepEqual(await nav.locator('a').allTextContents(),['Inventory [i]','Quests/Jobs [j]','Character [c]','Stats']);
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
    await walkTo(69,53);await openPortal('Enter','housing-office');
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
    await walkTo(55,45);await openPortal('Enter','apartment-3');
    // Unit 4 is west of this hallway after rotating the north-facing building.
    await walkTo(6,4);await page.keyboard.press('e');await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.match(await dialog.locator('#interaction-result').textContent(),/locked/);
    await dialog.getByRole('button',{name:'Unlock',exact:true}).click();await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.equal(await dialog.locator('#interaction-result').textContent(),'You open the door.');await page.keyboard.press('Escape');
    await page.keyboard.press('s');await page.keyboard.press('s');
    assert.match(await page.locator('#position-description').textContent(),/unit 4 living area/);
    const blocked=await page.evaluate(()=>{
        const {setup,State}=SugarCube;const old={...State.variables.world};State.variables.world.x=42;State.variables.world.y=4;
        const open=setup.interactions.run('unit-door-3-1','open'),step=setup.worldMovement.move(0,1);State.variables.world=old;
        return {open,step,otherOpen:setup.interactions.isOpen('unit-door-3-1')};
    });
    assert.match(blocked.open.message,/locked/);assert.equal(blocked.step.moved,false);assert.equal(blocked.otherOpen,false);
    await page.reload();await page.waitForSelector('#local-map[data-map-id="apartment-3"]');
    const expected=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),player:structuredClone(SugarCube.State.variables.player),housing:structuredClone(SugarCube.State.variables.housing)}));
    assert.equal(expected.world.x,6);assert.equal(expected.housing.rentedUnit,'3-4');assert.equal(expected.player.money,99399);
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
    await walkTo(69,53);const elapsed=await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds);
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
        State.variables.world={...State.variables.world,mapId:'apartments',x:30,y:33,elapsedSeconds:week-10};
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
    assert.equal(result.world.version,6);assert.equal(result.world.turn,undefined);assert.equal(result.world.elapsedSeconds,85);assert.deepEqual(result.again,result.world);
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
    assert.deepEqual(result.ids,['1-2','1-3','2-3','3-1','3-4','4-4']);assert.equal(result.hidden.ok,false);assert.equal(result.moneyBefore,99999);
    assert.ok(result.rented.ok);assert.equal(result.denied.ok,false);assert.equal(result.beforeKey,false);assert.equal(result.moved.ok,true);assert.equal(result.afterKey,true);
    assert.equal(result.keyCount,1);assert.equal(result.remote.ok,false);assert.equal(result.money,99399);assert.equal(result.elapsed,0);
});

test('a key only opens its matching door while carried; open doors remain passable after the key is put down',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const {setup,State}=SugarCube;State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        setup.housing.rent('1-2');const tray=setup.housing.counter(),key=setup.inventory.placements(tray)[0];
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:17,y:10};
        const without=setup.interactions.run('unit-door-1-2','open');
        State.variables.world={...State.variables.world,mapId:'housing-office',x:8,y:7};
        setup.inventory.transfer(tray.id,'worn:shirt',key.id,0,0,'housing-counter');
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:5,y:10};
        const wrong=setup.interactions.run('unit-door-1-1','open');
        State.variables.world.x=17;setup.interactions.run('unit-door-1-2','unlock');const right=setup.interactions.run('unit-door-1-2','open');
        setup.inventory.ensure().containers['worn:shirt']=[];setup.inventory.ensure().containers[tray.id]=[key];
        const step=setup.worldMovement.move(0,-1);
        return {without,wrong,right,step,opened:setup.interactions.isOpen('unit-door-1-2'),keyCount:Object.values(State.variables.inventory.containers).flat().filter(item=>item.id===key.id).length};
    });
    assert.equal(result.without.ok,false);assert.match(result.without.message,/matching key/);assert.equal(result.wrong.ok,false);
    assert.equal(result.right.ok,true);assert.ok(result.opened&&result.step.moved);assert.equal(result.keyCount,1);
});

test('room masking conceals furniture, reveals only a nearby open room, and hides it again away from the doorway',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await placeInWorld('apartment-1',17,10);
    const bedPixel=()=>page.locator('#local-map').evaluate(canvas=>{const bed=SugarCube.setup.worldMaps['apartment-1'].interactables.find(o=>o.id==='bed-1-2');return Array.from(canvas.getContext('2d').getImageData((bed.x-Number(canvas.dataset.cameraX))*16+8,(bed.y+1-Number(canvas.dataset.cameraY))*16+8,1,1).data);});
    const hidden=await bedPixel();assert.deepEqual(hidden,[16,28,33,255]);
    const access=await page.evaluate(()=>{
        SugarCube.State.variables.openedObjects={'apartment-1:unit-door-1-2':true};
        const {setup,State}=SugarCube,map=setup.worldMaps['apartment-1'];
        return map.units.map(unit=>({id:unit.id,visible:setup.rooms.cellVisible(map,unit.anchor.x,unit.anchor.y,State.variables.world)}));
    });
    assert.deepEqual(access.filter(unit=>unit.visible).map(unit=>unit.id),['1-2']);
    await placeInWorld('apartment-1',17,10);assert.notDeepEqual(await bedPixel(),hidden);
    await placeInWorld('apartment-1',11,10);assert.deepEqual(await bedPixel(),hidden);
    await placeInWorld('apartment-1',20,3);assert.notDeepEqual(await bedPixel(),hidden);
    const bath=await page.evaluate(()=>{
        const {setup,State}=SugarCube,map=setup.worldMaps['apartment-1'],unit=map.units.find(unit=>unit.id==='1-2');
        State.variables.world.x=17;State.variables.world.y=3;
        const before=setup.rooms.cellVisible(map,15,3);setup.interactions.run('bathroom-door-1-2','open');
        const open=setup.rooms.cellVisible(map,15,3);State.variables.world.x=14;
        setup.interactions.run('bathroom-door-1-2','close');
        return {before,open,inside:setup.rooms.cellVisible(map,15,3),living:setup.rooms.cellVisible(map,unit.anchor.x,unit.anchor.y),
            bedHidden:!setup.interactions.nearby().some(target=>target.object.kind==='bed')};
    });
    assert.deepEqual(bath,{before:false,open:true,inside:true,living:false,bedHidden:true});
});

test('room sounds require a present source and silence stale activity without advancing time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',20,3);
    const before=await page.evaluate(()=>SugarCube.setup.gameClock.now());assert.match(await page.locator('#room-sounds').textContent(),/ventilation/i);
    const denied=await page.evaluate(()=>SugarCube.setup.rooms.setActivity('apartment-1','1-2','music'));assert.equal(denied,false);
    await page.evaluate(()=>{const {setup}=SugarCube;setup.worldMaps['apartment-1'].interactables.push({id:'test-radio',kind:'ground',name:'Radio',x:19,y:4,soundActivities:['music']});setup.rooms.setActivity('apartment-1','1-2','music','test-radio');});
    assert.match(await page.locator('#room-sounds').textContent(),/Music plays/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),before);
    await page.reload();await page.waitForSelector('#room-sounds');assert.match(await page.locator('#room-sounds').textContent(),/ventilation/i);
    await placeInWorld('apartment-1',11,10);assert.match(await page.locator('#room-sounds').textContent(),/quiet hallway/);assert.doesNotMatch(await page.locator('#room-sounds').textContent(),/footsteps|traffic/i);
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
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',20,3);
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
    await placeInWorld('apartments',81,50);
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
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',20,3);
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
    await page.keyboard.press('Escape');await placeInWorld('apartment-1',20,3);
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
    await placeInWorld('apartment-1',17,10);
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
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',5,10);
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
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:5,y:13};
        const lock=setup.interactions.run('exit-apartment-1','lock');
        State.variables.world={...State.variables.world,mapId:'apartments',x:32,y:24};
        const blocked=setup.interactions.run('apartment-door-1','open');
        const pickedEntrance=setup.interactions.run('apartment-door-1','lockpick');
        const entranceOpen=setup.interactions.run('apartment-door-1','open');
        State.variables.world={...State.variables.world,mapId:'apartment-1',x:5,y:13};
        const mirroredOpen=setup.interactions.isOpen('exit-apartment-1');setup.interactions.run('exit-apartment-1','close');
        return {partial,partialState,picked,closed,unlocked,open,all,lock,blocked,pickedEntrance,entranceOpen,mirroredOpen,mirroredClosed:!setup.interactions.isOpen('apartment-door-1','apartments'),elapsed:State.variables.world.elapsedSeconds-worldBefore};
    });
    assert.equal(result.partial.chance,50);assert.equal(result.partialState,!result.partial.ok);
    assert.ok(result.picked.ok&&result.closed&&result.unlocked&&result.open.ok);assert.equal(result.picked.chance,100);
    for(const actions of result.all) {assert.ok(actions.includes('unlock')!==actions.includes('lock'));assert.equal(actions.includes('lockpick'),actions.includes('unlock'));}
    assert.ok(result.lock.ok);assert.equal(result.blocked.ok,false);assert.ok(result.pickedEntrance.ok&&result.entranceOpen.ok&&result.mirroredOpen&&result.mirroredClosed);assert.equal(result.elapsed,0);
});

test('door controls replace open/close and lock/unlock and every apartment lock is level two',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartment-1',17,10);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true}),actions=dialog.locator('.interaction-actions');
    assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Unlock','Lockpick · Level 2 · 0% chance']);
    await page.evaluate(()=>{SugarCube.setup.inventory.ensure().containers['worn:shirt']=[{id:'apartment-key:1-2',type:'apartmentKey',x:0,y:0}];});
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Lock']);
    await actions.getByRole('button',{name:'Open',exact:true}).click();assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Close','Lock']);
    await actions.getByRole('button',{name:'Close',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    assert.deepEqual(await actions.locator('button').allTextContents(),['Knock','Open','Unlock','Lockpick · Level 2 · 0% chance']);
    const levels=await page.evaluate(()=>Object.values(SugarCube.setup.worldMaps).flatMap(map=>map.interactables.filter(object=>object.unitId&&object.kind==='door').map(object=>SugarCube.setup.doorLocks.difficulty(object))));
    assert.equal(levels.length,16);assert.ok(levels.every(level=>level===2));
});

test('unowned vehicle doors and trunks start independently locked and reject inventory access until unlocked',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true}),actions=dialog.locator('.interaction-actions');
    assert.match(await actions.textContent(),/Lockpick · Level 3 · 0% chance/);
    await actions.getByRole('button',{name:'Open door',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/locked/);
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/matching key/);
    await page.evaluate(()=>{SugarCube.setup.inventory.ensure().containers['worn:shirt']=[{id:'vehicle-key:apartments:parked-car-1',type:'vehicleKey',x:0,y:0}];});
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();await actions.getByRole('button',{name:'Open door',exact:true}).click();
    assert.equal(await actions.getByRole('button',{name:'Open door',exact:true}).count(),0);
    await actions.getByRole('button',{name:'Close door',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    await page.keyboard.press('Escape');await placeInWorld('apartments',78,50);await page.keyboard.press('e');
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
    assert.equal(await atlas.getAttribute('data-location-id'),'apartments');assert.equal(await atlas.getAttribute('data-icon-count'),'4');
    const before=await atlas.evaluate(canvas=>canvas.toDataURL());await page.keyboard.press('d');
    assert.equal(await atlas.evaluate(canvas=>canvas.toDataURL()),before);
    await placeInWorld('apartment-2',2,5);assert.equal(await atlas.evaluate(canvas=>canvas.toDataURL()),before);
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
    await page.clock.runFor(1);await page.keyboard.up('d');assert.equal(await page.locator('#player-time').textContent(),'08:00:11');assert.equal(await page.locator('#player-endurance').textContent(),'2.94 / 25');
    await page.getByRole('button',{name:'Sprint [Shift]',exact:true}).click();await page.keyboard.press('a');
    assert.equal(await page.locator('#player-time').textContent(),'08:00:13');assert.equal(await page.locator('#player-endurance').textContent(),'3.94 / 25');
    await page.keyboard.press('t');await page.getByRole('button',{name:'Pass Time',exact:true}).click();assert.equal(await page.locator('#player-endurance').textContent(),'0.1 / 25');
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
    assert.deepEqual(result.exhausted,{used:25,xp:1,steps:0});assert.deepEqual(result.recovery,{used:24.5,seconds:5,sprinted:false});
    assert.deepEqual(result.levelup,{used:25,max:30,xp:50,base:49,earned:1});assert.equal(result.partial,10);
    await page.reload();await page.waitForSelector('#player-endurance');
    const after=await page.evaluate(()=>{SugarCube.setup.rest.advanceAwake(1);return {used:SugarCube.setup.endurance.ensure().used,max:SugarCube.setup.endurance.capacity(),earned:SugarCube.setup.skills.earned('Endurance')};});
    assert.deepEqual(after,{used:9.8,max:30,earned:1});
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
    assert.equal(await page.locator('#player-endurance').textContent(),'15.69 / 25');assert.equal(await page.locator('#player-fatigue').textContent(),'49 / 100');
});

test('world atlas sits above the sidebar character and the local map uses the freed vertical space',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await stableAtlas();
    const layout=await page.evaluate(()=>{
        const atlas=document.querySelector('.world-sidebar .world-map-panel'),character=document.querySelector('.sidebar-character'),local=document.getElementById('local-map');
        const a=atlas.getBoundingClientRect(),c=character.getBoundingClientRect(),l=local.getBoundingClientRect();
        return {atlasBottom:a.bottom,characterTop:c.top,localHeight:l.height,rows:local.height/16,
            rightAtlases:document.querySelectorAll('.map-stack .world-map-panel').length,windowHeight:innerHeight,localBottom:l.bottom};
    });
    assert.ok(layout.atlasBottom<layout.characterTop);assert.equal(layout.rightAtlases,0);
    assert.ok(layout.localHeight>700);assert.ok(layout.rows>35);assert.ok(layout.localBottom<layout.windowHeight);
});

test('four apartment numbers follow one row from the entrance across every rotation',async()=>{
    const plans=await page.evaluate(()=>Object.values(SugarCube.setup.worldMaps).filter(map=>/^apartment-\d$/.test(map.id)).map(map=>({id:map.id,units:map.units.map(unit=>({id:unit.id,number:unit.number,name:unit.name})),size:[map.width,map.height]})));
    for(const plan of plans){assert.deepEqual(plan.units.map(unit=>unit.number),[1,2,3,4]);assert.ok(plan.size.includes(48)&&plan.size.includes(15));for(const unit of plan.units)assert.match(unit.name,new RegExp(`Unit ${unit.number}$`));}
});

test('repeated Shift events do not stall held sprinting; breath passes five and exhaustion falls back to walking',async()=>{
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',10,66);
    await page.keyboard.down('Shift');await page.keyboard.down('d');
    for(let repeat=0;repeat<48;repeat++) {await page.clock.runFor(50);await page.keyboard.down('Shift');}
    assert.equal(await page.locator('#player-endurance').textContent(),'25 / 25');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),35);assert.equal(await page.locator('#player-time').textContent(),'08:00:50');
    await page.clock.runFor(200);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),36);
    assert.equal(await page.locator('#player-time').textContent(),'08:00:55');assert.equal(await page.locator('#player-endurance').textContent(),'24.5 / 25');
    assert.match(await page.locator('#movement-status').textContent(),/Out of breath/);
    await page.clock.runFor(100);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),36);
    await page.clock.runFor(900);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),41);assert.equal(await page.locator('#player-endurance').textContent(),'22.15 / 25');
    await page.clock.runFor(100);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),41);assert.equal(await page.locator('#player-time').textContent(),'08:01:20');
    await page.keyboard.up('d');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>SugarCube.setup.skills.earned('Endurance')),1);
});

test('car window money rolls have exact 15-percent boundaries and one-to-120 dollar amounts',async()=>{
    const rolls=await page.evaluate(()=>{
        const roll=SugarCube.setup.vehicleContents.roll;
        const withDraws=values=>roll(()=>values.shift());
        return {low:withDraws([1,1]),edge:withDraws([15,120]),miss:withDraws([16]),highMiss:withDraws([100]),
            population:Array.from({length:100},(_,index)=>withDraws([index+1,60]).money).filter(Boolean).length};
    });
    assert.deepEqual(rolls,{low:{money:1},edge:{money:120},miss:{money:0},highMiss:{money:0},population:15});
});

test('looking through car windows reports stable visible money without changing cash or time, including after reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    await page.evaluate(()=>{SugarCube.State.variables.vehicleContents={'apartments:parked-car-1':{money:120},'apartments:parked-car-2':{money:0}};});
    const before=await page.evaluate(()=>({cash:SugarCube.State.variables.player.money,time:SugarCube.setup.gameClock.now()}));
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
    await dialog.getByRole('button',{name:'Look through window',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/\$120 lying on a seat/);
    await dialog.getByRole('button',{name:'Look through window',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/\$120 lying on a seat/);
    await page.evaluate(()=>SugarCube.State.create(SugarCube.State.passage));await page.reload();await page.waitForSelector('#local-map');
    await page.keyboard.press('e');await dialog.getByRole('button',{name:'Look through window',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/\$120/);
    assert.deepEqual(await page.evaluate(()=>({cash:SugarCube.State.variables.player.money,time:SugarCube.setup.gameClock.now()})),before);
    await page.keyboard.press('Escape');await placeInWorld('apartments',83,49);await page.keyboard.press('e');
    await dialog.getByRole('button',{name:'Look through window',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/no money is visible/);
    await page.keyboard.press('Escape');await placeInWorld('apartments',89,49);
    const generated=await page.evaluate(()=>{const {setup,State}=SugarCube;const first=setup.interactions.run('parked-car-3','look-inside'),moment=State.length;
        const second=setup.interactions.run('parked-car-3','look-inside');return {first,second,moment,after:State.length,stored:State.variables.vehicleContents['apartments:parked-car-3']};});
    assert.ok(generated.first.ok);assert.ok(generated.first.visibleMoney>=0&&generated.first.visibleMoney<=120);
    assert.equal(generated.second.visibleMoney,generated.first.visibleMoney);assert.equal(generated.stored.money,generated.first.visibleMoney);assert.equal(generated.after,generated.moment);
});

test('open car doors offer entry; seated actions include disabled Hotwire and exit, and walking cannot move the car',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true}),actions=dialog.locator('.interaction-actions');
    assert.equal(await actions.getByRole('button',{name:'Get in car',exact:true}).count(),0);
    await page.evaluate(()=>{SugarCube.setup.inventory.ensure().containers['worn:shirt']=[{id:'vehicle-key:apartments:parked-car-1',type:'vehicleKey',x:0,y:0}];});
    await actions.getByRole('button',{name:'Unlock',exact:true}).click();await actions.getByRole('button',{name:'Open door',exact:true}).click();
    await actions.getByRole('button',{name:'Get in car',exact:true}).click();
    assert.ok(await actions.getByRole('button',{name:'Hotwire',exact:true}).isDisabled());assert.ok(await actions.getByRole('button',{name:'Get out of car',exact:true}).isVisible());
    assert.match(await page.locator('#position-description').textContent(),/inside: parked car 1/);assert.match(await page.locator('#room-sounds').textContent(),/engine is off/i);
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube,before=structuredClone(State.variables.world);const hotwire=setup.interactions.run('parked-car-1','hotwire'),move=setup.worldMovement.move(1,0,true);return {hotwire,move,before,after:structuredClone(State.variables.world),used:setup.endurance.ensure().used};});
    assert.equal(result.hotwire.ok,false);assert.match(result.hotwire.message,/not available/);assert.equal(result.move.moved,false);assert.deepEqual(result.after,result.before);assert.equal(result.used,0);
    await actions.getByRole('button',{name:'Close door',exact:true}).click();await actions.getByRole('button',{name:'Lock',exact:true}).click();
    await actions.getByRole('button',{name:'Get out of car',exact:true}).click();assert.match(await page.locator('#position-description').textContent(),/You are at:/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.vehicleCabin.current()),null);await page.keyboard.press('Escape');await page.keyboard.press('s');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.y),50);
});

test('seated Inventory shows separate empty cabin storage, supports item transfers, and retains seating and items on reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.ownedVehicles=['apartments:parked-car-1'];setup.inventory.ensure().containers['worn:shirt']=[{id:'test-cloth',type:'cloth',x:0,y:0}];setup.interactions.run('parked-car-1','unlock');setup.interactions.run('parked-car-1','open');setup.interactions.run('parked-car-1','get-in');});
    await page.getByRole('button',{name:'Inventory',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Cabin & inventory',exact:true});await dialog.waitFor({state:'visible'});
    const cabin=dialog.locator('[data-container="cabin:apartments:parked-car-1"]');assert.equal(await cabin.locator('.inventory-item').count(),0);assert.equal(await dialog.locator('[data-container^="trunk:"]').count(),0);assert.equal(await cabin.locator('.inventory-cell').count(),12);
    await dialog.getByRole('button',{name:'Cleaning cloth, 1 by 1 blocks, Shirt pocket',exact:true}).click();await cabin.locator('[data-x="0"][data-y="0"]').click();assert.equal(await cabin.locator('.inventory-item').count(),1);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map[data-vehicle-id="parked-car-1"]');
    await page.getByRole('button',{name:'Inventory',exact:true}).click();await dialog.waitFor({state:'visible'});assert.equal(await cabin.locator('.inventory-item').count(),1);
    await page.keyboard.press('Escape');await page.keyboard.press('e');await page.getByRole('button',{name:'Get out of car',exact:true}).click();await page.keyboard.press('Escape');
    const inaccessible=await page.evaluate(()=>SugarCube.setup.inventory.external('cabin:parked-car-1'));assert.equal(inaccessible,null);
    await placeInWorld('apartments',78,50);await page.keyboard.press('e');const interact=page.getByRole('dialog',{name:'Interact',exact:true});await interact.getByRole('button',{name:'Open trunk',exact:true}).click();
    const trunk=page.getByRole('dialog',{name:'Trunk & inventory',exact:true});await trunk.waitFor({state:'visible'});assert.equal(await trunk.locator('[data-container^="cabin:"]').count(),0);assert.equal(await trunk.locator('[data-container^="trunk:"] .inventory-item').count(),3);
});

test('exact spotted cabin money can be taken once through seated inventory and never respawns',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    const before=await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.ownedVehicles=['apartments:parked-car-1'];State.variables.vehicleContents={'apartments:parked-car-1':{money:73}};const denied=setup.vehicleContents.take('parked-car-1');setup.interactions.run('parked-car-1','look-inside');setup.interactions.run('parked-car-1','unlock');setup.interactions.run('parked-car-1','open');setup.interactions.run('parked-car-1','get-in');return {cash:State.variables.player.money,time:setup.gameClock.now(),denied};});
    assert.equal(before.denied.ok,false);await page.getByRole('button',{name:'Inventory',exact:true}).click();const inventory=page.getByRole('dialog',{name:'Cabin & inventory',exact:true});
    await inventory.getByRole('button',{name:'Take $73',exact:true}).click();assert.equal(await page.locator('#player-money').textContent(),'$100,072');assert.equal(await inventory.getByRole('button',{name:'Take $73',exact:true}).count(),0);
    const taken=await page.evaluate(()=>({repeat:SugarCube.setup.vehicleContents.take('parked-car-1'),money:SugarCube.State.variables.player.money,time:SugarCube.setup.gameClock.now()}));
    assert.equal(taken.repeat.ok,false);assert.equal(taken.money,before.cash+73);assert.equal(taken.time,before.time);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map[data-vehicle-id="parked-car-1"]');
    await page.keyboard.press('e');assert.equal(await page.getByRole('dialog',{name:'Interact',exact:true}).getByRole('button',{name:'Take $73',exact:true}).count(),0);
    await page.getByRole('button',{name:'Get out of car',exact:true}).click();await page.getByRole('button',{name:'Look through window',exact:true}).click();assert.match(await page.locator('#interaction-result').textContent(),/no money is visible/);
});

test('cabin storage cannot reach another car or a trunk and cash actions reject stale targets',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',79,49);
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.ownedVehicles=['apartments:parked-car-1','apartments:parked-car-2'];State.variables.vehicleContents={'apartments:parked-car-1':{money:120},'apartments:parked-car-2':{money:45}};setup.interactions.run('parked-car-1','unlock');setup.interactions.run('parked-car-1','open');setup.interactions.run('parked-car-1','get-in');const other=setup.inventory.openExternal('cabin:parked-car-2'),trunk=setup.inventory.openTrunk('parked-car-1'),otherCash=setup.vehicleContents.take('parked-car-2');State.variables.world.x=83;const stale=setup.vehicleContents.take('parked-car-1');return {other,trunk,otherCash,stale,seat:setup.vehicleCabin.current(),cash:State.variables.player.money};});
    assert.equal(result.other,null);assert.equal(result.trunk,null);assert.equal(result.otherCash.ok,false);assert.equal(result.stale.ok,false);assert.equal(result.seat,null);assert.equal(result.cash,99999);
});

test('default ambience follows nearby environment and contains no phantom traffic, footsteps or human activity',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const results=await page.evaluate(()=>{const {setup,State}=SugarCube;const points=[['apartments',30,33],['apartments',0,46],['apartment-1',11,10],['apartment-1',20,3],['apartment-1',14,3],['housing-office',8,7]];return points.map(([mapId,x,y])=>{State.variables.world={...State.variables.world,mapId,x,y};State.variables.roomActivities={[`${mapId}:hall`]:'conversation'};return {mapId,x,y,sound:setup.rooms.sounds()};});});
    for(const result of results) assert.doesNotMatch(result.sound,/traffic|footstep|voice|laughter|paper|keys tap|music|tools tap/i);
    assert.match(results[0].sound,/leaves/);assert.doesNotMatch(results[1].sound,/leaves/);assert.match(results[2].sound,/quiet hallway/);assert.match(results[4].sound,/extractor fan/);
});

test('district atlas reveals only Apartments and cardinal neighbors, with readable names in an overlay',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await stableAtlas();
    assert.equal(await page.locator('#world-map-count').textContent(),'4 DISCOVERED');
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.worldAtlas.visible().map(area=>area.coordinate).sort()),['B1','C1','C2','D1']);
    const before=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.getByRole('button',{name:'Expand world map',exact:true}).click();
    const dialog=page.locator('#ui-dialog');assert.equal(await dialog.isVisible(),true);
    assert.equal(await dialog.locator('[data-district-id]').count(),4);
    assert.match(await dialog.innerText(),/Warehouse\/Storage/);assert.match(await dialog.innerText(),/Marketplace/);
    assert.match(await dialog.innerText(),/Transit Area w\/ Shops/);
    assert.doesNotMatch(await dialog.innerText(),/Gas Station Area|Corporate Housing|Nightlife|Military Base/);
    assert.equal(await dialog.locator('.atlas-current').innerText(),'C1\nApartments\nYou are here');
    assert.equal(await dialog.locator('button,a').filter({hasText:/Travel|Enter/}).count(),0);
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),before);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert.equal(await page.locator('#local-map').isVisible(),true);
});

test('district discovery accumulates without recursively revealing neighbors and survives reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const known=await page.evaluate(()=>{
        const {setup,State}=SugarCube;
        // A future district supplies worldArea regardless of its walkable dimensions.
        setup.worldMaps['future-market']={id:'future-market',worldArea:'c2',width:160,height:90,spawn:{x:100,y:70},tileAt:()=>({walkable:true})};
        State.variables.world={...State.variables.world,mapId:'future-market',x:100,y:70};setup.worldMovement.ensure();
        const result={coordinates:setup.worldAtlas.visible().map(area=>area.coordinate).sort(),world:structuredClone(State.variables.world)};
        State.variables.world={...State.variables.world,mapId:'apartments',x:30,y:40};setup.worldMovement.ensure();State.create(State.passage);
        return result;
    });
    assert.deepEqual(known.coordinates,['B1','B2','C1','C2','C3','D1','D2']);
    assert.equal(known.world.x,100);assert.equal(known.world.y,70);
    await page.reload();await page.waitForSelector('#world-map');
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.worldAtlas.visible().map(area=>area.coordinate).sort()),known.coordinates);
    assert.deepEqual(await page.evaluate(()=>SugarCube.State.variables.worldDiscovery.visited.sort()),['apartments','c2']);
    await page.getByRole('button',{name:'Expand world map',exact:true}).click();
    assert.equal(await page.locator('#ui-dialog [data-district-id]').count(),7);
    assert.doesNotMatch(await page.locator('#ui-dialog').innerText(),/Park|City Center|Military Base/);
});

test('west edge travel enters the larger B1 district automatically and east returns to Apartments',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await placeInWorld('apartments',0,66);await page.getByRole('button',{name:'Move west',exact:true}).click();
    await page.waitForSelector('#local-map[data-map-id="b1"]');
    assert.match(await page.locator('#location-title').innerText(),/Warehouse/);
    assert.match(await page.locator('#local-map-title').innerText(),/70 × 90/);
    assert.deepEqual(await page.evaluate(()=>({id:SugarCube.State.variables.world.mapId,x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{id:'b1',x:69,y:46,time:5});
    assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'b1');
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.worldAtlas.visible().map(a=>a.coordinate).sort()),['A1','B1','B2','C1','C2','D1']);
    await page.getByRole('button',{name:'Move east',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="apartments"]');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),0);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),10);
    await page.keyboard.press('ArrowLeft');await page.waitForSelector('#local-map[data-map-id="b1"]');
    await page.reload();await page.waitForSelector('#local-map[data-map-id="b1"]');
});

test('storage district has ten reachable shutters, three rentals, a fenced compound and sealed facilities',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{
        const map=SugarCube.setup.worldMaps.b1,seen=new Set(),queue=[map.spawn];
        for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        const reachable=object=>[[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dy])=>seen.has(`${object.x+dx},${object.y+dy}`));
        return {units:map.storageUnits.length,available:map.storageUnits.filter(u=>u.available).map(u=>u.number),reachable:map.interactables.every(reachable),fence:[[7,23],[50,35],[28,23]].every(([x,y])=>!map.tileAt(x,y).walkable),front:map.tileAt(28,42).walkable,warehouse:map.interactables.filter(o=>o.id.startsWith('warehouse-')).length};
    });
    assert.deepEqual(result,{units:10,available:[2,6,9],reachable:true,fence:true,front:true,warehouse:2});
    for(const [id,x,y] of [['storage-unit-1',11,31],['storage-unit-2',19,31],['warehouse-1',15,57],['mechanic-shop',57,58]]) {
        await placeInWorld('b1',x,y);
        const actions=await page.evaluate(id=>{const {setup}=SugarCube;return setup.interactions.actionsFor(setup.worldMaps.b1.interactables.find(o=>o.id===id)).map(a=>a.id);},id);
        assert.equal(actions.includes('lockpick'),false);assert.equal(actions.includes('enter'),false);
        assert.equal(await page.evaluate(id=>SugarCube.setup.interactions.run(id,'lockpick').ok,id),false);
    }
});

test('automated kiosk rents only the three available units at $200 weekly and rejects repeat or remote purchases',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.selfStorage.buy('2').ok),false);
    await placeInWorld('b1',57,37);await page.keyboard.press('e');
    await page.getByRole('button',{name:'Rent unit 2 · $200 / week',exact:true}).waitFor({state:'visible'});
    assert.equal(await page.getByRole('button',{name:/^Rent unit .*200/}).count(),3);
    await page.getByRole('button',{name:'Rent unit 2 · $200 / week',exact:true}).click();
    assert.match(await page.locator('#interaction-result').textContent(),/first week is paid/);
    assert.equal(await page.locator('#player-money').textContent(),'$99,799');
    assert.equal(await page.getByRole('button',{name:'Rent unit 2 · $200 / week',exact:true}).isDisabled(),true);
    const outcome=await page.evaluate(()=>{const {setup,State}=SugarCube;return {repeat:setup.selfStorage.buy('2').ok,occupied:setup.selfStorage.buy('1').ok,money:State.variables.player.money,time:State.variables.world.elapsedSeconds};});
    assert.deepEqual(outcome,{repeat:false,occupied:false,money:99799,time:0});
    await page.keyboard.press('Escape');await page.evaluate(()=>SugarCube.setup.playerState.changeMoney(-99799));
    assert.equal(await page.evaluate(()=>SugarCube.setup.selfStorage.buy('6').ok),false);
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.selfStorage.ensure().owned),['2']);
});

test('storage weekly billing keeps arrears and lease dates through reload without duplicate charges',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('b1',57,37);
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;setup.selfStorage.buy('2');const due=setup.selfStorage.ensure().leases['2'].nextRentAt;
        State.variables.world.elapsedSeconds+=setup.selfStorage.weekSeconds-1;setup.housing.collectDue();const before=State.variables.player.money;
        State.variables.world.elapsedSeconds++;setup.housing.collectDue();const after=State.variables.player.money;
        State.variables.player.money=0;State.variables.world.elapsedSeconds+=setup.selfStorage.weekSeconds*2;setup.housing.collectDue();
        const lease=structuredClone(setup.selfStorage.ensure().leases['2']);State.create(State.passage);return {before,after,due,lease};});
    assert.equal(result.before,99799);assert.equal(result.after,99599);assert.equal(result.lease.arrears,400);assert.equal(result.lease.nextRentAt,result.due+3*604800);
    await page.reload();await page.waitForSelector('#local-map');
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.selfStorage.ensure().leases['2']),result.lease);
    const paid=await page.evaluate(()=>{const {setup,State}=SugarCube;setup.playerState.changeMoney(500);setup.housing.collectDue();setup.housing.collectDue();return {money:State.variables.player.money,arrears:setup.selfStorage.ensure().leases['2'].arrears};});
    assert.deepEqual(paid,{money:100,arrears:0});
});

test('rented storage uses block transfers, remains separate per unit, persists and denies remote access',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('b1',57,37);
    await page.evaluate(()=>{const {setup}=SugarCube;setup.selfStorage.buy('2');setup.selfStorage.buy('6');setup.inventory.ensure().containers['worn:shirt']=[{id:'storage-test-cloth',type:'cloth',x:0,y:0}];});
    await collectStorageKeys();
    await placeInWorld('b1',19,31);await page.keyboard.press('e');await page.getByRole('button',{name:'Open storage',exact:true}).click();
    assert.equal(await page.locator('#ui-dialog-title').textContent(),'Storage unit & inventory');
    const grid=page.locator('[data-storage-id="storage:b1:2"]');assert.equal(await grid.getAttribute('data-columns'),'8');assert.equal(await grid.getAttribute('data-rows'),'6');
    await page.getByRole('button',{name:'Cleaning cloth, 1 by 1 blocks, Shirt pocket',exact:true}).click();
    await page.getByRole('button',{name:'Empty block 1, 1 in Storage unit 2',exact:true}).click();
    assert.equal(await grid.locator('[data-item="storage-test-cloth"]').count(),1);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map');
    await page.keyboard.press('e');await page.getByRole('button',{name:'Open storage',exact:true}).click();assert.equal(await page.locator('[data-storage-id="storage:b1:2"] [data-item]').count(),1);
    await page.getByRole('button',{name:'Cleaning cloth, 1 by 1 blocks, Storage unit 2',exact:true}).click();await page.getByRole('button',{name:'Empty block 1, 1 in Shirt pocket',exact:true}).click();
    await page.keyboard.press('Escape');await placeInWorld('b1',11,34);
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.external('storage:2')),null);
    await page.keyboard.press('e');await page.getByRole('button',{name:'Open storage',exact:true}).click();assert.equal(await page.locator('[data-storage-id="storage:b1:6"] [data-item]').count(),0);
    await page.keyboard.press('Escape');await placeInWorld('apartments',30,33);
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.transfer('worn:shirt','storage:b1:2','storage-test-cloth',0,0,'storage:2').ok),false);
});

test('removing and rewearing clothing preserves all four pants pockets and updates the sprite without time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const before=await image();
    await page.evaluate(()=>{const {setup}=SugarCube;const inv=setup.inventory.ensure();for(let i=1;i<=4;i++)inv.containers[`worn:pants:${i}`]=[{id:`kept-${i}`,type:'cloth',x:0,y:0}];});
    await page.getByRole('button',{name:'Inventory',exact:true}).click();
    await page.getByRole('button',{name:'Equipped Generic pants',exact:true}).click();await page.getByRole('button',{name:'Drop on ground',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Equipped Generic pants',exact:true}).count(),0);
    assert.notEqual(await image(),before);
    const stored=await page.evaluate(()=>{const {setup,State}=SugarCube;const ground=setup.groundItems.current();return {pants:setup.inventory.placements(ground)[0],pockets:setup.inventory.worn().map(c=>c.id),time:State.variables.world.elapsedSeconds};});
    assert.equal(stored.time,0);assert.equal(stored.pockets.some(id=>id.startsWith('worn:pants:')),false);
    assert.deepEqual(Object.values(stored.pants.pockets).flat().map(item=>item.id),['kept-1','kept-2','kept-3','kept-4']);
    assert.equal(await page.getByRole('button',{name:'Generic pants, 2 by 2 blocks, Ground at your feet',exact:true}).locator('.inventory-item-slot').textContent(),'Bottom');
    await page.getByRole('button',{name:'Generic pants, 2 by 2 blocks, Ground at your feet',exact:true}).click();
    await page.getByRole('button',{name:'Wear generic pants',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Equipped Generic pants',exact:true}).count(),1);assert.equal(await image(),before);
    assert.deepEqual(await page.evaluate(()=>[1,2,3,4].map(i=>SugarCube.setup.inventory.placements({id:`worn:pants:${i}`})[0].id)),['kept-1','kept-2','kept-3','kept-4']);
    assert.equal(await page.locator('#local-map').getAttribute('data-ground-count'),'0');
});

test('equipped clothing drags to rented storage with contents and invalid or self-pocket drops keep it worn',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('b1',57,37);
    await page.evaluate(()=>{const {setup}=SugarCube;setup.selfStorage.buy('2');setup.inventory.ensure().containers['worn:shirt']=[{id:'kept-key',type:'apartmentKey',x:0,y:0}];});
    await collectStorageKeys();
    await placeInWorld('b1',19,31);await page.keyboard.press('e');await page.getByRole('button',{name:'Open storage',exact:true}).click();
    const rejected=await page.evaluate(()=>{const {setup}=SugarCube;return {self:setup.equipment.remove('top','worn:shirt',0,0,'storage:2').ok,overflow:setup.equipment.remove('top','storage:b1:2',7,5,'storage:2').ok};});
    assert.deepEqual(rejected,{self:false,overflow:false});
    const item=page.getByRole('button',{name:'Equipped Generic shirt',exact:true}),box=await item.boundingBox();
    const target=await page.getByRole('button',{name:'Empty block 1, 1 in Storage unit 2',exact:true}).boundingBox();
    await page.mouse.move(box.x+8,box.y+8);await page.mouse.down();await page.mouse.move(target.x+8,target.y+8,{steps:10});
    assert.equal(await page.locator('.inventory-drag-ghost').count(),1);await page.mouse.up();
    assert.equal(await page.locator('[data-storage-id="storage:b1:2"] [data-item]').count(),1);
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.top),'none');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.inventory.containers['storage:b1:2'][0].pockets['worn:shirt'][0].id),'kept-key');
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map');await page.keyboard.press('e');await page.getByRole('button',{name:'Open storage',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Generic shirt, 2 by 2 blocks, Storage unit 2',exact:true}).locator('.inventory-item-slot').textContent(),'Top');
    await page.getByRole('button',{name:'Generic shirt, 2 by 2 blocks, Storage unit 2',exact:true}).click();await page.getByRole('button',{name:'Wear generic shirt',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.inventory.containers['worn:shirt'][0].id),'kept-key');
});

test('dropped clothing has a visible ground marker, an E interaction, durable contents and range restrictions',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube;const ground=setup.groundItems.current();return {id:ground.id,...setup.equipment.drop('equipped:shoes','equipped:shoes')};});
    assert.equal(result.ok,true);assert.equal(await page.locator('#local-map').getAttribute('data-ground-count'),'1');
    await page.keyboard.press('e');await page.getByRole('button',{name:'View items',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Generic shoes, 2 by 1 blocks, Items on the ground',exact:true}).locator('.inventory-item-slot').textContent(),'Shoes');
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.shoes),'none');
    assert.equal(await page.locator('#local-map').getAttribute('data-ground-count'),'1');
    await placeInWorld('apartments',44,60);
    assert.equal(await page.evaluate(id=>SugarCube.setup.inventory.external(id),result.id),null);
    const remote=await page.evaluate(id=>{const {setup}=SugarCube;return setup.equipment.equip(id,setup.inventory.placements({id})[0].id,id).ok;},result.id);assert.equal(remote,false);
    await placeInWorld('apartments',30,33);await page.keyboard.press('e');await page.getByRole('button',{name:'View items',exact:true}).click();
    await page.getByRole('button',{name:'Generic shoes, 2 by 1 blocks, Items on the ground',exact:true}).click();await page.getByRole('button',{name:'Wear generic shoes',exact:true}).click();
    assert.equal(await page.locator('#local-map').getAttribute('data-ground-count'),'0');
});

test('backpack contents remain attached when removed, and garments can be nested in another bag without duplication',async()=>{
    await page.getByLabel('Wearable Storage',{exact:true}).selectOption('backpack');await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;const inv=setup.inventory;inv.ensure().containers['worn:backpack']=[{id:'keep-tools',type:'tools',x:0,y:0}];
        const moved=setup.equipment.remove('top','worn:backpack',2,0).ok;
        const dropped=setup.equipment.drop('equipped:storage','equipped:storage').ok;
        const floor=setup.groundItems.current(),bag=inv.placements(floor)[0];
        const accessible=inv.worn().map(c=>c.id),nested=structuredClone(bag.pockets['worn:backpack']);
        const worn=setup.equipment.equip(floor.id,bag.id).ok;State.create(State.passage);
        return {moved,dropped,accessible,nested,worn,items:inv.placements({id:'worn:backpack'}).map(item=>item.id),time:State.variables.world.elapsedSeconds};});
    assert.equal(result.moved,true);assert.equal(result.dropped,true);assert.equal(result.accessible.includes('worn:backpack'),false);assert.equal(result.worn,true);assert.equal(result.nested.length,2);assert.equal(result.items.length,2);assert.equal(result.time,0);
});

test('dragging equipment to the ground drop zone and back onto its matching slot keeps the same garment',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const shoes=await page.getByRole('button',{name:'Equipped Generic shoes',exact:true}).boundingBox(),ground=await page.getByRole('button',{name:'Drop on ground',exact:true}).boundingBox();
    await page.mouse.move(shoes.x+8,shoes.y+8);await page.mouse.down();await page.mouse.move(ground.x+8,ground.y+8,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.shoes),'none');
    const identity=await page.evaluate(()=>SugarCube.setup.inventory.placements(SugarCube.setup.groundItems.current())[0].id);
    const item=page.getByRole('button',{name:'Generic shoes, 2 by 1 blocks, Ground at your feet',exact:true});await item.scrollIntoViewIfNeeded();
    const start=await item.boundingBox();await page.mouse.move(start.x+5,start.y+5);await page.mouse.down();
    const slot=await page.locator('[data-equip-slot="shoes"]').boundingBox();await page.mouse.move(slot.x+12,slot.y+12,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.shoes),'shoes');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.wornGarmentIds.shoes),identity);
    assert.equal(await page.locator('#local-map').getAttribute('data-ground-count'),'0');
});

async function collectStorageKeys() {
    await page.evaluate(()=>{
        const {setup}=SugarCube,inv=setup.inventory,tray=setup.selfStorage.counter();
        if(!tray) throw new Error('Collect keys while at the kiosk');
        for(const item of [...inv.placements(tray)]) {
            let moved=false;
            for(const pocket of inv.worn()) {const fit=inv.firstFit(pocket,item,inv.placements(pocket));if(fit){moved=inv.transfer(tray.id,pocket.id,item.id,fit.x,fit.y,'storage-kiosk').ok;break;}}
            if(!moved) throw new Error('No free pocket for the storage key');
        }
    });
}

test('storage kiosk dispenses a physical key; full pockets retain it on the tray and the matching carried key controls access',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('b1',57,37);
    await page.evaluate(()=>{const {setup}=SugarCube;for(const pocket of setup.inventory.worn())setup.inventory.ensure().containers[pocket.id]=[{id:`full:${pocket.id}`,type:'cloth',x:0,y:0}];});
    await page.keyboard.press('e');await page.getByRole('button',{name:'Rent unit 2 · $200 / week',exact:true}).click();
    await page.getByRole('button',{name:'Collect storage keys',exact:true}).click();
    const key=page.locator('[data-container="storage:key-tray"] [data-item="storage-key:2"]');await key.waitFor({state:'visible'});
    assert.equal(await key.getAttribute('title'),'Key for storage unit 2');
    assert.equal(await key.textContent(),'S2');assert.match(await key.getAttribute('aria-label'),/Storage unit 2 key/);
    assert.equal(await page.evaluate(()=>SugarCube.setup.selfStorage.canEnter('2')),false);
    const failed=await page.evaluate(()=>SugarCube.setup.inventory.transfer('storage:key-tray','worn:pants:1','storage-key:2',0,0,'storage-kiosk').ok);assert.equal(failed,false);
    await page.evaluate(()=>{const {setup}=SugarCube;const floor=setup.groundItems.current();setup.inventory.transfer('worn:pants:1',floor.id,'full:worn:pants:1',0,0,'storage-kiosk');});
    await key.click();await page.locator('[data-storage-id="worn:pants:1"] [data-x="0"][data-y="0"]').click();
    assert.equal(await key.count(),0);assert.equal(await page.evaluate(()=>SugarCube.setup.selfStorage.canEnter('2')),true);
    await page.evaluate(()=>SugarCube.setup.selfStorage.buy('6'));
    assert.equal(await page.evaluate(()=>SugarCube.setup.selfStorage.canEnter('6')),false,'another unit cannot use this key');
    await page.keyboard.press('Escape');await placeInWorld('b1',19,31);
    assert.equal(await page.evaluate(()=>!!SugarCube.setup.inventory.external('storage:2')),true);
    await page.evaluate(()=>SugarCube.setup.equipment.drop('worn:pants:1','storage-key:2'));
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.external('storage:2')),null);
    assert.equal(await page.evaluate(()=>SugarCube.setup.interactions.run('storage-unit-2','storage').ok),false);
    await page.reload();await page.waitForSelector('#local-map');
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.placements({id:'storage:key-tray'}).filter(item=>item.id==='storage-key:2').length),0,'lost keys do not respawn');
});

test('existing storage leases get one kiosk key without resetting balances, dates or nested keys',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;const due=setup.gameClock.now()+12345;
        State.variables.selfStorage={version:1,owned:['2'],leases:{'2':{nextRentAt:due,arrears:400}}};
        const before=setup.playerState.ensure().money;const lease=structuredClone(setup.selfStorage.ensure().leases['2']);setup.selfStorage.ensure();
        const tray=setup.inventory.placements({id:'storage:key-tray'}),count=tray.length;
        const key=tray[0];State.variables.inventory.containers['storage:key-tray']=[];
        State.variables.inventory.containers['ground:apartments:30:33']=[{id:'legacy-shirt',type:'shirt',x:0,y:0,pockets:{'worn:shirt':[key]}}];
        State.variables.selfStorage.leases['2'].keyIssued=false;setup.selfStorage.ensure();
        return {due,before,after:State.variables.player.money,lease,count,respawn:setup.inventory.placements({id:'storage:key-tray'}).length};});
    assert.equal(result.lease.nextRentAt,result.due);assert.equal(result.lease.arrears,400);assert.equal(result.lease.keyIssued,true);assert.equal(result.before,result.after);assert.equal(result.count,1);assert.equal(result.respawn,0);
});

test('expanded B1 keeps road crossings aligned with C1 and cannot exit its southern extension into C1',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube,b1=setup.worldMaps.b1,c1=setup.worldMaps.apartments;
        return {height:b1.height,south:b1.buildings.slice(0,3).every(b=>b.y>b1.roads.horizontal.y+b1.roads.horizontal.height),
            crossings:[44,45,46,47,48].map(y=>({out:setup.worldTravel.edge({mapId:'apartments',x:0,y:y+20},-1,0),back:setup.worldTravel.edge({mapId:'b1',x:69,y},1,0),road:[b1.tileAt(69,y).kind,c1.tileAt(0,y+20).kind]})),
            blocked:setup.worldTravel.edge({mapId:'b1',x:69,y:65},1,0)};});
    assert.equal(result.height,90);assert.equal(result.south,true);assert.equal(result.blocked,null);
    for(const [i,crossing] of result.crossings.entries()){assert.deepEqual(crossing.out,{mapId:'b1',x:69,y:44+i});assert.deepEqual(crossing.back,{mapId:'apartments',x:0,y:64+i});assert.deepEqual(crossing.road,['road','road']);}
    await placeInWorld('b1',69,65);await page.getByRole('button',{name:'Move east',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.mapId),'b1');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
});

test('A1 connects west of B1 on the same road and discovers only adjacent districts',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('b1',0,46);
    await page.getByRole('button',{name:'Move west',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="a1"]');
    assert.equal(await page.locator('#location-title').textContent(),'Low Density Housing');assert.match(await page.locator('#local-map-title').textContent(),/100 × 90/);
    assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{x:99,y:46,time:5});
    assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'a1');
    assert.deepEqual(await page.evaluate(()=>SugarCube.setup.worldAtlas.visible().map(l=>l.coordinate).sort()),['A1','A2','B1','B2','C1','C2','D1']);
    await page.getByRole('button',{name:'Move east',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="b1"]');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),0);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),10);
});

test('A1 has five modest houses north and four south, reachable entries and parallel curb parking',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube,map=setup.worldMaps.a1,seen=new Set(),queue=[map.spawn];
        for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        return {north:map.buildings.filter(b=>b.facing==='south').length,south:map.buildings.filter(b=>b.facing==='north').length,
            entries:map.buildings.every(b=>seen.has(`${b.door.x},${b.door.y}`)),bays:map.parkingBays.every(b=>b.width>b.height&&b.parallel),
            road:[41,42,43,44,45,46,47,48,49,50,51].map(y=>map.tileAt(50,y).kind),cars:map.cars.every(c=>['east','west'].includes(c.facing)&&!map.tileAt(c.x,c.y).walkable),
            interiors:map.buildings.map(b=>{const house=setup.worldMaps[`a1-house-${b.number}`];return {width:house.width,height:house.height,rooms:house.rooms.map(r=>r.kind).sort(),spawn:house.tileAt(house.spawn.x,house.spawn.y).walkable};})};});
    assert.equal(result.north,5);assert.equal(result.south,4);assert.equal(result.entries,true);assert.equal(result.bays,true);assert.equal(result.cars,true);
    assert.deepEqual(result.road,['pavement','parking','parking','road','road','road','road','road','parking','parking','pavement']);
    assert.equal(result.interiors.length,9);for(const house of result.interiors){assert.deepEqual(house.rooms,['bathroom','bedroom','living','side']);assert.equal(house.width,18);assert.equal(house.height,18);assert.equal(house.spawn,true);}
});

test('all nine four-room house plans are connected, furnished, rotated toward the road and separate from apartment rentals',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube;return {rentalCount:setup.housing.units().length,houses:setup.worldMaps.a1.buildings.map(building=>{
        const map=setup.worldMaps[`a1-house-${building.number}`],seen=new Set(),queue=[map.spawn];
        for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        const exit=map.interactables.find(o=>o.exit),bed=map.furniture.find(f=>f.style==='bed');
        return {number:building.number,facing:building.facing,exitY:exit.y,destination:exit.destination,
            reached:map.rooms.every(room=>[...seen].some(key=>{const [x,y]=key.split(',').map(Number);return setup.rooms.inside(room.bounds,x,y);})),
            bedRotation:bed.rotation,furniture:map.furniture.map(f=>f.label),worldArea:map.worldArea};})};});
    assert.equal(result.rentalCount,16);
    for(const house of result.houses){assert.equal(house.reached,true);assert.equal(house.worldArea,'a1');assert.equal(house.exitY,house.facing==='south'?17:0);assert.equal(house.bedRotation,house.facing==='south'?0:2);assert.equal(house.destination.mapId,'a1');for(const label of ['Bed','Desk','Dining table','Toilet','Shower','Sofa'])assert.ok(house.furniture.includes(label));}
    for(const number of [1,6]) {
        const before=await page.evaluate(number=>{const b=SugarCube.setup.worldMaps.a1.buildings[number-1];return {x:b.door.x,y:b.door.y+(b.facing==='south'?1:-1)};},number);
        await placeInWorld('a1',before.x,before.y);await page.keyboard.press('e');
        const dialog=page.getByRole('dialog',{name:'Interact',exact:true});await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Enter',exact:true}).click();await page.waitForSelector(`#local-map[data-map-id="a1-house-${number}"]`);
        const room=await page.evaluate(()=>SugarCube.setup.rooms.current().room.kind);assert.equal(room,'living');assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'a1');
        const exit=await page.evaluate(()=>SugarCube.setup.worldMaps[SugarCube.State.variables.world.mapId].interactables.find(o=>o.exit));
        await placeInWorld(`a1-house-${number}`,exit.x,exit.y+(number<=5?-1:1));await page.keyboard.press('e');await dialog.getByRole('button',{name:'Exit',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="a1"]');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),before);
    }
});

test('house doors hide other rooms, reveal a nearby open bedroom, and support beds and room-based descriptions',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();const points=await page.evaluate(()=>{const map=SugarCube.setup.worldMaps['a1-house-1'];return [[3,6],[10,3],[7,3]].map(([x,y])=>map.layout.point({x,y}));});
    await placeInWorld('a1-house-1',points[0].x,points[0].y);
    assert.equal(await page.evaluate(()=>SugarCube.setup.rooms.cellVisible(SugarCube.setup.worldMaps['a1-house-1'],1,1)),false);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});await dialog.getByRole('button',{name:'Open',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.rooms.cellVisible(SugarCube.setup.worldMaps['a1-house-1'],1,1)),true);
    assert.equal(await page.evaluate(()=>SugarCube.setup.rooms.cellVisible(SugarCube.setup.worldMaps['a1-house-1'],10,2)),false);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Move north',exact:true}).click();await page.getByRole('button',{name:'Move north',exact:true}).click();
    assert.match(await page.locator('#location-description').textContent(),/small bedroom/);
    await walkTo(3,2);await page.keyboard.press('e');await dialog.getByRole('button',{name:'Sit',exact:true}).click();assert.match(await page.locator('#room-sounds').textContent(),/bed frame creaks/);
    await page.keyboard.press('Escape');await placeInWorld('a1-house-1',points[1].x,points[1].y);assert.match(await page.locator('#room-sounds').textContent(),/extractor/);
    await placeInWorld('a1-house-1',points[2].x,points[2].y);assert.match(await page.locator('#location-description').textContent(),/spare side room/);
});

test('A1 street terminates in a clear turning bulb, keeps bays outside it and preserves all car identities',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup}=SugarCube,map=setup.worldMaps.a1;
        return {westRoad:Array.from({length:map.height},(_,y)=>map.tileAt(0,y)).some(t=>['road','parking'].includes(t.kind)),
            bulb:[[10,39],[3,46],[10,46],[10,53],[17,46]].every(([x,y])=>map.tileAt(x,y).kind==='road'),
            curb:map.tileAt(2,46).kind,bays:map.parkingBays.every(b=>b.x>=map.culDeSac.parkingStartX),
            cars:map.cars.every(car=>map.parkingBays.some(b=>car.x===b.x+1&&car.y===b.y)),ids:map.interactables.filter(o=>o.kind==='car').map(o=>o.id),
            east:[44,45,46,47,48].every(y=>map.tileAt(99,y).kind==='road'),exit:map.exits.west};});
    assert.equal(result.westRoad,false);assert.equal(result.bulb,true);assert.equal(result.curb,'pavement');assert.equal(result.bays,true);assert.equal(result.cars,true);assert.equal(result.east,true);assert.equal(result.exit,undefined);
    assert.deepEqual(result.ids,Array.from({length:7},(_,i)=>`a1-car-${i+1}`));
    await placeInWorld('a1',10,46);await walkTo(3,46);await walkTo(20,46);
});

test('cul-de-sac asphalt joins the full road width without curb or grass gaps at its approach',async()=>{
    const result=await page.evaluate(()=>{const map=SugarCube.setup.worldMaps.a1;return Array.from({length:11},(_,i)=>i+10).flatMap(x=>Array.from({length:9},(_,i)=>map.tileAt(x,i+42).kind));});
    assert.ok(result.every(kind=>['road','parking'].includes(kind)));
});

test('D1 connects east of Apartments with five shops, a north parking lot and a reachable southern train',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',89,66);
    await page.getByRole('button',{name:'Move east',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="d1"]');
    assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{x:0,y:46,time:5});
    const result=await page.evaluate(()=>{const map=SugarCube.setup.worldMaps.d1,queue=[map.spawn],seen=new Set();
        for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const [dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        return {shops:map.shops.map(shop=>shop.name),north:map.shops.every(shop=>shop.y+shop.height<44)&&map.parking.y+map.parking.height<44,
            south:map.platform.y>48&&map.train.y>48,reachable:map.shops.every(shop=>seen.has(`${shop.approach.x},${shop.approach.y}`))&&seen.has('45,69'),
            blocked:!map.tileAt(map.train.x,map.train.y).walkable&&!map.tileAt(15,72).walkable,
            crossingClear:map.cars.every(car=>car.x+car.width<=43||car.x>47),tunnels:map.tunnels.length};});
    assert.deepEqual(result.shops,['Discount store','Food stall','Laundry','Barbershop','Electronic repair store']);assert.equal(result.north,true);assert.equal(result.south,true);assert.equal(result.reachable,true);assert.equal(result.blocked,true);assert.equal(result.crossingClear,true);assert.equal(result.tunnels,2);
    await page.getByRole('button',{name:'Move west',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="apartments"]');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),10);
});

test('all D1 enclosed shops can be entered and exited while the food stall uses an outdoor counter',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const shops=await page.evaluate(()=>SugarCube.setup.worldMaps.d1.shops);
    for(const shop of shops) {
        await placeInWorld('d1',shop.approach.x,shop.approach.y);await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
        if(shop.stall){await dialog.getByRole('button',{name:'Inspect',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/Food purchases/);await page.keyboard.press('Escape');continue;}
        await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Enter',exact:true}).click();await page.waitForSelector(`#local-map[data-map-id="${shop.id}"]`);
        assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'d1');assert.match(await page.locator('#room-sounds').textContent(),/Ceiling lights/);
        await placeInWorld(shop.id,shop.exit.x-(shop.facing==='east'?1:0),shop.exit.y-(shop.facing==='south'?1:0));await page.keyboard.press('e');await dialog.getByRole('button',{name:'Exit',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="d1"]');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),shop.approach);
    }
});

test('station train lists B6 H4 and F3 as unavailable future stops with no waits, fares or state changes',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('d1',45,69);
    const before=await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),money:SugarCube.setup.playerState.ensure().money,known:[...SugarCube.State.variables.worldDiscovery.discovered]}));
    assert.match(await page.locator('#room-sounds').textContent(),/train.*ventilation/);
    await page.keyboard.press('e');await page.getByRole('button',{name:'Board train',exact:true}).click();
    for(const label of ['B6 · Transit Area','H4 · Transit Area','F3 · Central Transit Hub'])assert.equal(await page.getByRole('button',{name:label+' · Not open yet',exact:true}).isDisabled(),true);
    assert.deepEqual(await page.evaluate(()=>({world:structuredClone(SugarCube.State.variables.world),money:SugarCube.setup.playerState.ensure().money,known:[...SugarCube.State.variables.worldDiscovery.discovered]})),before);
    assert.deepEqual(await page.evaluate(()=>['b6','h4','f3'].map(id=>SugarCube.setup.transit.available(id))),[false,false,false]);
    assert.equal(await page.evaluate(()=>SugarCube.setup.transit.ride('b6').ok),false);
});

test('train travel supports a registered future station without waits or fares and revalidates reach',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.setup.transit.ride('b6').ok),false);
    await placeInWorld('d1',45,69);
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;const before={time:State.variables.world.elapsedSeconds,money:setup.playerState.ensure().money};
        const source=setup.worldMaps.d1;
        // A test-only station verifies the reusable route; shipped B6 stays unbuilt.
        setup.worldMaps.b6={...source,id:'b6',worldArea:'b6',station:{id:'b6',arrival:{x:45,y:69}},interactables:source.interactables.map(o=>o.kind==='train'?{...o,stationId:'b6'}:o)};
        const outbound=setup.transit.ride('b6');return {outbound,before,after:{time:State.variables.world.elapsedSeconds,money:State.variables.player.money}};});
    assert.equal(result.outbound.ok,true);assert.equal(result.outbound.travelled,true);assert.deepEqual(result.after,result.before);
    await page.waitForSelector('#local-map[data-map-id="b6"]');
    assert.equal(await page.evaluate(()=>SugarCube.setup.transit.ride('d1').ok),true);await page.waitForSelector('#local-map[data-map-id="d1"]');
    await placeInWorld('d1',45,46);assert.equal(await page.evaluate(()=>SugarCube.setup.transit.ride('b6').ok),false);
    assert.equal(await page.evaluate(()=>SugarCube.setup.transit.ride('unknown').ok),false);
});


test('exhaustion persists across reload and forces walking until endurance is strictly below eighty percent',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('apartments',10,66);
    const first=await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.endurance={used:24,sprintSteps:0,recoverySeconds:0};
        const sprint=setup.worldMovement.move(1,0,true),walk=setup.worldMovement.move(-1,0,true);
        return {sprint:sprint.sprinted,walk:walk.sprinted,state:structuredClone(setup.endurance.ensure()),can:setup.endurance.canSprint()};});
    assert.equal(first.sprint,true);assert.equal(first.walk,false);assert.equal(first.state.used,24.5);assert.equal(first.state.exhausted,true);assert.equal(first.can,false);
    await page.reload();await page.waitForSelector('#local-map');
    assert.equal(await page.evaluate(()=>SugarCube.setup.endurance.canSprint()),false);
    const steps=await page.evaluate(()=>{const {setup,State}=SugarCube;return Array.from({length:6},(_,i)=>{const before=State.variables.world.elapsedSeconds,result=setup.worldMovement.move(i%2?-1:1,0,true);return {sprinted:result.sprinted,used:setup.endurance.ensure().used,seconds:State.variables.world.elapsedSeconds-before,can:setup.endurance.canSprint()};});});
    for(let i=0;i<steps.length;i++)assert.ok(Math.abs(steps[i].used-25*Math.pow(.98,i+2))<1e-10);
    assert.deepEqual(steps.map(step=>step.sprinted),[false,false,false,false,false,false]);
    assert.deepEqual(steps.map(step=>step.seconds),[5,5,5,5,5,5]);
    assert.equal(steps[2].can,false);assert.equal(steps[3].can,false);
});

test('exhaustion threshold scales with skill capacity and legacy maximum saves enter recovery',async()=>{
    const checks=await page.evaluate(()=>{const {setup,State}=SugarCube;return [0,50,350].map(xp=>{
        State.variables.character.skills.Endurance=xp;const max=setup.endurance.capacity();State.variables.endurance={version:1,used:max,sprintSteps:0,recoverySeconds:0};
        const initial=setup.endurance.canSprint();setup.endurance.recover(55);const boundary={used:setup.endurance.ensure().used,can:setup.endurance.canSprint()};
        setup.endurance.recover(4);const partial=setup.endurance.canSprint();setup.endurance.recover(1);return {max,initial,boundary,partial,ready:setup.endurance.canSprint()};});});
    assert.deepEqual(checks.map(check=>check.max),[25,30,55]);
    for(const check of checks){assert.equal(check.initial,false);assert.ok(Math.abs(check.boundary.used-check.max*Math.pow(.98,11))<1e-10);assert.equal(check.boundary.can,false);assert.equal(check.partial,false);assert.equal(check.ready,true);}
});

test('housing and storage sidewalks align at the boundary and remain continuous through the street flare',async()=>{
    const result=await page.evaluate(()=>{const {setup}=SugarCube,a1=setup.worldMaps.a1,b1=setup.worldMaps.b1;
        return {edges:[41,51].map(y=>[a1.tileAt(99,y).kind,b1.tileAt(0,y).kind,setup.worldTravel.edge({mapId:'a1',x:99,y},1,0)]),
            paths:[[41,42,43],[51,50,49]].map(rows=>{const points=[...Array.from({length:4},(_,x)=>[x,rows[0]]),[3,rows[1]],[4,rows[1]],[5,rows[1]],[6,rows[1]],[6,rows[2]],[7,rows[2]]];return points.every(([x,y])=>b1.tileAt(x,y).kind==='pavement');}),
            road:[42,43,44,45,46,47,48,49,50].every(y=>b1.tileAt(0,y).kind==='road')};});
    for(const [i,edge] of result.edges.entries())assert.deepEqual(edge,['pavement','pavement',{mapId:'b1',x:0,y:i?51:41}]);
    assert.deepEqual(result.paths,[true,true]);assert.equal(result.road,true);
});

test('D1 compact parking has a clear road driveway and continuous outer sidewalks to the shops',async()=>{
    const result=await page.evaluate(()=>{const map=SugarCube.setup.worldMaps.d1;
        return {size:map.parking.width*map.parking.height,againstRoad:map.parking.y+map.parking.height===map.roads.horizontal.y-1,driveway:[map.tileAt(45,43).kind,map.tileAt(45,44).kind],
            aisles:[42,48].every(x=>map.tileAt(x,38).kind==='parking'),
            paths:[15,74].every(x=>Array.from({length:11},(_,i)=>map.tileAt(x,33+i)).every(tile=>tile.walkable&&tile.kind==='pavement')&&map.tileAt(x,31).kind==='path'),
            cars:map.interactables.filter(o=>o.kind==='car').map(o=>o.id),
            anchor:map.shops[0].facing==='east'&&map.shops[0].door.x===map.shops[0].x+map.shops[0].width-1&&map.shops[0].approach.x===map.parking.x-2,
            connected:map.shops.slice(1).every((shop,i)=>shop.x===map.shops[i].x+map.shops[i].width&&shop.y===map.shops[i].y),
            twoWide:[31,32].every(y=>map.tileAt(20,y).kind==='path')&&map.tileAt(20,30).kind==='building'&&map.tileAt(20,33).kind==='parking'};});
    assert.equal(result.anchor,true);assert.equal(result.connected,true);assert.equal(result.twoWide,true);
    assert.equal(result.againstRoad,true);assert.ok(result.size<80*14*.6);assert.ok(result.driveway.every(kind=>kind==='road'));assert.equal(result.aisles,true);assert.equal(result.paths,true);
    assert.deepEqual(result.cars,Array.from({length:8},(_,i)=>`d1-car-${i+1}`));
});

test('E1 extends the D1 road with two reachable north alleys, connected venue strips and a back alley',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('d1',89,46);
    await page.getByRole('button',{name:'Move east',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1"]');
    assert.deepEqual(await page.evaluate(()=>({map:SugarCube.State.variables.world.mapId,x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{map:'e1',x:0,y:62,time:5});
    const geometry=await page.evaluate(()=>{const {setup}=SugarCube,map=setup.worldMaps.e1,queue=[map.spawn],seen=new Set();
        for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const [dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        return {names:map.venues.map(v=>v.name).sort(),reachable:map.venues.every(v=>seen.has(`${v.approach.x},${v.approach.y}`)),
            alley:map.alleys.length===2&&map.alleys.every(a=>Array.from({length:a.height},(_,i)=>map.tileAt(a.x,a.y+i)).every(t=>t.walkable&&t.kind==='alley')&&seen.has(`${a.x},${a.y}`)),
            back:map.tileAt(48,3).label==='Back alley'&&seen.has('48,3'),attached:map.venues.every(v=>map.venues.some(other=>other!==v&&v.x===other.x&&(v.y+v.height===other.y||other.y+other.height===v.y))),
            road:[60,61,62,63,64].every(y=>map.tileAt(0,y).kind==='road'&&setup.worldMaps.d1.tileAt(89,y-16).kind==='road'),
            futureBlocked:setup.worldTravel.edge({mapId:'e1',x:99,y:62},1,0)?.mapId==='f1',
            known:setup.worldAtlas.visible().map(location=>location.coordinate)};});
    assert.deepEqual(geometry.names,['Bar','Casino','Clothing store','Hotel','Nightclub','Small club','Tattoo parlor']);
    for(const key of ['reachable','alley','back','attached','road','futureBlocked'])assert.equal(geometry[key],true,key);
    assert.ok(geometry.known.includes('F1'));assert.ok(geometry.known.includes('E2'));assert.ok(!geometry.known.includes('F2'));
    await page.getByRole('button',{name:'Move west',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="d1"]');
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),89);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),10);
});

test('all seven E1 venues enter and exit from their facing doors without time costs or invented services',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const venues=await page.evaluate(()=>SugarCube.setup.worldMaps.e1.venues);
    for(const venue of venues) {
        await placeInWorld('e1',venue.approach.x,venue.approach.y);await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
        await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Enter',exact:true}).click();await page.waitForSelector(`#local-map[data-map-id="${venue.id}"]`);
        assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'e1');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),venue.spawn);
        const valid=await page.evaluate(id=>{const map=SugarCube.setup.worldMaps[id],queue=[map.spawn],seen=new Set();for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
            return map.interactables.every(o=>[[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dy])=>seen.has(`${o.x+dx},${o.y+dy}`)));},venue.id);
        assert.equal(valid,true,venue.name+' fixtures and portals are reachable');
        const dx=venue.facing==='east'?-1:venue.facing==='west'?1:0,dy=venue.facing==='south'?-1:0;
        await placeInWorld(venue.id,venue.exit.x+dx,venue.exit.y+dy);await page.keyboard.press('e');await dialog.locator('.interaction-actions').getByRole('button',{name:'Close',exact:true}).click();
        await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Exit',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1"]');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),venue.approach);
    }
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
    assert.equal(await page.evaluate(()=>SugarCube.setup.playerState.ensure().money),99999);
});

test('small club stairs lead to a persistent underground E1 interior and return without charging time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();const stair=await page.evaluate(()=>SugarCube.setup.worldMaps['e1-small-club'].interactables.find(o=>o.id==='e1-stairs-down'));
    await placeInWorld('e1-small-club',stair.x,stair.y-1);
    const returnPoint=await page.evaluate(()=>SugarCube.setup.worldMaps['e1-underground-club'].interactables.find(o=>o.id==='e1-stairs-up').destination);
    assert.equal(await page.evaluate(()=>SugarCube.setup.interactions.run('e1-stairs-down','travel').travelled),true);
    await page.waitForSelector('#local-map[data-map-id="e1-underground-club"]');assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'e1');
    assert.match(await page.locator('#location-description').textContent(),/Stairs lead back up/);
    await page.reload();await page.waitForSelector('#local-map[data-map-id="e1-underground-club"]');
    await page.keyboard.press('e');await page.getByRole('button',{name:'Go upstairs',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1-small-club"]');
    assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{x:returnPoint.x,y:returnPoint.y,time:0});
    await page.keyboard.press('e');await page.getByRole('button',{name:'Go downstairs',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1-underground-club"]');
    await placeInWorld('e1',48,58);assert.equal(await page.evaluate(()=>SugarCube.setup.interactions.run('e1-stairs-down','travel').ok),false);
});

test('E1 map art and sounds match quiet venue geometry without suggesting nonexistent crowds',async()=>{
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;return [setup.worldMaps.e1,...Object.values(setup.worldMaps).filter(map=>map.worldArea==='e1'&&map.interior)].map(map=>{
        State.variables.world={...State.variables.world,mapId:map.id,...map.spawn};const image=setup.worldMapArt.paint(map);
        return {name:map.name,sound:setup.rooms.sounds(),width:image.width,height:image.height,expectedWidth:map.width*16,expectedHeight:map.height*16};});});
    assert.equal(result.length,9);
    for(const map of result){assert.equal(map.width,map.expectedWidth);assert.equal(map.height,map.expectedHeight);assert.doesNotMatch(map.sound,/traffic|footstep|voice|crowd|laughter|music/i);}
});

test('P opens developer tools over the world, stops held movement and saves maximum playable stats',async()=>{
    await page.keyboard.press('p');assert.equal(await page.getByRole('dialog').count(),0,'tools stay out of the creator');
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    await page.evaluate(()=>{const {setup,State}=SugarCube;setup.playerState.ensure().health=12;State.variables.rest={version:2,tiredness:75,fatigue:80};State.variables.endurance={version:2,used:20,exhausted:true};});
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    await page.keyboard.down('d');await page.keyboard.press('p');
    const dialog=page.getByRole('dialog',{name:'Developer tools',exact:true});await dialog.waitFor({state:'visible'});
    const before=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    const allocation=await page.evaluate(()=>structuredClone(SugarCube.State.variables.character.skills));
    await page.clock.runFor(600);assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),before);await page.keyboard.up('d');
    await dialog.getByRole('button',{name:'Max out all stats',exact:true}).click();
    const stats=()=>page.evaluate(()=>{const {State,setup}=SugarCube;return {levels:setup.characterRules.skills.map(name=>setup.skills.progress(name).level),health:setup.playerState.ensure().health,money:setup.playerState.ensure().money,tiredness:setup.rest.ensure().tiredness,fatigue:setup.rest.fatigue(),endurance:setup.endurance.ensure().used,capacity:setup.endurance.capacity(),time:State.variables.world.elapsedSeconds,allocation:State.variables.character.skills};});
    const expected=await stats();assert.deepEqual(expected.levels,Array(18).fill(10));assert.equal(expected.health,100);assert.equal(expected.money,999999999);assert.equal(expected.tiredness,0);assert.equal(expected.fatigue,0);assert.equal(expected.endurance,0);assert.equal(expected.capacity,300);assert.equal(expected.time,before.elapsedSeconds);assert.deepEqual(expected.allocation,allocation);
    assert.ok(await page.locator('.world-content').isVisible());await page.keyboard.press('Escape');await page.clock.resume();await page.reload();await page.waitForSelector('#local-map[data-player-x]');assert.deepEqual(await stats(),expected);
});

test('all accessible building interiors follow their exterior proportions at 1.5 scale with normal-sized furniture',async()=>{
    const result=await page.evaluate(()=>{const maps=SugarCube.setup.worldMaps;return Object.values(maps).filter(map=>map.interior).map(map=>{
        const queue=[map.spawn],seen=new Set();for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]])queue.push({x:p.x+dx,y:p.y+dy});}
        return {id:map.id,size:[map.width,map.height],outside:map.exteriorSize,fixtures:map.interactables.map(o=>({id:o.id,reached:Array.from({length:(o.width||1)*(o.height||1)},(_,i)=>({x:o.x+i%(o.width||1),y:o.y+Math.floor(i/(o.width||1))})).some(p=>[[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dy])=>seen.has(`${p.x+dx},${p.y+dy}`)))})),beds:map.furniture.filter(f=>f.style==='bed').map(f=>f.width*f.height),units:map.units?.length};});});
    assert.ok(result.length>=25);
    for(const map of result){assert.ok(map.outside,map.id+' has an exterior footprint');assert.deepEqual(map.size,[Math.ceil(map.outside.width*1.5),Math.ceil(map.outside.height*1.5)],map.id);for(const object of map.fixtures)assert.equal(object.reached,true,map.id+' '+object.id+' reachable');for(const area of map.beds)assert.equal(area,6,map.id+' bed stays normal-sized');if(map.id.startsWith('apartment-'))assert.equal(map.units,4);}
});

test('both nightclub alley doors enter a 42 by 21 interior and exit into their matching alley',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const side of ['west','east']) {
        const outside=side==='west'?{x:33,y:51}:{x:62,y:51};
        await placeInWorld('e1',outside.x,outside.y);await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
        await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Enter',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1-nightclub"]');
        const state=await page.evaluate(side=>{const map=SugarCube.setup.worldMaps['e1-nightclub'];return {size:[map.width,map.height],exit:map.interactables.find(o=>o.name===`Exit to ${side} alley`),world:SugarCube.State.variables.world};},side);
        assert.deepEqual(state.size,[42,21]);assert.ok(Math.abs(state.exit.x-state.world.x)+Math.abs(state.exit.y-state.world.y)>=1);
        await walkTo(state.exit.x+(side==='west'?1:-1),state.exit.y);await page.keyboard.press('e');await dialog.locator('.interaction-actions').getByRole('button',{name:'Close',exact:true}).click();await dialog.getByRole('button',{name:'Open',exact:true}).click();await dialog.getByRole('button',{name:'Exit',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="e1"]');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),outside);
    }
    assert.equal(await page.evaluate(()=>SugarCube.setup.worldMaps.e1.interactables.filter(o=>o.destination?.mapId==='e1-nightclub').length),3);
});

test('old layout saves migrate player and ground containers once without losing persistent property',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {State,setup}=SugarCube;const inventory=setup.inventory.ensure();inventory.containers['ground:apartments:12:30']=[{id:'migration-item',type:'cloth',x:0,y:0}];State.variables.world={version:2,mapId:'apartments',x:13,y:29,elapsedSeconds:12345};delete State.variables.worldLayoutVersion;State.variables.openedObjects={'lock:building-1':true};
        const first=structuredClone(setup.worldMovement.ensure()),second=structuredClone(setup.worldMovement.ensure());return {first,second,items:setup.inventory.ensure().containers['ground:apartments:78:50'],locks:State.variables.openedObjects,money:setup.playerState.ensure().money};});
    assert.deepEqual(result.first,{version:6,mapId:'apartments',x:79,y:49,elapsedSeconds:12345});assert.deepEqual(result.second,result.first);assert.deepEqual(result.items,[{id:'migration-item',type:'cloth',x:0,y:0}]);assert.deepEqual(result.locks,{'lock:building-1':true});assert.equal(result.money,99999);
});

test('the close sidebar atlas draws only real exits and discovery never opens A2 or B2',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const [id,x,y,blocked]of[['b1',20,20,'b2'],['a1',20,20,'a2']]) {
        await placeInWorld(id,x,y);await stableAtlas();
        const result=await page.evaluate(blocked=>{const {setup}=SugarCube;return {known:setup.worldAtlas.visible().map(l=>l.id),routes:setup.worldAtlas.connections(),north:setup.worldTravel.edge({mapId:setup.worldAtlas.current(),x:20,y:0},0,-1),visible:document.getElementById('world-map').dataset.visibleIds,drawn:document.getElementById('world-map').dataset.connectionIds,zoom:document.getElementById('world-map').dataset.zoom};},blocked);
        assert.ok(result.known.includes(blocked));assert.ok(!result.routes.includes(blocked));assert.ok(!result.drawn.includes(blocked));assert.equal(result.north,null);assert.equal(result.zoom,'neighborhood');assert.ok(result.visible.split(',').length<=9);
    }
});

test('F1 connects east of Nightlife and all six campus buildings have reachable working entrances',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('e1',99,62);
    await page.getByRole('button',{name:'Move east',exact:true}).click();await page.waitForSelector('#local-map[data-map-id="f1"]');
    assert.equal(await page.locator('#location-title').textContent(),'Executive Offices');assert.equal(await page.locator('#world-map-location').textContent(),'F1 · Executive Offices');assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'f1');
    assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y,time:SugarCube.State.variables.world.elapsedSeconds})),{x:0,y:62,time:5});
    const buildings=await page.evaluate(()=>SugarCube.setup.worldMaps.f1.buildings);assert.equal(buildings.length,6);assert.deepEqual(buildings.filter(b=>b.floors).map(b=>b.floors),[12,16,12]);
    for(const building of buildings) {
        const id=building.floors?`${building.id}-floor-1`:building.id;
        await placeInWorld('f1',building.approach.x,building.approach.y);await openPortal('Enter',id);
        assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'f1');
        const exit=await page.evaluate(()=>SugarCube.setup.worldMaps[SugarCube.State.variables.world.mapId].interactables.find(o=>o.exit));
        await placeInWorld(id,exit.x,exit.y+(exit.y===0?1:-1));await openPortal('Exit','f1');
        assert.deepEqual(await page.evaluate(()=>({x:SugarCube.State.variables.world.x,y:SugarCube.State.variables.world.y})),building.approach);
    }
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),5);
    await placeInWorld('f1',0,62);await page.keyboard.press('a');await page.waitForSelector('#local-map[data-map-id="e1"]');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),10);
});

test('tower elevators reach real upper floors, retain F1 discovery, save correctly and return to the lobby',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    for(const [tower,top]of[[1,12],[2,16],[3,12]]) {
        const lobby=`f1-tower-${tower}-floor-1`,upper=`f1-tower-${tower}-floor-${top}`;
        await placeInWorld(lobby,3,5);await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});
        assert.ok(await dialog.getByRole('button',{name:'Floor 1 · Lobby',exact:true}).isDisabled());
        await dialog.getByRole('button',{name:`Floor ${top} · Executive suites`,exact:true}).click();await page.waitForSelector(`#local-map[data-map-id="${upper}"]`);
        assert.match(await page.locator('#location-description').textContent(),/Executive suites/);assert.equal(await page.locator('#world-map').getAttribute('data-location-id'),'f1');
        await page.reload();await page.waitForSelector(`#local-map[data-map-id="${upper}"]`);await page.keyboard.press('e');await dialog.getByRole('button',{name:'Floor 1 · Lobby',exact:true}).click();await page.waitForSelector(`#local-map[data-map-id="${lobby}"]`);
    }
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);assert.equal(await page.evaluate(()=>SugarCube.setup.playerState.ensure().money),99999);
});

test('executive parking requires ID clearance, cannot be lockpicked or bypassed, and saves its gate state',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await placeInWorld('f1',85,71);
    await page.keyboard.press('s');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.y),71);assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
    await page.keyboard.press('e');const dialog=page.getByRole('dialog',{name:'Interact',exact:true});assert.equal(await dialog.getByRole('button',{name:/Lockpick/}).count(),0);
    await dialog.getByRole('button',{name:'Scan ID implant',exact:true}).click();assert.match(await dialog.locator('#interaction-result').textContent(),/Access denied/);
    const parkingReach=()=>page.evaluate(()=>{const map=SugarCube.setup.worldMaps.f1,q=[map.spawn],seen=new Set();for(let i=0;i<q.length;i++){const p=q[i],key=p.x+','+p.y;if(seen.has(key)||!map.tileAt(p.x,p.y).walkable)continue;seen.add(key);for(const[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]])q.push({x:p.x+dx,y:p.y+dy});}return seen.has('85,80');});
    assert.equal(await parkingReach(),false);await page.keyboard.press('Escape');await page.keyboard.press('p');
    await page.getByRole('button',{name:'Max out all stats',exact:true}).click();assert.equal(await page.evaluate(()=>SugarCube.setup.corporateAccess.authorized()),false);
    await page.getByRole('button',{name:'Grant corporate parking clearance',exact:true}).click();await page.keyboard.press('Escape');await page.keyboard.press('e');
    const previous=await page.locator('#local-map').elementHandle();await dialog.getByRole('button',{name:'Scan ID implant',exact:true}).click();await page.waitForFunction(previous=>document.getElementById('local-map')!==previous,previous);
    assert.equal(await parkingReach(),true);await page.keyboard.press('s');await page.keyboard.press('s');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.y),73);
    await page.keyboard.press('e');const open=await page.locator('#local-map').elementHandle();await dialog.getByRole('button',{name:'Close gate',exact:true}).click();await page.waitForFunction(old=>document.getElementById('local-map')!==old,open);
    await page.keyboard.press('w');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.y),73);
    await page.reload();await page.waitForSelector('#local-map[data-map-id="f1"]');assert.equal(await page.evaluate(()=>SugarCube.setup.corporateAccess.ensure().gateOpen),false);assert.equal(await page.evaluate(()=>SugarCube.setup.corporateAccess.authorized()),true);
    const remote=await page.evaluate(()=>{SugarCube.State.variables.world.x=10;return SugarCube.setup.interactions.run('f1-parking-gate','scan-id');});assert.equal(remote.ok,false);
});

test('four-unit save migration preserves retired leases, physical keys and colliding ground piles',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube,old=setup.layoutHistory['apartment-1'],room=old.units.find(u=>u.id==='1-5'),other=old.units.find(u=>u.id==='1-3');
        State.variables.world={version:3,mapId:'apartment-1',...room.anchor,elapsedSeconds:98765};delete State.variables.worldLayoutVersion;
        State.variables.housing={version:3,rentedUnit:'1-5',weeklyRent:600,nextRentAt:9999999999,arrears:1200,keyIssued:true};State.variables.doorLocks={'unit-1-5':false};
        const inventory=setup.inventory.ensure();inventory.containers['worn:shirt']=[{id:'apartment-key:1-5',type:'apartmentKey',x:0,y:0}];
        inventory.containers[`ground:apartment-1:${room.anchor.x}:${room.anchor.y}`]=[{id:'pile-a',type:'cloth',x:0,y:0}];inventory.containers[`ground:apartment-1:${other.anchor.x}:${other.anchor.y}`]=[{id:'pile-b',type:'cloth',x:0,y:0}];
        const migrated=structuredClone(setup.worldMovement.ensure()),again=structuredClone(setup.worldMovement.ensure()),housing=setup.housing.ensure();
        const piles=Object.entries(setup.inventory.ensure().containers).filter(([id])=>id.startsWith('ground:')).map(([id,items])=>({id,items}));return {migrated,again,unit:setup.rooms.current().unit?.id,housing,piles,hasKey:setup.housing.canEnter('1-3'),unlocked:State.variables.doorLocks['unit-1-3'],money:setup.playerState.ensure().money,key:setup.inventory.ensure().containers['worn:shirt'][0].id};});
    assert.equal(result.migrated.version,6);assert.equal(result.migrated.elapsedSeconds,98765);assert.deepEqual(result.again,result.migrated);assert.equal(result.unit,'1-3');assert.equal(result.housing.rentedUnit,'1-3');assert.equal(result.housing.nextRentAt,9999999999);assert.equal(result.housing.arrears,1200);assert.equal(result.money,99999);assert.equal(result.key,'apartment-key:1-5');assert.equal(result.hasKey,true);assert.equal(result.unlocked,false);
    assert.equal(result.piles.length,2);assert.equal(new Set(result.piles.map(p=>p.id)).size,2);assert.deepEqual(result.piles.flatMap(p=>p.items.map(i=>i.id)).sort(),['pile-a','pile-b']);
    await page.evaluate(()=>SugarCube.Engine.play('Apartments'));await page.waitForSelector('#local-map[data-map-id="apartment-1"]');await page.getByRole('button',{name:'Inventory',exact:true}).click();assert.equal(await page.locator('button[title="Key for Apartment 1 · Unit 3"]').count(),1);
});

test('endurance recovers two percent of current usage each five seconds without losing fractional recovery',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.endurance={used:25,exhausted:true};setup.endurance.recover(4);const partial=setup.endurance.ensure().used;setup.endurance.recover(1);const tick=setup.endurance.ensure().used;setup.endurance.recover(50);const boundary={used:setup.endurance.ensure().used,can:setup.endurance.canSprint()};setup.endurance.recover(5);const ready=setup.endurance.canSprint();setup.skills.award('Endurance',setup.characterRules.maxXp);State.variables.endurance={used:250};setup.endurance.recover(5);const large=setup.endurance.ensure().used;State.variables.endurance={used:10};setup.endurance.recover(10);const batch=setup.endurance.ensure().used;State.variables.endurance={used:10};setup.endurance.recover(5);const smallTick=setup.endurance.ensure().used;setup.endurance.recover(5);const split=setup.endurance.ensure().used;setup.endurance.recover(3600);return {partial,tick,boundary,ready,max:setup.endurance.capacity(),large,batch,smallTick,split,rested:setup.endurance.ensure().used};});
    assert.equal(result.partial,25);assert.equal(result.tick,24.5);assert.ok(Math.abs(result.boundary.used-25*Math.pow(.98,11))<1e-10);assert.equal(result.boundary.can,false);assert.equal(result.ready,true);assert.equal(result.max,300);assert.equal(result.large,245);assert.equal(result.smallTick,9.8);assert.ok(Math.abs(result.batch-9.604)<1e-10);assert.ok(Math.abs(result.split-result.batch)<1e-10);assert.equal(result.rested,0);
});

test('Transit has a one-row shopping driveway and two station lots with open entrance aisles',async()=>{
    const result=await page.evaluate(()=>{const map=SugarCube.setup.worldMaps.d1;return {driveway:map.driveway,top:map.tileAt(45,33).kind,lots:map.stationParking.map(lot=>({area:lot.width*lot.height,road:map.tileAt(lot.x+10,50).kind,aisle:map.tileAt(lot.x+10,54).kind,bayAcrossEntrance:map.parkingBays.some(bay=>bay.y===lot.y&&bay.x<lot.x+13&&bay.x+bay.width>lot.x+8)}))};});
    assert.deepEqual(result.driveway,{x:43,y:43,width:5,height:1});assert.equal(result.top,'parking');assert.equal(result.lots.length,2);for(const lot of result.lots)assert.deepEqual(lot,{area:160,road:'road',aisle:'parking',bayAcrossEntrance:false});
});

test('casino and hotel doors connect both alleys while casino grows and tattoo parlor shrinks',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const venues=await page.evaluate(()=>SugarCube.setup.worldMaps.e1.venues.map(v=>({id:v.id,area:v.width*v.height})));assert.equal(venues.find(v=>v.id==='e1-casino').area,28*10*2.6);assert.ok(venues.find(v=>v.id==='e1-tattoo').area<24*16/2);
    for(const [id,side]of[['e1-casino','east'],['e1-hotel','west']]) {
        const outside=await page.evaluate(({id,side})=>SugarCube.setup.worldMaps.e1.interactables.find(o=>o.id===`${id}:${side}`),{id,side});
        await placeInWorld('e1',outside.x+(side==='east'?1:-1),outside.y);await openPortal('Enter',id);
        const exit=await page.evaluate(side=>SugarCube.setup.worldMaps[SugarCube.State.variables.world.mapId].interactables.find(o=>o.name===`Exit to ${side} alley`),side);
        await placeInWorld(id,exit.x+(side==='east'?-1:1),exit.y);await openPortal('Exit','e1');assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.x),outside.x+(side==='east'?1:-1));
    }
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
});

test('inventory separates nearby items, live character, carried inventory and body slots',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Inventory',exact:true});
    const labels=await dialog.locator('.equipment-slot>strong').allTextContents();assert.deepEqual(labels,['Hat','Face Wear','Over Top','Top','Under Top','Waist','Wrists','Hands','Bottom','Under Bottom','Ankles','Feet','Shoes','Back','Handheld']);
    const layout=await page.evaluate(()=>{const b=selector=>document.querySelector(selector).getBoundingClientRect();return{left:b('.inventory-storage').x,center:b('.inventory-portrait').x,carried:b('.inventory-carried').x,right:b('.equipment-panel').x,drop:b('.ground-drop').top,portraitBottom:b('.inventory-character-canvas').bottom,portrait:b('.inventory-character-canvas').width,sidebar:b('.sidebar-character #character-canvas').width};});
    assert.ok(layout.left<layout.center&&layout.center<layout.carried&&layout.carried<layout.right);assert.ok(layout.drop>layout.portraitBottom);assert.ok(layout.portrait>layout.sidebar);
    const portrait=()=>dialog.locator('.inventory-character-canvas').evaluate(c=>c.toDataURL());assert.equal(await portrait(),await image());const before=await portrait();
    await dialog.getByRole('button',{name:'Equipped Generic shirt',exact:true}).click();await dialog.getByRole('button',{name:'Drop on ground',exact:true}).click();
    assert.notEqual(await portrait(),before);assert.equal(await portrait(),await image());assert.equal(await dialog.locator('[data-equip-slot="top"] .inventory-item').count(),0);assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.top),'none');
    const noSpace=await page.evaluate(()=>SugarCube.setup.inventory.worn().map(c=>c.id));assert.deepEqual(noSpace,['worn:pants:1','worn:pants:2','worn:pants:3','worn:pants:4']);
});

test('four augmentation slots start with a fixed ID chip and reject player removal without granting item storage',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await page.getByRole('button',{name:'Inventory',exact:true}).click();
    const slots=page.locator('.augmentation-slot');assert.equal(await slots.count(),4);assert.equal(await slots.first().locator('span').textContent(),'Basic ID chip');assert.ok(await slots.first().getByRole('button').isDisabled());assert.deepEqual(await slots.locator('span').allTextContents(),['Basic ID chip','Empty','Empty','Empty']);
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;const before=JSON.stringify(setup.augmentations.ensure()),count=setup.inventory.worn().length;
        const denied=setup.augmentations.remove(0),moved=setup.equipment.drop('equipped:augmentation:0','basic-id-chip');setup.corporateAccess.toggleClearance();
        return{before,after:JSON.stringify(setup.augmentations.ensure()),denied,moved,count,afterCount:setup.inventory.worn().length,authorized:setup.corporateAccess.authorized(),time:State.variables.world.elapsedSeconds};});
    assert.equal(result.before,result.after);assert.equal(result.denied.ok,false);assert.equal(result.moved.ok,false);assert.equal(result.count,5);assert.equal(result.afterCount,5);assert.equal(result.authorized,true);assert.equal(result.time,0);
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map');await page.getByRole('button',{name:'Inventory',exact:true}).click();assert.equal(await slots.first().locator('span').textContent(),'Basic ID chip');
    const storyHook=await page.evaluate(()=>{const {setup}=SugarCube;setup.augmentations.ensure().slots[0]=null;return {present:setup.augmentations.has('basic-id-chip'),authorized:setup.corporateAccess.authorized()};});assert.deepEqual(storyHook,{present:false,authorized:false});
});

test('compact Apartments preserves old parked-car seating and ground items and stops sidewalks at the intersection',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;State.variables.world={version:4,mapId:'apartments',x:13,y:49,elapsedSeconds:321};State.variables.vehicleSeat={version:1,mapId:'apartments',vehicleId:'parked-car-1',x:13,y:49};delete State.variables.worldLayoutVersion;
        setup.inventory.ensure().containers['ground:apartments:12:50']=[{id:'kept-at-car',type:'cloth',x:0,y:0}];const world=structuredClone(setup.worldMovement.ensure()),seated=!!setup.vehicleCabin.current();
        const items=setup.inventory.ensure().containers['ground:apartments:78:50'];const unchanged=structuredClone(setup.worldMovement.ensure());delete State.variables.vehicleSeat;
        State.variables.world={version:4,mapId:'apartments',x:30,y:23,elapsedSeconds:321};const park=structuredClone(setup.worldMovement.ensure()),map=setup.worldMaps.apartments;
        return {world,unchanged,seated,items,park,ends:[3,9].every(x=>[70,71,72,73].every(y=>map.tileAt(x,y).kind==='ground')),distance:map.roads.horizontal.y-(map.buildings[2].y+map.buildings[2].height)};});
    assert.deepEqual(result.world,{version:6,mapId:'apartments',x:79,y:49,elapsedSeconds:321});assert.deepEqual(result.unchanged,result.world);assert.equal(result.seated,true);assert.deepEqual(result.items,[{id:'kept-at-car',type:'cloth',x:0,y:0}]);assert.deepEqual(result.park,{version:6,mapId:'apartments',x:30,y:33,elapsedSeconds:321});assert.equal(result.ends,true);assert.equal(result.distance,8);
});


test('sidebar shortcuts open inventory and character, preserve typing and pause movement; Quests/Jobs overlays the world',async()=>{
    await page.keyboard.press('i');assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const nav=page.getByRole('navigation',{name:'Game pages'});
    assert.deepEqual(await nav.locator('a').allTextContents(),['Inventory [i]','Quests/Jobs [j]','Character [c]','Stats']);
    assert.equal(await nav.getByRole('button',{name:'Inventory',exact:true}).getAttribute('aria-keyshortcuts'),'i');
    assert.equal(await nav.getByRole('button',{name:'Character',exact:true}).getAttribute('aria-keyshortcuts'),'c');
    await page.clock.install();await page.keyboard.down('d');await page.keyboard.press('i');
    const inventory=page.getByRole('dialog',{name:'Inventory',exact:true});await inventory.waitFor({state:'visible'});
    const paused=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));await page.clock.runFor(800);
    assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),paused);await page.keyboard.up('d');
    await page.keyboard.press('c');assert.ok(await inventory.isVisible());await page.keyboard.press('Escape');await page.keyboard.press('C');
    assert.ok(await page.getByRole('dialog',{name:'Character',exact:true}).isVisible());await page.keyboard.press('Escape');
    assert.equal(await nav.getByRole('button',{name:'Quests/Jobs',exact:true}).getAttribute('aria-keyshortcuts'),'j');
    await page.keyboard.press('j');const quests=page.getByRole('dialog',{name:'Quests/Jobs',exact:true});
    assert.match(await quests.textContent(),/No active quests/);assert.match(await quests.textContent(),/No current jobs/);assert.ok(await page.locator('#local-map').isVisible());
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{const input=document.createElement('input');input.id='shortcut-typing-check';document.querySelector('.world-content').append(input);input.focus();});
    await page.keyboard.type('icj');assert.equal(await page.locator('#shortcut-typing-check').inputValue(),'icj');assert.equal(await page.getByRole('dialog').count(),0);
    await page.evaluate(()=>{document.getElementById('shortcut-typing-check').remove();for(const options of [{key:'i',ctrlKey:true},{key:'c',altKey:true},{key:'i',metaKey:true},{key:'i',repeat:true}])document.body.dispatchEvent(new KeyboardEvent('keydown',{...options,bubbles:true}));});
    assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),paused);
});

test('dragging ground clothing onto the character equips an empty slot with its contents and rejects occupied slots and other items',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const groundId=await page.evaluate(()=>{const {setup}=SugarCube;setup.inventory.ensure().containers['worn:shirt']=[{id:'portrait-kept-key',type:'apartmentKey',x:0,y:0}];
        setup.equipment.drop('equipped:top','equipped:top');const ground=setup.groundItems.current();setup.inventory.ensure().containers[ground.id].push({id:'spare-shirt',type:'shirt',x:3,y:0,pockets:{}},{id:'not-clothing',type:'water',x:6,y:0});return ground.id;});
    await page.keyboard.press('i');const dialog=page.getByRole('dialog',{name:'Inventory',exact:true});await dialog.waitFor({state:'visible'});
    async function drag(id,valid){const item=dialog.locator(`[data-storage-id="${groundId}"] [data-item="${id}"]`);await item.scrollIntoViewIfNeeded();const from=await item.boundingBox(),to=await dialog.locator('.inventory-character-canvas').boundingBox();
        await page.mouse.move(from.x+8,from.y+8);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});
        assert.equal(await page.locator('.inventory-drag-ghost').getAttribute('data-valid'),String(valid));await page.mouse.up();}
    const shirtId=await page.evaluate(id=>SugarCube.setup.inventory.placements({id})[0].id,groundId);await drag(shirtId,true);
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.top),'shirt');
    assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.placements({id:'worn:shirt'})[0].id),'portrait-kept-key');
    assert.equal(await dialog.locator(`[data-storage-id="${groundId}"] [data-item="${shirtId}"]`).count(),0);
    const before=await page.evaluate(()=>JSON.stringify({clothing:SugarCube.State.variables.character.clothing,inventory:SugarCube.State.variables.inventory}));
    await drag('spare-shirt',false);assert.match(await dialog.locator('#inventory-status').textContent(),/empty matching clothing slot/);
    await drag('not-clothing',false);assert.equal(await page.evaluate(()=>JSON.stringify({clothing:SugarCube.State.variables.character.clothing,inventory:SugarCube.State.variables.inventory})),before);
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.world.elapsedSeconds),0);
});


test('housing office clears the road and sidewalk and v5 saves follow its relocated entrance only once',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube,map=setup.worldMaps.apartments,office=map.housingOffice;
        State.variables.world={version:5,mapId:'apartments',x:69,y:55,elapsedSeconds:456};State.variables.worldLayoutVersion=4;
        setup.inventory.ensure().containers['ground:apartments:69:55']=[{id:'office-kept',type:'cloth',x:0,y:0}];
        const first=structuredClone(setup.worldMovement.ensure()),second=structuredClone(setup.worldMovement.ensure());
        return {first,second,items:setup.inventory.ensure().containers['ground:apartments:69:53'],old:setup.inventory.ensure().containers['ground:apartments:69:55'],
            gap:map.roads.horizontal.y-(office.y+office.height),curb:Array.from({length:office.width},(_,i)=>map.tileAt(office.x+i,63).kind),
            street:Array.from({length:map.width},(_,x)=>map.tileAt(x,64).kind),apartmentGap:office.y-(map.buildings[1].y+map.buildings[1].height),path:map.tileAt(69,53).kind,door:map.tileAt(69,54).kind};});
    assert.deepEqual(result.first,{version:6,mapId:'apartments',x:69,y:53,elapsedSeconds:456});assert.deepEqual(result.second,result.first);
    assert.deepEqual(result.items,[{id:'office-kept',type:'cloth',x:0,y:0}]);assert.equal(result.old,undefined);assert.equal(result.gap,2);assert.equal(result.apartmentGap,2);
    assert.ok(result.curb.every(kind=>kind==='pavement'));assert.ok(result.street.every(kind=>kind==='road'));assert.equal(result.path,'path');assert.equal(result.door,'entrance');
});


test('i j and c toggle only their matching screens without advancing time or resuming held movement',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await page.clock.install();
    for(const [key,name]of [['i','Inventory'],['j','Quests/Jobs'],['c','Character']]){
        await page.keyboard.down('d');await page.keyboard.press(key);const dialog=page.getByRole('dialog',{name,exact:true});await dialog.waitFor({state:'visible'});
        const paused=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
        await page.keyboard.press(key==='c'?'j':'c');assert.ok(await dialog.isVisible());
        await page.keyboard.press(key);await dialog.waitFor({state:'hidden'});await page.clock.runFor(600);await page.keyboard.up('d');
        assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),paused);
        await page.getByRole('navigation',{name:'Game pages'}).getByRole('button',{name,exact:true}).click();await page.keyboard.press(key);assert.equal(await page.getByRole('dialog').count(),0);
    }
    await page.keyboard.press('t');await page.keyboard.press('i');await page.keyboard.press('j');await page.keyboard.press('c');assert.ok(await page.getByRole('dialog',{name:'Actions',exact:true}).isVisible());
});

test('annual weather stays in seasonal 25-degree bands with five-degree daily limits across leap years and year boundaries',async()=>{
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;const failures=[];let comparisons=0;
        for(const seed of [0,1,123456789,4294967295]){State.variables.weather={version:1,seed};
            for(const year of [2026,2027,2028,2029]){const start=Date.UTC(year,0,1)/1000,values=setup.weather.yearForecast(year);let previous=setup.weather.yearForecast(year-1).at(-1);
                for(let index=0;index<values.length;index++){const value=values[index],band=setup.weather.band(start+index*86400);if(!Number.isFinite(value)||value<band.min-1e-10||value>band.max+1e-10||Math.abs(value-previous)>5+1e-10)failures.push({year,index,value,previous,band});previous=value;comparisons++;}
            }
        }
        State.variables.weather={version:1,seed:9876};const first=[...setup.weather.yearForecast(2026)];for(let y=2030;y<2040;y++)setup.weather.yearForecast(y);const again=setup.weather.yearForecast(2026);
        return {failures,comparisons,leap:setup.weather.yearForecast(2028).length,normal:first.length,stable:first.every((value,index)=>value===again[index]),winter:setup.weather.band(Date.UTC(2026,0,15)/1000),summer:setup.weather.band(Date.UTC(2026,6,16)/1000),seed:State.variables.weather.seed};});
    assert.deepEqual(result.failures,[]);assert.equal(result.comparisons,5844);assert.equal(result.leap,366);assert.equal(result.normal,365);assert.equal(result.stable,true);assert.equal(result.seed,9876);
    assert.deepEqual(result.winter,{min:22.5,max:47.5});assert.ok(Math.abs(result.winter.max-result.winter.min-25)<1e-10);assert.ok(result.summer.min>result.winter.max);
});

test('temperature reaches morning plus ten at 7 PM and interpolates continuously to the next 7 AM',async()=>{
    const result=await page.evaluate(()=>{const weather=SugarCube.setup.weather;SugarCube.State.variables.weather={version:1,seed:12345};return [Date.UTC(2026,2,20),Date.UTC(2026,11,31),Date.UTC(2028,1,29)].map(ms=>{const day=ms/1000,base=weather.morning(day),next=weather.morning(day+86400);return {base,next,morning:weather.temperature(day+25200),afternoon:weather.temperature(day+46800),evening:weather.temperature(day+68400),midnight:weather.temperature(day+86400),nextMorning:weather.temperature(day+111600),beforeMidnight:weather.temperature(day+86400-1),beforeMorning:weather.temperature(day+111600-1),afterEvening:weather.temperature(day+68401)};});});
    for(const day of result){assert.equal(day.morning,day.base);assert.equal(day.afternoon,day.base+5);assert.equal(day.evening,day.base+10);assert.equal(day.nextMorning,day.next);
        assert.ok(Math.abs(day.midnight-(day.base+10+(day.next-day.base-10)*5/12))<1e-10);assert.ok(Math.abs(day.midnight-day.beforeMidnight)<.001);assert.ok(Math.abs(day.nextMorning-day.beforeMorning)<.001);assert.ok(day.afterEvening<day.evening);}
});

test('temperature sensations sit below Sounds, hide exact values, refresh with game time and persist through reloads',async()=>{
    const seeded=await page.evaluate(()=>SugarCube.setup.weather.ensure().seed);await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const initial=await page.evaluate(()=>({seed:SugarCube.setup.weather.ensure().seed,temperature:SugarCube.setup.weather.temperature(),text:document.getElementById('attribute-effects').textContent}));assert.equal(initial.seed,seeded);
    assert.equal(await page.locator('#player-temperature').textContent(),`${initial.temperature.toFixed(1)}°F`);
    assert.ok(await page.locator('#attribute-effects').isVisible());assert.ok(await page.evaluate(()=>!!(document.querySelector('.room-sounds').compareDocumentPosition(document.querySelector('.attribute-feelings'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.doesNotMatch(initial.text,/\d|°|fahrenheit|celsius/i);assert.match(initial.text,/You feel/);
    await page.reload();await page.waitForSelector('#attribute-effects');assert.deepEqual(await page.evaluate(()=>({seed:SugarCube.setup.weather.ensure().seed,temperature:SugarCube.setup.weather.temperature(),text:document.getElementById('attribute-effects').textContent})),initial);
    const moved=await page.evaluate(()=>{const before=SugarCube.setup.weather.temperature();SugarCube.setup.worldMovement.move(1,0);return {before,after:SugarCube.setup.weather.temperature(),text:document.getElementById('attribute-effects').textContent,expected:SugarCube.setup.attributeEffects.temperatureFeeling(SugarCube.setup.weather.temperature())};});assert.notEqual(moved.before,moved.after);assert.equal(moved.text,moved.expected);
    await page.evaluate(()=>{delete SugarCube.State.variables.weather;SugarCube.Engine.play('Apartments');});await page.waitForSelector('#attribute-effects');
    const migratedSeed=await page.evaluate(()=>SugarCube.setup.weather.ensure().seed);await page.reload();await page.waitForSelector('#attribute-effects');assert.equal(await page.evaluate(()=>SugarCube.setup.weather.ensure().seed),migratedSeed);
    const descriptions=await page.evaluate(()=>{const {setup,State}=SugarCube;const old=State.variables.character;State.variables.character={clothing:setup.clothing.defaults()};const values=[20,79,100].map(setup.attributeEffects.temperatureFeeling);State.variables.character=old;return values;});assert.equal(new Set(descriptions).size,3);for(const text of descriptions)assert.doesNotMatch(text,/\d|°/);
    await page.keyboard.press('t');await page.getByRole('button',{name:'Pass Time',exact:true}).click();assert.equal(await page.locator('#attribute-effects').textContent(),await page.evaluate(()=>SugarCube.setup.attributeEffects.temperatureFeeling(SugarCube.setup.weather.temperature())));
    assert.equal(await page.locator('#player-temperature').textContent(),await page.evaluate(()=>`${SugarCube.setup.weather.temperature().toFixed(1)}°F`));
});


test('clothing warmth weights coverage, keeps empty slots at zero and excludes bags and stored clothing',async()=>{
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube,character=State.variables.character,original=structuredClone(character.clothing);
        const baseline=setup.warmth.clothingAverage();character.clothing.bottoms='none';const noPants=setup.warmth.clothingAverage();character.clothing.top='none';const shoesOnly=setup.warmth.clothingAverage();character.clothing.shoes='none';const bare=setup.warmth.clothingAverage();
        character.clothing.storage='backpack';const backpack=setup.warmth.clothingAverage();character.clothing=original;
        setup.inventory.ensure().containers['ground:apartments:30:33']=[{id:'stored-warm-clothes',type:'shirt',x:0,y:0}];const stored=setup.warmth.clothingAverage();
        for(const slot of Object.keys(setup.warmth.weights)){const type=`test-insulation-${slot}`;setup.clothing.definitions[type]={name:'Insulated garment',warmth:10,pockets:[]};setup.clothing.choices[slot].push(type);character.clothing[slot]=type;}
        const full=setup.warmth.clothingAverage(),hot=setup.warmth.calculate(character,100).category,cold=setup.warmth.calculate(character,0).category;
        character.clothing.overtop='none';const withoutCoat=setup.warmth.clothingAverage();character.clothing=original;
        return {baseline,noPants,shoesOnly,bare,backpack,stored,full,hot,cold,withoutCoat,weight:setup.warmth.totalWeight,weights:setup.warmth.weights};});
    assert.equal(result.weight,23);assert.deepEqual(result.weights,{top:3,bottoms:3,overtop:3,undertop:2,underbottoms:2,feet:2,hands:2,shoes:2,hat:1,facewear:1,wrists:1,ankles:1});
    assert.equal(result.baseline,33/23);assert.equal(result.noPants,18/23);assert.equal(result.shoesOnly,6/23);assert.equal(result.bare,0);assert.equal(result.backpack,0);assert.equal(result.stored,result.baseline);
    assert.equal(result.full,10);assert.equal(result.hot,'Overheating');assert.equal(result.cold,'Warm');assert.equal(result.withoutCoat,200/23);
});

test('developer warmth calculation shows live slot contributions and formulas without changing the player or time',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const before=await page.evaluate(()=>{const {setup,State}=SugarCube;
        Object.assign(State.variables.character.clothing,{facewear:'simple-glasses',wrists:'cheap-watch',waist:'basic-belt',storage:'basic-backpack'});
        return {time:State.variables.world.elapsedSeconds,character:structuredClone(State.variables.character),result:setup.warmth.calculate()};
    });
    await page.keyboard.press('p');await page.getByRole('button',{name:'Warmth calculation',exact:true}).click();
    const table=page.getByRole('table',{name:'Equipped clothing contributions',exact:true});
    assert.equal(await table.locator('tbody tr').count(),12);
    assert.deepEqual(await table.locator('[data-slot="top"]').locator('th,td').allTextContents(),['Top','Generic shirt','4','×3','12']);
    assert.deepEqual(await table.locator('[data-slot="facewear"]').locator('th,td').allTextContents(),['Face Wear','Simple Glasses','-1','×1','-1']);
    assert.deepEqual(await table.locator('[data-slot="overtop"]').locator('th,td').allTextContents(),['Over Top','Empty','0','×3','0']);
    const summary=await page.locator('#developer-warmth-summary').textContent();
    assert.ok(summary.includes('31 ÷ 23 = 1.348'));assert.ok(summary.includes(`How you feel: ${before.result.category}`));
    assert.ok(summary.includes('World requirement = 8 − (8 − 2) × (temperature − 0) ÷ (100 − 0), capped at 2–8'));
    assert.ok(summary.includes(`= ${Number(before.result.world.toFixed(3))}`));
    assert.ok(summary.includes(`= ${Number(before.result.difference.toFixed(3))}`));
    assert.equal(before.result.clothing,31/23);
    await page.setViewportSize({width:320,height:844});await page.evaluate(()=>SugarCube.Dialog.resize());
    const bounds=await page.locator('.developer-warmth-table').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,right:el.getBoundingClientRect().right}));
    assert.ok(bounds.scroll>bounds.width,'narrow table scrolls within its own region');assert.ok(bounds.right<=320,'table region stays inside the viewport');
    await page.getByRole('button',{name:'Back to developer tools',exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'Clothing selector',exact:true}).isVisible());
    const after=await page.evaluate(()=>({time:SugarCube.State.variables.world.elapsedSeconds,character:structuredClone(SugarCube.State.variables.character)}));
    assert.equal(after.time,before.time);assert.deepEqual(after.character,before.character);
    await page.getByRole('button',{name:'Warmth calculation',exact:true}).click();
    assert.equal(await page.locator('#developer-warmth-summary').textContent(),summary);
});

test('warmth requirement clamps its Fahrenheit range and feeling bands cover fractional differences symmetrically',async()=>{
    const result=await page.evaluate(()=>{const {warmth}=SugarCube.setup;return {requirements:[-20,0,25,50,75,100,120].map(warmth.worldRequirement),bands:[-10,-4,-3.5,-3.49,-3,-2,-1.5,-1.49,-1,0,1,1.49,1.5,2,3,3.49,3.5,4,10].map(warmth.category)};});
    assert.deepEqual(result.requirements,[8,8,6.5,5,3.5,2,2]);assert.deepEqual(result.bands,['Freezing','Freezing','Freezing','Cold','Cold','Cold','Cold','Comfortable','Comfortable','Comfortable','Comfortable','Comfortable','Warm','Warm','Warm','Warm','Overheating','Overheating','Overheating']);
});

test('removing and rewearing clothes immediately changes hidden warmth and feelings without time and survives reload',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const stamp=await page.evaluate(()=>{const {setup,State}=SugarCube;const seed=setup.weather.ensure().seed;const base=setup.gameClock.now();let found=null;
        for(let i=0;i<365*24;i++){const time=base+i*3600,temp=setup.weather.temperature(time),clothed=setup.warmth.calculate(State.variables.character,temp),bare=setup.warmth.calculate({clothing:{}},temp);if(clothed.category!==bare.category){found=time;break;}}
        if(found===null)throw new Error('No clothing-sensitive weather found');State.variables.world.elapsedSeconds+=found-base;setup.rest.commit();return {seed,time:setup.gameClock.now()};});
    const before=await page.locator('#attribute-effects').textContent();await page.keyboard.press('i');
    for(const name of ['Generic shirt','Generic pants','Generic shoes']){await page.getByRole('button',{name:`Equipped ${name}`,exact:true}).click();await page.getByRole('button',{name:'Drop on ground',exact:true}).click();}
    const undressed=await page.locator('#attribute-effects').textContent();assert.notEqual(undressed,before);assert.doesNotMatch(undressed,/\d|°/);assert.equal(await page.evaluate(()=>SugarCube.setup.warmth.clothingAverage()),0);
    assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),stamp.time);await page.keyboard.press('i');await page.reload();await page.waitForSelector('#attribute-effects');assert.equal(await page.locator('#attribute-effects').textContent(),undressed);
    await page.keyboard.press('i');for(const name of ['Generic shirt','Generic pants','Generic shoes']){await page.getByRole('button',{name:new RegExp(`^${name},`)}).click();await page.getByRole('button',{name:`Wear ${name.toLowerCase()}`,exact:true}).click();}
    assert.equal(await page.locator('#attribute-effects').textContent(),before);assert.equal(await page.evaluate(()=>SugarCube.setup.gameClock.now()),stamp.time);assert.equal(await page.evaluate(()=>SugarCube.setup.weather.ensure().seed),stamp.seed);
});


test('spreadsheet clothing is available in gameplay without expanding character creation',async()=>{
    const selections=await page.locator('#character-controls select[name="top"],#character-controls select[name="bottoms"],#character-controls select[name="shoes"],#character-controls select[name="storage"],#character-controls select[name="handheld"]').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.name,Array.from(node.options,o=>o.value)])));
    assert.deepEqual(selections,{top:['none','shirt'],bottoms:['none','pants'],shoes:['none','shoes'],storage:['none','backpack'],handheld:['none']});
    const catalog=await page.evaluate(()=>SugarCube.setup.clothingCatalog.items.map(item=>({name:item.name,slot:item.slot,warmth:item.warmth})));
    assert.equal(catalog.length,34);assert.equal(new Set(catalog.map(item=>item.name)).size,34);
    assert.equal(catalog.find(item=>item.name==='Simple Glasses').warmth,-1);assert.equal(catalog.find(item=>item.name==='Cheap Watch').warmth,-1);assert.equal(catalog.find(item=>item.name==='Generic Shoes').slot,'shoes');
    assert.equal(await page.evaluate(()=>SugarCube.setup.developerClothing.equip('hoodie').ok),false);
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();await page.keyboard.press('p');await page.getByRole('button',{name:'Clothing selector',exact:true}).click();
    const expected=await page.evaluate(()=>structuredClone(SugarCube.State.variables.world));
    await page.getByLabel('Clothing slot',{exact:true}).selectOption('overtop');await page.getByLabel('Clothing item',{exact:true}).selectOption('hoodie');await page.getByRole('button',{name:'Equip clothing',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.overtop),'hoodie');assert.match(await page.locator('#developer-clothing-result').textContent(),/Hoodie equipped/);
    await page.getByLabel('Clothing slot',{exact:true}).selectOption('facewear');await page.getByLabel('Clothing item',{exact:true}).selectOption('simple-glasses');await page.getByRole('button',{name:'Equip clothing',exact:true}).click();
    assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.facewear),'simple-glasses');assert.deepEqual(await page.evaluate(()=>structuredClone(SugarCube.State.variables.world)),expected);
    await page.getByRole('button',{name:'Back to developer tools',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Max out all stats',exact:true}).isVisible());
    await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('#local-map');assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.overtop),'hoodie');assert.equal(await page.evaluate(()=>SugarCube.State.variables.character.clothing.facewear),'simple-glasses');
    await page.keyboard.press('i');assert.equal(await page.locator('[data-equip-slot="overtop"] .inventory-item').textContent(),'Hoodie');assert.equal(await page.locator('.augmentation-slot').first().locator('span').textContent(),'Basic ID chip');
    await page.keyboard.press('i');await page.setViewportSize({width:320,height:844});await page.keyboard.press('p');await page.getByRole('button',{name:'Clothing selector',exact:true}).click();
    const layout=await page.getByRole('dialog',{name:'Developer tools',exact:true}).evaluate(node=>{SugarCube.Dialog.resize();const rect=node.getBoundingClientRect();return {left:rect.left,right:rect.right,client:node.clientWidth,scroll:node.scrollWidth};});
    assert.ok(layout.left>=0&&layout.right<=320&&layout.scroll<=layout.client);
});

test('catalog pockets keep their distinct shapes and developer swaps preserve filled old garments',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const result=await page.evaluate(()=>{const {setup,State}=SugarCube;setup.inventory.ensure().containers['worn:shirt']=[{id:'kept-through-dev-swap',type:'apartmentKey',x:0,y:0}];
        const changed=setup.developerClothing.equip('plain-shirt'),ground=setup.groundItems.current(),old=setup.inventory.placements(ground).find(item=>item.type==='shirt');
        const belt=setup.developerClothing.equip('basic-belt'),hoodie=setup.developerClothing.equip('hoodie'),pants=setup.developerClothing.equip('plain-pants');
        const worn=setup.inventory.worn(),select=id=>worn.filter(p=>p.id.startsWith(`worn:${id}:`));
        const shapes=id=>select(id).map(p=>[p.columns,p.rows]);
        const waterFitsHoodie=setup.inventory.fits(select('hoodie')[0],{type:'water'},0,0),toolFitsBelt=select('basic-belt').some(p=>setup.inventory.fits(p,{type:'tools'},0,0));
        const pockets=Object.fromEntries(['basic-belt','hoodie','plain-pants','plain-shirt'].map(id=>[id,shapes(id)]));
        return {changed,belt,hoodie,pants,old,pockets,waterFitsHoodie,toolFitsBelt,time:State.variables.world.elapsedSeconds,oldCount:setup.inventory.placements(ground).filter(item=>item.id===old.id).length};});
    assert.ok(result.changed.ok&&result.belt.ok&&result.hoodie.ok&&result.pants.ok);assert.equal(result.time,0);assert.equal(result.oldCount,1);assert.equal(result.old.pockets['worn:shirt'][0].id,'kept-through-dev-swap');
    assert.deepEqual(result.pockets,{'basic-belt':[[2,1],[2,1],[1,1],[1,1]],hoodie:[[1,2]],'plain-pants':[[2,1],[2,1]],'plain-shirt':[[1,1]]});assert.equal(result.waterFitsHoodie,true);assert.equal(result.toolFitsBelt,false);
    const dropped=await page.evaluate(()=>{const {setup}=SugarCube;setup.inventory.ensure().containers['worn:basic-belt:1']=[{id:'belt-kept',type:'cloth',x:0,y:0}];const result=setup.equipment.drop('equipped:waist','equipped:waist');const item=setup.inventory.placements(setup.groundItems.current()).find(item=>item.type==='basic-belt');return {result,item};});
    assert.equal(dropped.result.ok,true);assert.equal(dropped.item.pockets['worn:basic-belt:1'][0].id,'belt-kept');
    await page.reload();await page.waitForSelector('#local-map');assert.equal(await page.evaluate(()=>SugarCube.setup.inventory.placements(SugarCube.setup.groundItems.current()).find(item=>item.type==='basic-belt').pockets['worn:basic-belt:1'][0].id),'belt-kept');
});

test('all catalog equipment can render independently, cool metal items subtract warmth and full ground rejects replacement safely',async()=>{
    await page.getByRole('link',{name:'Start at Apartments',exact:true}).click();
    const results=await page.evaluate(()=>{const {setup,State}=SugarCube;for(const slot of setup.clothing.slots)State.variables.character.clothing[slot]='none';$(document).trigger(':equipmentchange');
        const body=document.getElementById('body-layer').toDataURL(),head=document.getElementById('head-layer').toDataURL(),base=document.getElementById('character-canvas').toDataURL(),failures=[];
        for(const item of setup.clothingCatalog.items){State.variables.character.clothing[item.slot]=item.id;$(document).trigger(':equipmentchange');
            if(document.getElementById('character-canvas').toDataURL()===base)failures.push(item.id+' invisible');
            if(document.getElementById('body-layer').toDataURL()!==body||document.getElementById('head-layer').toDataURL()!==head)failures.push(item.id+' changes base');State.variables.character.clothing[item.slot]='none';}
        const naked=setup.warmth.clothingAverage();State.variables.character.clothing.facewear='simple-glasses';State.variables.character.clothing.wrists='cheap-watch';const metal=setup.warmth.clothingAverage();
        State.variables.character.clothing.top='plain-shirt';const ground=setup.groundItems.current(),inventory=setup.inventory.ensure();inventory.containers[ground.id]=Array.from({length:64},(_,i)=>({id:`full-${i}`,type:'cloth',x:i%8,y:Math.floor(i/8)}));
        const before=JSON.stringify(State.variables.inventory),blocked=setup.developerClothing.equip('t-shirt');
        return {failures,naked,metal,blocked,same:before===JSON.stringify(State.variables.inventory),top:State.variables.character.clothing.top,time:State.variables.world.elapsedSeconds};});
    assert.deepEqual(results.failures,[]);assert.equal(results.naked,0);assert.equal(results.metal,-2/23);assert.equal(results.blocked.ok,false);assert.equal(results.same,true);assert.equal(results.top,'plain-shirt');assert.equal(results.time,0);
});
