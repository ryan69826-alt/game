/* Read-only world views reuse the same saved character as the creator. */
$(document).on(':passagedisplay', () => {
    if (!document.querySelector('.world-sidebar')) return;
    const character = State.variables.character;
    setup.characterDisplay.mount(character);
    for (const link of document.querySelectorAll('.sidebar-nav a')) {
        const shortcut=link.querySelector('[data-shortcut]');
        if(shortcut) link.setAttribute('aria-keyshortcuts',shortcut.dataset.shortcut);
        if (link.dataset.passage === State.passage) link.setAttribute('aria-current', 'page');
    }
});

/* SugarCube owns dialog focus, backdrop, and close-button behavior. */
setup.worldWindows = (() => {
    function populate(root, character) {
        const vitals=root.querySelector('#player-stats');
        if(vitals) {
            const player=setup.playerState.ensure();
            const rest=setup.rest.ensure();
            for(const [name,value] of Object.entries({Health:`${player.health} / ${player.maxHealth}`,Money:setup.playerState.formatMoney(player.money),Tiredness:`${rest.tiredness} / 100`,Fatigue:`${setup.rest.fatigue(rest)} / 100`,'Endurance used':`${setup.endurance.ensure().used} / ${setup.endurance.capacity()}`})) {
                const term=document.createElement('dt');term.textContent=name;
                const description=document.createElement('dd');description.textContent=value;vitals.append(term,description);
            }
        }
        const details = root.querySelector('#character-details');
        if (details) {
            const fields = {Age: character.age, Gender: character.gender, Genitals: character.genitals,
                'Base model': character.gender === 'Female' ? 'Bodysuit base' : 'Original male', Clothing: setup.clothing.summary(character),
                'Eye color': character.eyeColor, 'Hair color': character.hairColor, 'Hair length': character.hairLength, 'Skin tone': character.skinTone};
            for (const [name, value] of Object.entries(fields)) {
                const term = document.createElement('dt');term.textContent = name;
                const description = document.createElement('dd');description.textContent = value;
                details.append(term, description);
            }
            const list = root.querySelector('#character-traits');
            for (const name of character.traits.length ? character.traits : ['No starting traits selected']) {
                const item = document.createElement('li');item.textContent = name;list.append(item);
            }
        }
        const skills = root.querySelector('#world-skills');
        if (skills) for (const category of setup.characterRules.skillCategories) {
            const group=document.createElement('section');group.className='skill-category';group.dataset.category=category.id;
            const title=document.createElement('h3');title.className='skill-category-title';title.id=`stats-skills-${category.id}`;title.textContent=category.name;
            group.setAttribute('aria-labelledby',title.id);
            const grid=document.createElement('div');grid.className='skill-category-grid';
            group.append(title,grid);skills.append(group);
            for (const name of category.skills) {
                const status = setup.skills.progress(name);
                const row = document.createElement('div');row.className = 'world-skill';row.dataset.skill = name;
                const label = document.createElement('h4');label.textContent = name;
                const level = document.createElement('span');level.className = 'world-skill-level';level.textContent = `Level ${status.level} / 10`;
                const bar = document.createElement('progress');bar.max = status.nextCost || 1;bar.value = status.nextCost ? status.xp : 1;bar.setAttribute('aria-label', `${name} progress to next level`);
                const xp = document.createElement('span');xp.className = 'world-skill-xp';xp.textContent = status.nextCost ? `${status.xp} / ${status.nextCost} XP toward level ${status.level + 1}` : 'Maximum level';
                row.append(label, level, bar, xp);grid.append(row);
            }
        }
    }
    function open(name) {
        const sheets={Character:'CharacterSheet',Stats:'StatsSheet','Quests/Jobs':'QuestsJobsSheet'};
        if (!Object.hasOwn(sheets,name) || !document.querySelector(".world-sidebar")) return;
        Dialog.setup(name, "character-window");
        Dialog.wiki(Story.get(sheets[name]).processText());
        populate(Dialog.body(), State.variables.character);
        Dialog.open();
    }
    return {open};
})();

$(document).on('keydown.characterWindow', event => {
    if (event.key === 'Escape' && Dialog.isOpen() && ['character-window','atlas-window'].some(name=>Dialog.body().classList.contains(name))) {
        event.preventDefault();
        Dialog.close();
    }
});

$(document).on(':equipmentchange',()=>{if(document.querySelector('.world-sidebar')) setup.characterDisplay.mount(State.variables.character);});

/* World shortcuts never replace a dialog or intercept typing/browser shortcuts. */
$(document).on('keydown.sidebarShortcuts',event=>{
    const key=event.key.toLowerCase();
    if(!['i','c'].includes(key)||event.repeat||event.originalEvent?.repeat||event.ctrlKey||event.altKey||event.metaKey||Dialog.isOpen()||
        event.target.closest('input,select,textarea,[contenteditable="true"]')||!document.querySelector('.world-sidebar'))return;
    event.preventDefault();
    if(key==='i')setup.inventoryUI.open();else setup.worldWindows.open('Character');
});
