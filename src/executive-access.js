/* Clearance is carried by an installed ID implant, not an inventory item. */
setup.corporateAccess=(()=>{
    function ensure() {
        const old=State.variables.corporateId;
        State.variables.corporateId={version:1,implant:'basic-id',clearances:Array.isArray(old?.clearances)?old.clearances.filter(value=>value==='executive-parking'):[],gateOpen:old?.gateOpen===true};
        return State.variables.corporateId;
    }
    const authorized=()=>ensure().clearances.includes('executive-parking');
    function toggleClearance() {
        const id=ensure();id.clearances=id.clearances.includes('executive-parking')?[]:['executive-parking'];
        State.create(State.passage);return authorized();
    }
    function gate(open) {
        if(open&&!authorized())return {ok:false,message:'Access denied. Your ID implant has no Executive Parking clearance.'};
        const world=State.variables.world;
        if(!open&&world.mapId==='f1'&&world.y===72&&world.x>=82&&world.x<=86)return {ok:false,message:'Step clear of the barrier before closing it.'};
        ensure().gateOpen=open;State.create(State.passage);Dialog.close();Engine.play('Apartments');
        return {ok:true,travelled:true,message:open?'Your implant is accepted. The parking barrier opens.':'The parking barrier closes.'};
    }
    const actions=()=>[
        {id:'scan-id',label:ensure().gateOpen?'Scan ID implant · Already open':'Scan ID implant',result:()=>gate(true)},
        ...(ensure().gateOpen?[{id:'close-gate',label:'Close gate',result:()=>gate(false)}]:[])
    ];
    return {ensure,authorized,toggleClearance,gate,actions};
})();
