/* Endurance is breath used, not fatigue: 0 is ready, capacity is out of breath. */
setup.endurance = (() => {
    const capacity=(level=setup.skills.progress('Endurance').level)=>25+5*level*(level+1)/2;
    function ensure() {
        const old=State.variables.endurance;
        State.variables.endurance={version:1,
            used:Number.isFinite(old?.used)?Math.max(0,Math.min(capacity(),Math.floor(old.used))):0,
            sprintSteps:Number.isSafeInteger(old?.sprintSteps)&&old.sprintSteps>=0?old.sprintSteps%25:0,
            recoverySeconds:Number.isSafeInteger(old?.recoverySeconds)&&old.recoverySeconds>=0?old.recoverySeconds%5:0};
        return State.variables.endurance;
    }
    const canSprint=()=>ensure().used<capacity();
    function sprint() {
        const state=ensure();if(state.used>=capacity()) return false;
        state.used++;state.recoverySeconds=0;state.sprintSteps++;
        if(state.sprintSteps===25) {state.sprintSteps=0;setup.skills.award('Endurance',1);}
        return true;
    }
    function recover(seconds) {
        if(!Number.isSafeInteger(seconds)||seconds<0) return;
        const state=ensure(),elapsed=state.recoverySeconds+seconds;
        state.used=Math.max(0,state.used-Math.floor(elapsed/5));state.recoverySeconds=elapsed%5;
    }
    function pauseRecovery() {ensure().recoverySeconds=0;}
    function refresh() {
        const output=document.getElementById('player-endurance');if(!output) return;
        const state=ensure(),max=capacity(),bar=document.getElementById('player-endurance-bar');
        output.textContent=`${state.used} / ${max}`;bar.max=max;bar.value=state.used;
    }
    return {capacity,ensure,canSprint,sprint,recover,pauseRecovery,refresh};
})();
$(document).on(':passagedisplay :timechange :playerchange',()=>{if(document.querySelector('.world-sidebar')) setup.endurance.refresh();});
