/* Visible cabin contents are rolled once per car, separately from trunk loot. */
setup.vehicleContents = (() => {
    function roll(draw=random) {
        return {money:draw(1,100)<=15?draw(1,120):0};
    }
    function inspect(object) {
        const id=`${State.variables.world.mapId}:${object.id}`,old=State.variables.vehicleContents;
        let contents=old?.[id];
        if(!Number.isInteger(contents?.money)||contents.money<0||contents.money>120) {
            contents=roll();
            State.variables.vehicleContents={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),[id]:contents};
            State.create(State.passage);
        }
        return {ok:true,visibleMoney:contents.money,message:contents.money?
            `No one is inside. Through the window, you see ${setup.playerState.formatMoney(contents.money)} lying on a seat.`:
            'No one is inside. You can see the seats and footwells, but no money is visible.'};
    }
    return {roll,inspect};
})();
