/* Stations become destinations when their map/arrival platform is registered.
   Train travel is an interaction: no timetable, fare or elapsed time. */
setup.transit=(()=>{
    const stations=[{id:'d1',name:'D1 · Transit & Shops'},{id:'b6',name:'B6 · Transit Area'},{id:'h4',name:'H4 · Transit Area'},{id:'f3',name:'F3 · Central Transit Hub'}];
    const station=id=>stations.find(station=>station.id===id);
    const available=id=>{const map=setup.worldMaps[id],arrival=map?.station?.arrival;return !!station(id)&&!!arrival&&map.tileAt(arrival.x,arrival.y).walkable;};
    function current() {
        const map=setup.worldMaps[State.variables.world?.mapId];return station(map?.station?.id);
    }
    function reachable() {
        const here=current();return !!here&&setup.interactions.nearby().some(target=>target.object.kind==='train'&&target.object.stationId===here.id);
    }
    function ride(id) {
        const here=current();
        if(!here||!reachable())return {ok:false,message:'Approach the train on its platform first.'};
        if(id===here.id||!available(id))return {ok:false,message:'That station is not available.'};
        const arrival=setup.worldMaps[id].station.arrival;
        return {ok:true,...setup.worldTravel.enter({destination:{mapId:id,...arrival}})};
    }
    return {stations,station,available,current,reachable,ride};
})();
setup.transitUI=(()=>{
    function open() {
        if(!setup.transit.reachable())return;
        Dialog.setup('Train destinations','character-window transit-window');
        const root=Dialog.body(),here=setup.transit.current();root.replaceChildren();
        const title=document.createElement('h2');title.textContent=here.name;
        const help=document.createElement('p');help.className='world-note';help.textContent='The train is ready to board. Choose a destination; no timetable or fare applies.';
        const choices=document.createElement('div');choices.className='interaction-actions';
        const status=document.createElement('p');status.setAttribute('role','status');
        for(const station of setup.transit.stations.filter(station=>station.id!==here.id)) {
            const button=document.createElement('button');button.type='button';button.disabled=!setup.transit.available(station.id);
            button.textContent=station.name+(button.disabled?' · Not open yet':'');
            button.addEventListener('click',()=>{const result=setup.transit.ride(station.id);if(!result.ok)status.textContent=result.message;});choices.append(button);
        }
        root.append(title,help,choices,status);Dialog.open();
    }
    return {open};
})();
