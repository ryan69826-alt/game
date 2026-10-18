/* Serializable character data only. Keep simulation separate from creation UI. */
setup.character = (() => {
    const choices = {
        gender: ['Male', 'Female'],
        genitals: ['Male', 'Female', 'Both'],
        bodySize: ['Small', 'Medium', 'Large'],
        breastSize: ['Small', 'Medium', 'Large'],
        eyeColor: ['Blue', 'Green', 'Brown'],
        hairColor: ['Blonde', 'Black', 'Brown', 'Orange', 'Gray'],
        hairLength: ['Shaved', 'Ear', 'Neck', 'Chest', 'Waist', 'Knee', 'Floor'],
        skinTone: ['Pale', 'Tan', 'Olive', 'Dark']
    };
    const defaults = () => ({
        version: 5, age: 26, gender: 'Male', genitals: 'Male', bodySize: 'Medium',
        clothing: setup.clothing.defaults(), eyeColor: 'Brown',
        hairColor: 'Black', hairLength: 'Ear', skinTone: 'Tan', breastSize: 'Medium',
        traits: [], skills: Object.fromEntries(setup.characterRules.skills.map(name => [name, 0]))
    });
    function normalize(value) {
        const result = defaults();
        if (value && typeof value === 'object') {
            for (const [key, allowed] of Object.entries(choices)) {
                if (allowed.includes(value[key])) result[key] = value[key];
            }
            result.clothing = setup.clothing.normalize(value.clothing);
            const rules = setup.characterRules;
            if (Array.isArray(value.traits)) {
                result.traits = rules.traits.filter(name => value.traits.includes(name));
            }
            let available = rules.budget;
            for (const name of rules.skills) {
                const xp = value.skills?.[name];
                if (!Number.isFinite(xp)) continue;
                result.skills[name] = Math.min(available, Math.max(0, Math.floor(xp)));
                available -= result.skills[name];
            }
        }
        return result;
    }
    function ensure() {
        State.variables.character = normalize(State.variables.character);
        return State.variables.character;
    }
    return {choices, defaults, normalize, ensure};
})();
