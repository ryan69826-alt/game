/* Money uses whole dollars. Vitals and transactions are independent of artwork
 * and creation XP. These values persist in SugarCube moments and disk saves. */
setup.playerState = (() => {
    const startingMoney = 99999, maxHealth = 100;
    function ensure() {
        const old=State.variables.player;
        State.variables.player={version:1,
            money:Number.isSafeInteger(old?.money) && old.money>=0 ? old.money : startingMoney,
            health:Number.isFinite(old?.health) ? Math.max(0,Math.min(maxHealth,Math.floor(old.health))) : maxHealth,
            baseStealth:Number.isFinite(old?.baseStealth)?Math.max(0,Math.min(100,old.baseStealth)):setup.stealth.startingBase,
            maxHealth};
        return State.variables.player;
    }
    function spend(amount) {
        const player=ensure();
        if(!Number.isSafeInteger(amount) || amount<0 || amount>player.money) return false;
        player.money-=amount;return true;
    }
    function changeMoney(amount) {
        const player=ensure(),next=player.money+amount;
        if(!Number.isSafeInteger(amount) || !Number.isSafeInteger(next) || next<0) return false;
        player.money=next;commit();return true;
    }
    function changeHealth(amount) {
        if(!Number.isSafeInteger(amount)) return false;
        const player=ensure();player.health=Math.max(0,Math.min(maxHealth,player.health+amount));commit();return true;
    }
    function commit() {State.create(State.passage);$(document).trigger(':playerchange');}
    const formatMoney=amount=>`$${amount.toLocaleString('en-US')}`;
    function refresh() {
        if(!document.querySelector('.world-sidebar')) return;
        const player=ensure();
        document.getElementById('player-money').textContent=formatMoney(player.money);
        document.getElementById('player-health').textContent=`${player.health} / ${player.maxHealth}`;
        const bar=document.getElementById('player-health-bar');bar.max=player.maxHealth;bar.value=player.health;
    }
    return {ensure,spend,changeMoney,changeHealth,commit,refresh,formatMoney,startingMoney};
})();
$(document).on(':passagedisplay :playerchange :timechange',setup.playerState.refresh);
