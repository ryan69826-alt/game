/* B1 has independent outdoor geometry; sealed units expose inventory, not interiors. */
setup.storageDistrict = () => {
    const width=70,height=50;
    const units=Array.from({length:10},(_,i)=>({id:String(i+1),number:i+1,name:`Storage unit ${i+1}`,
        x:9+(i%5)*8,y:i<5?25:35,width:5,height:6,
        door:{x:11+(i%5)*8,y:i<5?30:35},available:[2,6,9].includes(i+1)}));
    const buildings=[
        {x:6,y:5,width:18,height:13,label:'WAREHOUSE 1'},
        {x:28,y:5,width:18,height:13,label:'WAREHOUSE 2'},
        {x:51,y:6,width:13,height:12,label:'MECHANIC'},
        ...units.map(unit=>({...unit,label:String(unit.number)}))
    ];
    const kiosk={id:'storage-kiosk',kind:'kiosk',name:'Self-storage kiosk',x:57,y:36,
        description:'An automated terminal handles storage rentals at $200 per week per unit, with the first week paid now. Later payments are collected every seven in-game days; unpaid rent remains outstanding. Three of the ten units are available. Rentals grant personal access; the reinforced shutters cannot be lockpicked.',
        actions:[2,6,9].map(number=>({id:`buy-${number}`,label:`Rent unit ${number} · $200 / week`,
            enabled:()=>!setup.selfStorage.owned(String(number)),result:()=>setup.selfStorage.buy(String(number))}))};
    const interactables=[kiosk,...units.map(unit=>({id:`storage-unit-${unit.id}`,kind:'storage-unit',name:unit.name,...unit.door,
        storageId:unit.id,description:unit.available?'Available through the kiosk. Reinforced shutters require a specialized tool to breach; lockpicking will not work.':'Already in use. Reinforced shutters require a specialized tool to breach; lockpicking will not work.',
        actions:[{id:'inspect',label:'Inspect',result:()=>setup.selfStorage.owned(unit.id)?setup.selfStorage.summary(unit.id):unit.available?'Rent this unit at the front-office kiosk.':'This unit is already in use and is unavailable.'},
            {id:'storage',label:'Open storage',enabled:()=>setup.selfStorage.owned(unit.id),result:()=>({externalId:`storage:${unit.id}`,message:'You access your storage unit.'})}]})),
        ...[15,37].map((x,i)=>({id:`warehouse-${i+1}`,kind:'facility',name:`Warehouse ${i+1} entrance`,x,y:17,
            description:'A sealed warehouse loading door. Access is not available yet.',actions:[{id:'inspect',label:'Inspect',result:'The warehouse is secured. You cannot enter it yet.'}]})),
        {id:'mechanic-shop',kind:'facility',name:'Mechanic shop service terminal',x:57,y:17,
            description:'A vehicle service bay with an inactive repair terminal.',actions:[{id:'inspect',label:'Inspect',result:'Vehicle repairs will be available here later. No repairs or charges are made.'}]}];
    const inside=(x,y,r)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    function tileAt(x,y) {
        const tile=(kind,label,walkable=true)=>({kind,label,walkable});
        if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height) return tile('boundary','Edge of the area',false);
        if((x===7||x===50)&&y>=23&&y<=41||y===23&&x>=7&&x<=50) return tile('fence','Self-storage perimeter fence',false);
        for(const unit of units) {
            if(x===unit.door.x&&y===unit.door.y) return tile('shutter',`${unit.name} reinforced shutter`,false);
            if(inside(x,y,unit)) return tile('building',unit.name,false);
        }
        const facility=interactables.find(object=>object.kind==='facility'&&object.x===x&&object.y===y);
        if(facility) return tile('shutter',facility.name,false);
        for(const building of buildings.slice(0,3)) if(inside(x,y,building)) return tile('building',building.label,false);
        if(x===57&&y===36) return tile('kiosk','Self-storage kiosk',false);
        if(inside(x,y,{x:53,y:30,width:9,height:9})) {
            if((x===53||x===61||y===30||y===38)&&!(x===57&&y===38)) return tile('wall','Storage front office wall',false);
            return tile('floor','Automated storage office');
        }
        if(y>=44&&y<=48) return tile('road','Storage district road');
        if(y===43||y===49) return tile('pavement','Roadside pavement');
        if(x>=8&&x<=49&&y>=24&&y<=42) return tile('path','Self-storage courtyard');
        if(y>=18&&y<=22||x>=51&&x<=63&&y>=23&&y<=42) return tile('parking','Warehouse service yard');
        return tile('ground','Storage district grounds');
    }
    setup.worldMaps.b1={id:'b1',worldArea:'b1',name:'Warehouse / Storage',width,height,spawn:{x:69,y:46},
        subtitle:'Secured space on the industrial fringe.',
        description:'Two sealed warehouses and a mechanic shop stand north of a small self-storage compound. Ten reinforced units face a shared courtyard. A fence encloses the back and sides; the southern frontage is open. An automated kiosk in the front office rents the three available units for $200 per week each. The road leads east to Apartments.',
        eyebrow:'URBAN AREA · STORAGE',legend:[['Shutter','#9e9ca4'],['Fence','#87969a'],['Kiosk','#72c4c4']],labels:[{x:57.5,y:32,text:'OFFICE'}],buildings,storageUnits:units,interactables,trees:[],cars:[],parkingBays:[],
        roads:{horizontal:{y:44,height:5},vertical:{x:-10,width:0}},tileAt};
    setup.worldMaps.apartments.worldArea='apartments';
    setup.worldMaps.apartments.exits={west:'b1'};
    setup.worldMaps.b1.exits={east:'apartments'};
};
