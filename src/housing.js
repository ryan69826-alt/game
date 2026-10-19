/* Lease records refer to unit IDs. Geometry stays outside save data. */
setup.housing = (() => {
    const rentPrice=600;
    const units=()=>Object.values(setup.worldMaps).flatMap(map=>map.units||[]);
    function ensure() {
        const old=State.variables.housing;
        const rentedUnit=units().some(unit=>unit.id===old?.rentedUnit)?old.rentedUnit:null;
        State.variables.housing={version:1,rentedUnit,monthlyRent:rentPrice,monthsPaid:rentedUnit?1:0};
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
        housing.rentedUnit=unit.id;housing.monthsPaid=1;
        setup.playerState.commit();refresh();
        return {ok:true,message:`You rent ${unit.name} for ${setup.playerState.formatMoney(rentPrice)} per month. The first month is paid and its door is now unlocked.`};
    }
    function refresh() {
        const summary=document.getElementById('housing-summary');if(!summary) return;
        const rented=units().find(unit=>unit.id===ensure().rentedUnit);
        summary.textContent=rented?`Your home: ${rented.name}. Rent: ${setup.playerState.formatMoney(rentPrice)} / month · First month paid.`:'No apartment rented. Visit the housing office beside Apartment 3.';
    }
    return {rentPrice,units,ensure,canEnter,rent,refresh};
})();
$(document).on(':passagedisplay',()=>{if(document.querySelector('.world-sidebar')) setup.housing.refresh();});
