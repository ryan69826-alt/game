/* A1 extends the same road as B1/C1, with parallel curb parking and small lots. */
setup.neighborhoodDistrict=()=>{
    const width=100,height=90,inside=(x,y,r)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    const buildings=[...[6,25,44,63,82].map(x=>({x,y:26,facing:'south'})),...[14,36,58,80].map(x=>({x,y:57,facing:'north'}))]
        .map((building,i)=>({...building,number:i+1,name:`House ${i+1}`,label:`H${i+1}`,width:12,height:12,
            door:{x:building.x+6,y:building.facing==='south'?37:57}}));
    const interiors=buildings.map(building=>setup.houseInteriors.create(building));
    const culDeSac={x:10,y:46,radius:7,curbRadius:8.5,neckX:10,parkingStartX:20};
    const originalBays=[42,49].flatMap(y=>[4,14,24,34,44,54,64,74,84,94].map(x=>({x,y,width:4,height:2,facing:y===42?'north':'south',parallel:true})));
    const parkingBays=originalBays.filter(bay=>bay.x>=culDeSac.parkingStartX);
    const occupied=new Set();
    // Retain car identities and inventories when an old bay is replaced by the bulb.
    const cars=originalBays.filter((bay,i)=>i%3===0).map((oldBay,i)=>{
        const bay=parkingBays.find(b=>b.x===oldBay.x&&b.y===oldBay.y&&!occupied.has(`${b.x}:${b.y}`))||parkingBays.find(b=>!occupied.has(`${b.x}:${b.y}`));
        occupied.add(`${bay.x}:${bay.y}`);
        return {x:bay.x+1,y:bay.y,width:2,height:2,facing:bay.y===42?'west':'east',color:['#77868e','#8e8978','#6d827a'][i%3]};
    });
    const trees=buildings.map(building=>[building.x-2,building.y+4]);
    const interactables=[...buildings.map((building,i)=>({id:`house-${building.number}-front`,kind:'door',name:`${building.name} front door`,...building.door,
        lockId:`a1-house-${building.number}:front`,lockLevel:2,destination:{mapId:interiors[i].id,...interiors[i].spawn},description:'A weathered front door leads into a small single-floor house.'})),
        ...cars.map((car,i)=>({...car,id:`a1-car-${i+1}`,kind:'car',name:`Neighborhood car ${i+1}`,lockId:`vehicle:a1:a1-car-${i+1}`,lockLevel:3,trunkLockLevel:2,description:`Parallel parked facing ${car.facing}, with its long axis along the road.`}))];
    function tileAt(x,y) {
        const tile=(kind,label,walkable=true)=>({kind,label,walkable});
        if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height) return tile('boundary','Edge of the area',false);
        for(const building of buildings) {if(x===building.door.x&&y===building.door.y)return tile('entrance',`${building.name} entrance`);if(inside(x,y,building))return tile('building',building.name,false);}
        if(cars.some(car=>inside(x,y,car))) return tile('car','Parallel parked car',false);
        if(trees.some(([tx,ty])=>tx===x&&ty===y)) return tile('tree','Yard tree',false);
        const distance=Math.hypot(x-culDeSac.x,y-culDeSac.y);
        if(distance<=culDeSac.radius)return tile('road','Cul-de-sac turning area');
        if(x>=culDeSac.neckX&&y>=44&&y<=48)return tile('road','Neighborhood road');
        if(x>=culDeSac.neckX&&(y>=42&&y<=43||y>=49&&y<=50))return tile(x<culDeSac.parkingStartX?'road':'parking',x<culDeSac.parkingStartX?'Cul-de-sac approach':'Parallel parking lane');
        if(distance<=culDeSac.curbRadius)return tile('pavement','Cul-de-sac sidewalk');
        if(x>=16&&(y===41||y===51))return tile('pavement','Neighborhood sidewalk');
        if(buildings.some(building=>x===building.door.x&&(building.facing==='south'?y>=38&&y<=40:y>=52&&y<=56)))return tile('path','House front path');
        return tile('ground','Small residential yard');
    }
    setup.worldMaps.a1={id:'a1',worldArea:'a1',name:'Low Density Housing',width,height,spawn:{x:99,y:46},buildings,interactables,trees,cars,parkingBays,
        culDeSac,roads:{horizontal:{y:44,height:5,markingsStartX:20},vertical:{x:-10,width:0}},exits:{east:{mapId:'b1',offset:0}},
        eyebrow:'LOW END · LOW DENSITY HOUSING',subtitle:'Small homes along a worn residential street.',
        description:'Nine modest single-floor houses line the road: five on its north side and four on its south side. Short paths cross small yards to the sidewalks. Parallel parking lanes widen the street at both curbs. Each house has a bedroom, side room, combined living/dining room and bathroom. The road ends in a cul-de-sac to the west and continues east to Warehouse / Storage.',
        treeSounds:'A breeze stirs the leaves of the nearby yard trees.',legend:[['Entrance','#dfb777'],['Curb parking','#47525a'],['Yard','#293e35']],tileAt};
    for(const map of interiors) setup.worldMaps[map.id]=map;
    setup.worldMaps.b1.exits.west={mapId:'a1',offset:0};
};
