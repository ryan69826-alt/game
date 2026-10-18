/* Starting traits and refundable skill allocation; no simulation effects yet. */
setup.characterCreationBuild = (() => {
    function mount(root, character) {
        const rules = setup.characterRules;
        function section(title, note) {
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'customization-group starting-group';
            const legend = document.createElement('legend');legend.textContent = title;
            const description = document.createElement('p');description.className = 'creation-help';description.textContent = note;
            fieldset.append(legend, description);root.append(fieldset);
            return fieldset;
        }
        const traits = section('Starting traits', 'Choose any starting traits. Stat and skill effects are awaiting definitions.');
        const traitGrid = document.createElement('div');traitGrid.className = 'trait-grid';
        for (const name of rules.traits) {
            const label = document.createElement('label');label.className = 'trait-choice';
            const input = document.createElement('input');input.type = 'checkbox';input.checked = character.traits.includes(name);
            input.addEventListener('change', () => {
                character.traits = rules.traits.filter(trait => trait === name ? input.checked : character.traits.includes(trait));
            });
            const text = document.createElement('span');text.textContent = name;
            label.append(input, text);traitGrid.append(label);
        }
        traits.append(traitGrid);
        const skills = section('Starting skills', 'Skills start untrained at level 0. Spend 50 XP to reach level 1, then another 100 for level 2, then 200 for level 3. Costs keep doubling, up to level 10.');
        const budget = document.createElement('div');budget.className = 'skill-budget';
        const remaining = document.createElement('span');remaining.id = 'skill-budget';
        const reset = document.createElement('button');reset.type = 'button';reset.textContent = 'Reset skill XP';
        budget.append(remaining, reset);skills.append(budget);
        const help = document.createElement('p');help.className = 'creation-help';help.textContent = 'Enter total XP per skill, or use − / + to move 10 XP. Removing XP refunds your pool.';skills.append(help);
        const feedback = document.createElement('p');feedback.className = 'allocation-status';feedback.setAttribute('role', 'status');feedback.setAttribute('aria-live', 'polite');skills.append(feedback);
        const rows = [];
        for (const category of rules.skillCategories) {
            const group=document.createElement('section');group.className='skill-category';group.dataset.category=category.id;
            const title=document.createElement('h3');title.className='skill-category-title';title.id=`creation-skills-${category.id}`;title.textContent=category.name;
            group.setAttribute('aria-labelledby',title.id);group.append(title);skills.append(group);
            for (const name of category.skills) {
                const row = document.createElement('div');row.className = 'skill-row';
                const heading = document.createElement('div');heading.className = 'skill-heading';
                const label = document.createElement('label');label.textContent = name;label.htmlFor = `skill-${name.toLowerCase()}`;
                const level = document.createElement('span');level.className = 'skill-level';heading.append(label, level);
                const controls = document.createElement('div');controls.className = 'skill-allocation';
                const minus = document.createElement('button');minus.type = 'button';minus.textContent = '−';minus.setAttribute('aria-label', `Refund 10 XP from ${name}`);
                const input = document.createElement('input');input.type = 'number';input.min = '0';input.step = '1';input.id = label.htmlFor;input.setAttribute('aria-label', `XP allocated to ${name}`);
                const plus = document.createElement('button');plus.type = 'button';plus.textContent = '+';plus.setAttribute('aria-label', `Add 10 XP to ${name}`);
                controls.append(minus, input, plus);
                const progress = document.createElement('progress');progress.setAttribute('aria-label', `${name} progress to next level`);
                const detail = document.createElement('span');detail.className = 'skill-progress-label';
                row.append(heading, controls, progress, detail);group.append(row);
                function assign(xp) {
                    if (!rules.allocate(character, name, xp)) {
                        feedback.textContent = `Enter a whole number from 0 to ${character.skills[name] + rules.remaining(character)} XP for ${name}.`;
                    } else feedback.textContent = '';
                    refresh();
                }
                minus.addEventListener('click', () => assign(Math.max(0, character.skills[name] - 10)));
                plus.addEventListener('click', () => assign(character.skills[name] + Math.min(10, rules.remaining(character))));
                input.addEventListener('change', () => assign(input.value === '' ? NaN : Number(input.value)));
                rows.push({name, input, minus, plus, level, progress, detail});
            }
        }
        function refresh() {
            const available = rules.remaining(character);
            remaining.textContent = `${available} / ${rules.budget} XP remaining`;
            reset.disabled = available === rules.budget;
            for (const row of rows) {
                const xp = character.skills[row.name], status = rules.progress(xp);
                row.input.value = xp;row.input.max = xp + available;
                row.minus.disabled = xp === 0;row.plus.disabled = available === 0;
                row.level.textContent = `Level ${status.level} / ${rules.maxLevel}`;
                row.progress.max = status.nextCost || 1;row.progress.value = status.nextCost ? status.xp : 1;
                row.detail.textContent = status.nextCost ? `${status.xp} / ${status.nextCost} XP toward level ${status.level + 1}` : 'Maximum level';
            }
        }
        reset.addEventListener('click', () => {
            for (const name of rules.skills) character.skills[name] = 0;
            feedback.textContent = 'All skill XP refunded.';refresh();
        });
        refresh();
    }
    return {mount};
})();
