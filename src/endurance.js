/* Endurance is breath used, not fatigue: 0 is ready, capacity is out of breath. */
setup.endurance = (() => {
    const capacity=(level=setup.skills.progress('Endurance').level)=>25+5*level*(level+1)/2;
    function ensure() {
        const old=State.variables.endurance;
        const max=capacity(),used=Number.isFinite(old?.used)?Math.max(0,Math.min(max,old.used)):0;
        State.variables.endurance={version:2,used,
            exhausted:used>=max||(old?.exhausted===true&&used>=max*.8),
            sprintSteps:Number.isSafeInteger(old?.sprintSteps)&&old.sprintSteps>=0?old.sprintSteps%25:0,
            recoverySeconds:Number.isSafeInteger(old?.recoverySeconds)&&old.recoverySeconds>=0?old.recoverySeconds%5:0};
        return State.variables.endurance;
    }
    const canSprint=()=>!ensure().exhausted;
    function sprint() {
        const state=ensure();if(state.exhausted) return false;
        state.used++;state.recoverySeconds=0;state.sprintSteps++;
        if(state.used>=capacity())state.exhausted=true;
        if(state.sprintSteps===25) {state.sprintSteps=0;setup.skills.award('Endurance',1);}
        return true;
    }
    function recover(seconds) {
        if(!Number.isSafeInteger(seconds)||seconds<0) return;
        const state=ensure(),elapsed=state.recoverySeconds+seconds;
        state.used=Math.max(0,Math.round((state.used-Math.floor(elapsed/5)*capacity()*.02)*1e6)/1e6);state.recoverySeconds=elapsed%5;
        if(state.used<capacity()*.8)state.exhausted=false;
    }
    function pauseRecovery() {ensure().recoverySeconds=0;}
    function refresh() {
        const output=document.getElementById('player-endurance');if(!output) return;
        const state=ensure(),max=capacity(),bar=document.getElementById('player-endurance-bar');
        output.textContent=`${Number(state.used.toFixed(2))} / ${max}`;bar.max=max;bar.value=state.used;
        output.title=state.exhausted?'Out of breath. Recover below 80% before sprinting again.':'Endurance used';
    }
    return {capacity,ensure,canSprint,sprint,recover,pauseRecovery,refresh};
})();
$(document).on(':passagedisplay :timechange :playerchange',()=>{if(document.querySelector('.world-sidebar')) setup.endurance.refresh();});
