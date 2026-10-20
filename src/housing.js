/* Lease records refer to unit IDs. Geometry stays outside save data. */
setup.housing = (() => {
    const rentPrice=600;
    const weekSeconds=7*24*60*60;
    const units=()=>Object.values(setup.worldMaps).flatMap(map=>map.units||[]);
    const listedIds=['1-2','1-3','2-3','3-1','3-4','4-4'];
    const listings=()=>units().filter(unit=>listedIds.includes(unit.id));
    const trayId='housing:key-tray';
    const keyId=id=>`apartment-key:${id}`;
    function issueKey(unitId) {
        const inventory=setup.inventory.ensure();
        if(Object.values(inventory.containers).some(items=>items.some(item=>item.id===keyId(unitId)))) return;
        inventory.containers[trayId]=[{id:keyId(unitId),type:'apartmentKey',x:0,y:0}];
    }
    function ensure() {
        const old=State.variables.housing;
        const rentedUnit=units().some(unit=>unit.id===old?.rentedUnit)?old.rentedUnit:null;
        State.variables.housing={version:3,rentedUnit,weeklyRent:rentPrice,
            nextRentAt:rentedUnit?(Number.isSafeInteger(old?.nextRentAt)&&old.nextRentAt>0?old.nextRentAt:setup.gameClock.now()+weekSeconds):null,
            arrears:rentedUnit&&Number.isSafeInteger(old?.arrears)&&old.arrears>=0?old.arrears:0,
            keyIssued:!!rentedUnit};
        if(rentedUnit&&!old?.keyIssued) {
            issueKey(rentedUnit);
            if(State.variables.openedObjects) delete State.variables.openedObjects[`apartment-${rentedUnit.split('-')[0]}:unit-door-${rentedUnit}`];
        }
        return State.variables.housing;
    }
    const canEnter=id=>setup.inventory.worn().some(container=>setup.inventory.placements(container).some(item=>item.type==='apartmentKey'&&setup.layoutMigration.unitId(item.id.replace(/^apartment-key:/,''))===id));
    function counter() {
        if(State.variables.world?.mapId!=='housing-office'||!setup.interactions.nearby().some(target=>target.object.role==='housing')) return null;
        ensure();return {id:trayId,name:'Receptionist key tray',columns:1,rows:1};
    }
    function rent(unitId) {
        if(State.variables.world?.mapId!=='housing-office' || !setup.interactions.nearby().some(target=>target.object.role==='housing'))
            return {ok:false,message:'Speak to the receptionist at the front desk to rent an apartment.'};
        const unit=units().find(unit=>unit.id===unitId),housing=ensure();
        if(!unit||!listedIds.includes(unitId)) return {ok:false,message:'This apartment is not listed. Choose one of the six available apartments.'};
        if(housing.rentedUnit) return {ok:false,message:'You already rent an apartment. No further payment was taken.'};
        if(!setup.playerState.spend(rentPrice)) return {ok:false,message:`You need ${setup.playerState.formatMoney(rentPrice)} to rent an apartment.`};
        housing.rentedUnit=unit.id;housing.nextRentAt=setup.gameClock.now()+weekSeconds;housing.keyIssued=true;
        issueKey(unit.id);
        setup.playerState.commit();refresh();
        return {ok:true,message:`You rent ${unit.name} for ${setup.playerState.formatMoney(rentPrice)} per week. The receptionist places its key on the tray. Move it into a pocket or bag before leaving.`};
    }
    function collectDue() {
        setup.selfStorage.collectDue();
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
    return {rentPrice,weekSeconds,units,listings,ensure,canEnter,rent,counter,trayId,collectDue,refresh};
})();
$(document).on(':passagedisplay :timechange',()=>{if(document.querySelector('.world-sidebar')) setup.housing.refresh();});
