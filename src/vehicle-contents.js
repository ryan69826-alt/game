/* Cabin cash is rolled once and claimed atomically; trunk loot stays separate. */
setup.vehicleContents = (() => {
    function roll(draw=random) {return {money:draw(1,100)<=15?draw(1,120):0};}
    const key=object=>`${State.variables.world.mapId}:${object.id}`;
    function valid(contents) {return Number.isInteger(contents?.money)&&contents.money>=0&&contents.money<=120;}
    function ensure(object) {
        const id=key(object),old=State.variables.vehicleContents;
        if(!valid(old?.[id])) State.variables.vehicleContents={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[id]:roll()};
        return State.variables.vehicleContents[id];
    }
    function inspect(object) {
        const missing=!valid(State.variables.vehicleContents?.[key(object)]),contents=ensure(object);
        if(missing) State.create(State.passage);
        return {ok:true,visibleMoney:contents.money,message:contents.money?
            `No one is inside. Through the window, you see ${setup.playerState.formatMoney(contents.money)} lying on a seat.`:
            'No one is inside. You can see the seats and footwells, but no money is visible.'};
    }
    function take(objectId) {
        const cabin=setup.vehicleCabin.current();
        if(!cabin||cabin.car.id!==objectId) return {ok:false,message:'Get inside that vehicle before taking its cash.'};
        const contents=ensure(cabin.car),amount=contents.money,player=setup.playerState.ensure();
        if(!amount) return {ok:false,message:'There is no cash left in the cabin.'};
        if(!Number.isSafeInteger(player.money+amount)) return {ok:false,message:'You cannot carry any more money.'};
        contents.money=0;player.money+=amount;setup.playerState.commit();
        $(document).trigger(':vehiclechange');
        return {ok:true,vehicleChanged:true,amount,message:`You take ${setup.playerState.formatMoney(amount)} from the seat.`};
    }
    return {roll,ensure,inspect,take};
})();
