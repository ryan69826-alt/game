/* Physical external storage shares the same packing and reach checks as trunks. */
setup.selfStorage=(()=>{
    const price=200,weekSeconds=7*24*60*60;
    function ensure() {
        const previous=State.variables.selfStorage;
        const ids=setup.worldMaps.b1.storageUnits.filter(unit=>unit.available).map(unit=>unit.id);
        const owned=[...new Set(Array.isArray(previous?.owned)?previous.owned.filter(id=>ids.includes(id)):[])];
        const leases=Object.fromEntries(owned.map(id=>{const lease=previous?.leases?.[id];return [id,{nextRentAt:Number.isSafeInteger(lease?.nextRentAt)&&lease.nextRentAt>0?lease.nextRentAt:setup.gameClock.now()+weekSeconds,arrears:Number.isSafeInteger(lease?.arrears)&&lease.arrears>=0?lease.arrears:0}];}));
        State.variables.selfStorage={version:1,owned,leases};
        return State.variables.selfStorage;
    }
    const owned=id=>ensure().owned.includes(id);
    function summary(id) {const lease=ensure().leases[id];return lease?`Rented by you for $${price} / week. Next payment: ${setup.gameClock.formatStamp(lease.nextRentAt)}.${lease.arrears?` Outstanding: $${lease.arrears}.`:''} Your items remain here when you leave.`:'';}
    function near(objectId) {
        return State.variables.world?.mapId==='b1'&&setup.interactions.nearby().some(target=>target.object.id===objectId);
    }
    function buy(id) {
        if(!near('storage-kiosk')) return {ok:false,message:'Use the front-office kiosk to rent storage.'};
        const unit=setup.worldMaps.b1.storageUnits.find(unit=>unit.id===id&&unit.available);
        if(!unit||owned(id)) return {ok:false,message:'That unit is not available to rent.'};
        const player=setup.playerState.ensure();
        if(player.money<price) return {ok:false,message:'You do not have enough money.'};
        player.money-=price;const state=ensure();state.owned.push(id);state.leases[id]={nextRentAt:setup.gameClock.now()+weekSeconds,arrears:0};setup.playerState.commit();
        return {ok:true,refreshActions:true,message:`Storage unit ${id} is now rented for $${price} per week. The first week is paid. Approach its shutter to store or collect items.`};
    }
    function container(id) {
        if(!owned(id)||!near(`storage-unit-${id}`)) return null;
        return {id:`storage:b1:${id}`,name:`Storage unit ${id}`,columns:8,rows:6};
    }
    function collectDue() {
        const state=ensure(),now=setup.gameClock.now(),player=setup.playerState.ensure();
        for(const lease of Object.values(state.leases)) {
            if(now>=lease.nextRentAt) {const weeks=Math.floor((now-lease.nextRentAt)/weekSeconds)+1;lease.arrears=Math.min(Number.MAX_SAFE_INTEGER,lease.arrears+weeks*price);lease.nextRentAt+=weeks*weekSeconds;}
            const payments=Math.min(Math.floor(lease.arrears/price),Math.floor(player.money/price));
            player.money-=payments*price;lease.arrears-=payments*price;
        }
    }
    return {price,weekSeconds,ensure,owned,summary,buy,container,collectDue};
})();
