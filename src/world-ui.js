/* Read-only world views reuse the same saved character as the creator. */
$(document).on(':passagedisplay', () => {
    if (!document.querySelector('.world-sidebar')) return;
    const character = State.variables.character;
    setup.characterDisplay.mount(character);
    document.querySelector('[data-character-summary]').textContent = `${character.gender} · ${setup.character.heightLabel(character.heightInches)}`;
    for (const link of document.querySelectorAll('.sidebar-nav a')) {
        if (link.dataset.passage === State.passage) link.setAttribute('aria-current', 'page');
    }
    const details = document.getElementById('character-details');
    if (details) {
        const fields = {Age: character.age, Gender: character.gender, Genitals: character.genitals,
            Height: setup.character.heightLabel(character.heightInches), 'Body fat': character.bodyFat,
            'Muscle mass': character.muscleMass, ...(character.gender === 'Female' ? {'Breast size': character.breastSize} : {}),
            'Eye color': character.eyeColor, 'Hair color': character.hairColor, 'Hair length': character.hairLength, 'Skin tone': character.skinTone};
        for (const [name, value] of Object.entries(fields)) {
            const term = document.createElement('dt');term.textContent = name;
            const description = document.createElement('dd');description.textContent = value;
            details.append(term, description);
        }
        const list = document.getElementById('character-traits');
        for (const name of character.traits.length ? character.traits : ['No starting traits selected']) {
            const item = document.createElement('li');item.textContent = name;list.append(item);
        }
    }
    const skills = document.getElementById('world-skills');
    if (skills) for (const name of setup.characterRules.skills) {
        const status = setup.characterRules.progress(character.skills[name]);
        const row = document.createElement('div');row.className = 'world-skill';row.dataset.skill = name;
        const label = document.createElement('h3');label.textContent = name;
        const level = document.createElement('span');level.className = 'world-skill-level';level.textContent = `Level ${status.level} / 10`;
        const bar = document.createElement('progress');bar.max = status.nextCost || 1;bar.value = status.nextCost ? status.xp : 1;bar.setAttribute('aria-label', `${name} progress to next level`);
        const xp = document.createElement('span');xp.className = 'world-skill-xp';xp.textContent = status.nextCost ? `${status.xp} / ${status.nextCost} XP toward level ${status.level + 1}` : 'Maximum level';
        row.append(label, level, bar, xp);skills.append(row);
    }
});
