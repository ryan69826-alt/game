/* Awake time and recovery are game-time based, never wall-clock based. Fatigue
 * is a burden: 0 is rested, 100 is the collapse threshold. Tiredness contributes
 * up to 40 as a floor. Eligible game minutes recover fatigue, including sleep. */
setup.rest = (() => {
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const floor=rest=>Math.floor(clamp(rest.tiredness,0,100)*.4);
    const fatigue=(rest=ensure())=>clamp(Number.isFinite(rest.fatigue)?rest.fatigue:floor(rest)+(Number.isFinite(rest.exertion)?rest.exertion:0),floor(rest),100);
    function ensure() {
        const old=State.variables.rest;
        const tiredness=Number.isFinite(old?.tiredness)?clamp(old.tiredness,0,100):0;
        const normalized={tiredness,fatigue:old?.fatigue,exertion:old?.exertion};
        State.variables.rest={version:2,tiredness,fatigue:fatigue(normalized),
            awakeSeconds:Number.isSafeInteger(old?.awakeSeconds)&&old.awakeSeconds>=0?old.awakeSeconds:0,
            recoverySeconds:Number.isSafeInteger(old?.recoverySeconds)&&old.recoverySeconds>=0?old.recoverySeconds%60:0,
            activity:old?.activity&&['sit','wake'].includes(old.activity.kind)?{kind:old.activity.kind,unitId:String(old.activity.unitId)}:null};
        return State.variables.rest;
    }
    function addTime(seconds) {
        const world=State.variables.world,before=world.elapsedSeconds;
        world.elapsedSeconds=Math.min(setup.gameClock.maxElapsedSeconds,before+seconds);return world.elapsedSeconds-before;
    }
    function recoverFatigue(rest,seconds) {
        const elapsed=rest.recoverySeconds+seconds;
        rest.fatigue=clamp(rest.fatigue-Math.floor(elapsed/60),floor(rest),100);
        rest.recoverySeconds=elapsed%60;
    }
    function recover(hours,unitId=null,tirednessInterval=300) {
        const rest=ensure(),seconds=addTime(Math.round(hours*3600));
        rest.tiredness=clamp(rest.tiredness-Math.floor(seconds/tirednessInterval),0,100);
        recoverFatigue(rest,seconds);setup.endurance.recover(seconds);
        rest.awakeSeconds=0;rest.activity=unitId?{kind:'wake',unitId}:null;
        return seconds;
    }
    function collapse() {
        const rest=ensure(),duration=Math.max(60,Math.ceil(Math.max(0,rest.tiredness-80))*300);
        const seconds=recover(duration/3600);$(document).trigger(':restcollapse');
        return {ok:false,collapsed:true,message:`You collapse and pass out for ${Math.round(seconds/60)} minutes. You wake at ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function advanceAwake(seconds,recovering=true,recoverEndurance=true) {
        if(!Number.isSafeInteger(seconds)||seconds<0) return {ok:false,message:'Invalid awake-time duration.'};
        const rest=ensure(),beforeTicks=Math.floor(rest.awakeSeconds/900);
        const elapsed=addTime(seconds);
        if(recoverEndurance) setup.endurance.recover(elapsed);else setup.endurance.pauseRecovery();
        rest.activity=null;rest.awakeSeconds+=elapsed;
        rest.tiredness=clamp(rest.tiredness+Math.floor(rest.awakeSeconds/900)-beforeTicks,0,100);
        if(recovering) recoverFatigue(rest,elapsed);
        else {rest.recoverySeconds=0;rest.fatigue=fatigue(rest);}
        return fatigue(rest)>=100||rest.tiredness>=100?collapse():{ok:true};
    }
    function commit() {setup.housing.collectDue();State.create(State.passage);$(document).trigger(':timechange');}
    function exert(cost,durationSeconds=0) {
        if(!Number.isFinite(cost)||cost<0||cost>100) return {ok:false,message:'Invalid fatigue cost.'};
        if(!Number.isSafeInteger(durationSeconds)||durationSeconds<0) return {ok:false,message:'Invalid activity duration.'};
        const rest=ensure();rest.fatigue=clamp(fatigue(rest)+cost,floor(rest),100);
        if(cost>0) rest.recoverySeconds=0;
        if(rest.fatigue>=100||rest.tiredness>=100) {
            const result=collapse();commit();return result;
        }
        const result=advanceAwake(durationSeconds,cost===0,cost===0);commit();return result;
    }
    function changeTiredness(amount) {
        if(!Number.isFinite(amount)) return false;
        const rest=ensure();rest.tiredness=clamp(rest.tiredness+amount,0,100);
        rest.fatigue=fatigue(rest);
        if(rest.tiredness>=100||rest.fatigue>=100) collapse();commit();return true;
    }
    function reachableBed(id) {
        const target=setup.interactions.nearby().find(target=>target.object.id===id&&target.object.kind==='bed');
        return target?.object||null;
    }
    function sit(id) {
        const bed=reachableBed(id);if(!bed) return {ok:false,message:'That bed is not within reach.'};
        ensure().activity={kind:'sit',unitId:bed.unitId};State.create(State.passage);$(document).trigger(':roomchange');
        return {ok:true,message:'You sit on the edge of the bed. No time passes.'};
    }
    function sleep(id,hours) {
        const bed=reachableBed(id);
        if(!bed||!Number.isInteger(hours)||hours<1||hours>10) return {ok:false,message:'Choose 1–10 hours at a bed within reach.'};
        recover(hours,bed.unitId);commit();
        return {ok:true,message:`You rest for ${hours} hour${hours===1?'':'s'} and wake at ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function comfort() {
        return setup.interactions.nearby().find(target=>target.object.kind==='bed'||target.object.comfortable===true)?.object||null;
    }
    function sleepAnywhere(hours) {
        if(!Number.isInteger(hours)||hours<1||hours>10) return {ok:false,message:'Choose 1–10 hours to sleep.'};
        const object=comfort();
        recover(hours,object?.unitId||null,object?300:450);commit();
        return {ok:true,message:`You lie down ${object?'on '+object.name.toLowerCase():setup.vehicleCabin.current()?'in the car seat':'on the ground'} and sleep for ${hours} hour${hours===1?'':'s'}. You wake at ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function passTime() {
        const result=exert(0,900);
        return result.collapsed?result:{ok:true,message:`You pass 15 minutes. It is now ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function restOneMinute() {
        const result=exert(0,60);
        return result.collapsed?result:{ok:true,message:`You rest for 1 minute. It is now ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function refresh() {
        if(!document.getElementById('player-tiredness')) return;
        const rest=ensure();document.getElementById('player-tiredness').textContent=`${Number(rest.tiredness.toFixed(1))} / 100`;
        document.getElementById('player-fatigue').textContent=`${Number(fatigue(rest).toFixed(1))} / 100`;
    }
    return {ensure,fatigue,advanceAwake,collapse,commit,exert,changeTiredness,sit,sleep,comfort,sleepAnywhere,passTime,restOneMinute,refresh};
})();
$(document).on(':passagedisplay :timechange :playerchange',setup.rest.refresh);
