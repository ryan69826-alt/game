/* Earned XP is separate from the creator's fixed 250-XP allocation. */
setup.skills = (() => {
    function earned(name) {
        const value=State.variables.skillXp?.[name];
        return Number.isSafeInteger(value)&&value>=0?Math.min(value,setup.characterRules.maxXp):0;
    }
    function xp(name) {
        return Math.min(setup.characterRules.maxXp,(State.variables.character?.skills?.[name]||0)+earned(name));
    }
    const progress=name=>setup.characterRules.progress(xp(name));
    function award(name,amount) {
        if(!setup.characterRules.skills.includes(name)||!Number.isSafeInteger(amount)||amount<0) return false;
        const old=State.variables.skillXp;
        State.variables.skillXp={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[name]:Math.min(setup.characterRules.maxXp,earned(name)+amount)};
        return true;
    }
    return {earned,xp,progress,award};
})();
