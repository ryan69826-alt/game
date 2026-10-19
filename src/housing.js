/* Lease records refer to unit IDs. Geometry stays outside save data. */
setup.housing = (() => {
    const rentPrice=600;
    const weekSeconds=7*24*60*60;
    const units=()=>Object.values(setup.worldMaps).flatMap(map=>map.units||[]);
    function ensure() {
        const old=State.variables.housing;
        const rentedUnit=units().some(unit=>unit.id===old?.rentedUnit)?old.rentedUnit:null;
        State.variables.housing={version:2,rentedUnit,weeklyRent:rentPrice,
            nextRentAt:rentedUnit?(Number.isSafeInteger(old?.nextRentAt)&&old.nextRentAt>0?old.nextRentAt:setup.gameClock.now()+weekSeconds):null,
            arrears:rentedUnit&&Number.isSafeInteger(old?.arrears)&&old.arrears>=0?old.arrears:0};
        return State.variables.housing;
    }
    const canEnter=id=>ensure().rentedUnit===id;
    function rent(unitId) {
        if(State.variables.world?.mapId!=='housing-office' || !setup.interactions.nearby().some(target=>target.object.role==='housing'))
            return {ok:false,message:'Speak to the receptionist at the front desk to rent an apartment.'};
        const unit=units().find(unit=>unit.id===unitId),housing=ensure();
        if(!unit) return {ok:false,message:'Choose an available apartment.'};
        if(housing.rentedUnit) return {ok:false,message:'You already rent an apartment. No further payment was taken.'};
        if(!setup.playerState.spend(rentPrice)) return {ok:false,message:`You need ${setup.playerState.formatMoney(rentPrice)} to rent an apartment.`};
        housing.rentedUnit=unit.id;housing.nextRentAt=setup.gameClock.now()+weekSeconds;
        setup.playerState.commit();refresh();
        return {ok:true,message:`You rent ${unit.name} for ${setup.playerState.formatMoney(rentPrice)} per week. The first week is paid and its door is now unlocked.`};
    }
    function collectDue() {
        const housing=ensure();if(!housing.rentedUnit) return;
        const now=setup.gameClock.now();
        if(now>=housing.nextRentAt) {
            const weeks=Math.floor((now-housing.nextRentAt)/weekSeconds)+1;
            housing.arrears=Math.min(Number.MAX_SAFE_INTEGER,housing.arrears+weeks*rentPrice);
            housing.nextRentAt+=weeks*weekSeconds;
        }
        const player=setup.playerState.ensure();
        const payments=Math.min(Math.floor(housing.arrears/rentPrice),Math.floor(player.money/rentPrice));
        player.money-=payments*rentPrice;housing.arrears-=payments*rentPrice;
        // The movement caller commits the clock, bill and balance together.
    }
    function refresh() {
        const summary=document.getElementById('housing-summary');if(!summary) return;
        const housing=ensure(),rented=units().find(unit=>unit.id===housing.rentedUnit);
        summary.textContent=rented?`Your home: ${rented.name}. Rent: ${setup.playerState.formatMoney(rentPrice)} / week. Next payment: ${setup.gameClock.formatStamp(housing.nextRentAt)}.${housing.arrears?` Outstanding rent: ${setup.playerState.formatMoney(housing.arrears)}.`:''}`:'No apartment rented. Visit the housing office beside Apartment 3.';
    }
    return {rentPrice,weekSeconds,units,ensure,canEnter,rent,collectDue,refresh};
})();
$(document).on(':passagedisplay :timechange',()=>{if(document.querySelector('.world-sidebar')) setup.housing.refresh();});
