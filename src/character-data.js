/* Serializable character data only. Keep simulation separate from creation UI. */
setup.character = (() => {
    const choices = {
        gender: ['Male', 'Female'],
        genitals: ['Male', 'Female', 'Both'],
        bodyFat: ['Skinny', 'Petite', 'Average', 'Fat'],
        muscleMass: ['Skinny', 'Toned', 'Athletic', 'Muscular'],
        breastSize: ['Small', 'Medium', 'Large'],
        eyeColor: ['Blue', 'Green', 'Brown'],
        hairColor: ['Blonde', 'Black', 'Brown', 'Orange', 'Gray'],
        hairLength: ['Shaved', 'Ear', 'Neck', 'Chest', 'Waist', 'Knee', 'Floor'],
        skinTone: ['Pale', 'Tan', 'Olive', 'Dark']
    };
    const defaults = () => ({
        version: 2, age: 26, gender: 'Male', genitals: 'Male', heightInches: 66,
        bodyFat: 'Average', muscleMass: 'Toned', eyeColor: 'Brown',
        hairColor: 'Black', hairLength: 'Ear', skinTone: 'Tan', breastSize: 'Medium'
    });
    function normalize(value) {
        const result = defaults();
        if (value && typeof value === 'object') {
            for (const [key, allowed] of Object.entries(choices)) {
                if (allowed.includes(value[key])) result[key] = value[key];
            }
            if (Number.isFinite(value.heightInches)) {
                result.heightInches = Math.max(48, Math.min(84, Math.round(value.heightInches)));
            }
        }
        return result;
    }
    function ensure() {
        State.variables.character = normalize(State.variables.character);
        return State.variables.character;
    }
    const heightLabel = inches => `${Math.floor(inches / 12)} ft ${inches % 12} in`;
    return {choices, defaults, normalize, ensure, heightLabel};
})();
