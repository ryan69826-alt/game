/* Awake time and recovery are game-time based, never wall-clock based. Fatigue
 * is a burden: 0 is rested, 40 is the collapse threshold. Action costs add to it. */
setup.rest = (() => {
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    function ensure() {
        const old=State.variables.rest;
        const tiredness=Number.isFinite(old?.tiredness)?clamp(old.tiredness,0,100):0;
        State.variables.rest={version:1,tiredness,
            exertion:Number.isFinite(old?.exertion)?clamp(old.exertion,0,40-Math.floor(tiredness*.4)):0,
            awakeSeconds:Number.isSafeInteger(old?.awakeSeconds)&&old.awakeSeconds>=0?old.awakeSeconds:0,
            activity:old?.activity&&['sit','wake'].includes(old.activity.kind)?{kind:old.activity.kind,unitId:String(old.activity.unitId)}:null};
        return State.variables.rest;
    }
    const fatigue=(rest=ensure())=>clamp(Math.floor(rest.tiredness*.4)+rest.exertion,0,40);
    function addTime(seconds) {
        const world=State.variables.world,before=world.elapsedSeconds;
        world.elapsedSeconds=Math.min(setup.gameClock.maxElapsedSeconds,before+seconds);return world.elapsedSeconds-before;
    }
    function recover(hours,unitId=null) {
        const rest=ensure(),before=fatigue(rest);
        const seconds=addTime(hours*3600),actualHours=seconds/3600;
        rest.tiredness=clamp(rest.tiredness-10*actualHours,0,100);
        rest.exertion=Math.max(0,before-4*actualHours-Math.floor(rest.tiredness*.4));
        rest.awakeSeconds=0;rest.activity=unitId?{kind:'wake',unitId}:null;
        return seconds;
    }
    function collapse() {
        recover(1);$(document).trigger(':restcollapse');
        return {ok:false,collapsed:true,message:`You collapse from fatigue and pass out for one hour. You wake at ${setup.gameClock.formatStamp(setup.gameClock.now())}.`};
    }
    function advanceAwake(seconds) {
        if(!Number.isSafeInteger(seconds)||seconds<0) return {ok:false,message:'Invalid awake-time duration.'};
        const rest=ensure(),beforeTicks=Math.floor(rest.awakeSeconds/900);
        rest.activity=null;rest.awakeSeconds+=addTime(seconds);
        rest.tiredness=clamp(rest.tiredness+Math.floor(rest.awakeSeconds/900)-beforeTicks,0,100);
        rest.exertion=Math.min(rest.exertion,40-Math.floor(rest.tiredness*.4));
        return fatigue(rest)>=40?collapse():{ok:true};
    }
    function commit() {setup.housing.collectDue();State.create(State.passage);$(document).trigger(':timechange');}
    function exert(cost) {
        if(!Number.isFinite(cost)||cost<0||cost>40) return {ok:false,message:'Invalid fatigue cost.'};
        const rest=ensure();
        if(fatigue(rest)+cost>=40) {
            rest.exertion=40-Math.floor(rest.tiredness*.4);
            const result=collapse();commit();return result;
        }
        rest.exertion+=cost;commit();return {ok:true};
    }
    function changeTiredness(amount) {
        if(!Number.isFinite(amount)) return false;
        const rest=ensure();rest.tiredness=clamp(rest.tiredness+amount,0,100);
        rest.exertion=Math.min(rest.exertion,40-Math.floor(rest.tiredness*.4));commit();return true;
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
    function refresh() {
        if(!document.getElementById('player-tiredness')) return;
        const rest=ensure();document.getElementById('player-tiredness').textContent=`${Number(rest.tiredness.toFixed(1))} / 100`;
        document.getElementById('player-fatigue').textContent=`${Number(fatigue(rest).toFixed(1))} / 40`;
    }
    return {ensure,fatigue,advanceAwake,collapse,commit,exert,changeTiredness,sit,sleep,refresh};
})();
$(document).on(':passagedisplay :timechange :playerchange',setup.rest.refresh);
