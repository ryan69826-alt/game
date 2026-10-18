/* Creation rules stay independent of artwork and DOM. XP is cumulative. */
setup.characterRules = (() => {
    const traits = ['Nerd', 'Athlete', 'Delinquent', 'Promiscuous', 'Exhibitionist',
        'Deviant', 'Beautiful', 'Lustful', 'Masochist', 'Sadist', 'Polyamorous',
        'Nudist', 'Insane', 'Ugly', 'Innocent'];
    const skills = ['Lockpicking', 'Stealth', 'Dancing', 'Swimming', 'Athleticism',
        'Tending', 'Housekeeping', 'Endurance', 'Agility', 'Combat', 'Ranged',
        'Medical', 'Crafting', 'Charm', 'Deception', 'Perception', 'Intimidation', 'Focus'];
    // Display organization only. Keep the flat skill order above stable for saves.
    const skillCategories = [
        {id:'physical', name:'Physical', skills:['Athleticism', 'Endurance', 'Agility', 'Swimming', 'Dancing']},
        {id:'combat', name:'Combat', skills:['Combat', 'Ranged']},
        {id:'covert', name:'Covert', skills:['Stealth', 'Lockpicking']},
        {id:'practical', name:'Practical', skills:['Tending', 'Housekeeping', 'Medical', 'Crafting']},
        {id:'social', name:'Social', skills:['Charm', 'Deception', 'Intimidation']},
        {id:'mental', name:'Mental', skills:['Perception', 'Focus']}
    ];
    const budget = 250;
    const maxLevel = 10;
    const levelCost = level => 50 * 2 ** (level - 1);
    const maxXp = 50 * (2 ** maxLevel - 1);
    function progress(xp) {
        let level = 0, remainder = Math.max(0, Math.min(maxXp, Math.floor(xp) || 0));
        while (level < maxLevel && remainder >= levelCost(level + 1)) {
            remainder -= levelCost(level + 1);
            level++;
        }
        return {level, xp: remainder, nextCost: level < maxLevel ? levelCost(level + 1) : null};
    }
    const spent = character => skills.reduce((total, name) => total + character.skills[name], 0);
    const remaining = character => budget - spent(character);
    function allocate(character, name, xp) {
        if (!skills.includes(name) || !Number.isInteger(xp) || xp < 0 ||
            xp > character.skills[name] + remaining(character)) return false;
        character.skills[name] = xp;
        return true;
    }
    return {traits, skills, skillCategories, budget, maxLevel, maxXp, levelCost, progress, spent, remaining, allocate};
})();
