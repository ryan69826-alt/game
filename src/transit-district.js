/* D1 roadside station and small shopping center. Shop interiors are service
   placeholders; inventories, prices and staffed services belong to later work. */
setup.transitDistrict=()=>{
    const width=90,height=90,inside=(x,y,r)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    const names=['Discount store','Food stall','Laundry','Barbershop','Electronic repair store'];
    const shops=names.map((name,i)=>({id:`d1-shop-${i+1}`,name,label:['DISCOUNT','FOOD','LAUNDRY','BARBER','REPAIRS'][i],x:5+i*17,y:i===1?16:12,width:12,height:i===1?6:10,door:{x:11+i*17,y:21},stall:i===1}));
    const parking={x:17,y:27,width:56,height:10};
    const driveway={x:43,y:26,width:5,height:18};
    const parkingBays=[27,35].flatMap(y=>Array.from({length:14},(_,i)=>({x:17+i*4,y,width:2,height:2,facing:y===27?'north':'south'}))).filter(bay=>bay.x+bay.width<=41||bay.x>=50);
    // Keep the existing eight car IDs and their saved inventories after resizing.
    const cars=parkingBays.filter((bay,i)=>i%3===0).map((bay,i)=>({...bay,color:['#7f939a','#9d8a78','#70867a'][i%3]}));
    const train={id:'d1-train',kind:'train',stationId:'d1',name:'Station train',x:32,y:70,width:26,height:4,
        description:'A stationary electric train waits beside the platform. Tracks disappear into tunnels at both ends.',
        actions:[{id:'board',label:'Board train',result:()=>({transit:true})}]};
    const rail={x:5,y:70,width:80,height:5},platform={x:16,y:61,width:58,height:9},benches=[{x:20,y:64,width:4,height:1,label:'Platform bench',style:'seat'},{x:65,y:64,width:4,height:1,label:'Platform bench',style:'seat'}];
    const interactables=[train,...shops.map(shop=>shop.stall?{id:shop.id,kind:'kiosk',name:shop.name,...shop.door,description:'A small food counter faces the shopping walkway.',actions:[{id:'inspect',label:'Inspect',result:'A food stall with a serving counter. Food purchases will be added later.'}]}:{id:shop.id,kind:'door',name:`${shop.name} entrance`,...shop.door,lockId:`${shop.id}:front`,lockLevel:1,destination:{mapId:shop.id,x:5,y:7},description:`The entrance to the ${shop.name.toLowerCase()}.`}),
        ...cars.map((car,i)=>({...car,id:`d1-car-${i+1}`,kind:'car',name:`Shopping center car ${i+1}`,lockLevel:3,trunkLockLevel:2,description:'Parked nose-in beside the shopping center.'}))];
    function tileAt(x,y) {
        const tile=(kind,label,walkable=true)=>({kind,label,walkable});
        if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)return tile('boundary','Edge of the area',false);
        for(const shop of shops){if(x===shop.door.x&&y===shop.door.y)return tile(shop.stall?'kiosk':'entrance',`${shop.name} entrance`,!shop.stall);if(inside(x,y,shop))return tile('building',shop.name,false);}
        if(cars.some(car=>inside(x,y,car)))return tile('car','Parked car',false);
        if(benches.some(bench=>inside(x,y,bench)))return tile('furniture','Platform bench',false);
        if(inside(x,y,train))return tile('train','Station train',false);
        if(x>=3&&x<=11&&y>=68&&y<=76||x>=78&&x<=86&&y>=68&&y<=76)return tile('tunnel','Rail tunnel',false);
        if(inside(x,y,rail))return tile('track','Underground rail approach',false);
        if(inside(x,y,platform))return tile('platform','Station platform');
        if(inside(x,y,driveway))return tile('road','Shopping center driveway');
        if(y>=44&&y<=48)return tile('road','Transit district road');
        if(y===43||y===49)return tile('pavement','Roadside sidewalk');
        if(y>=22&&y<=25&&x>=5&&x<=85)return tile('path','Shopping center walkway');
        if((x>=15&&x<=16||x>=73&&x<=74)&&y>=26&&y<=42)return tile('pavement','Shopping center sidewalk');
        if(x>=43&&x<=47&&y>=50&&y<=60)return tile('path','Pedestrian station approach');
        if(inside(x,y,parking))return tile('parking','Shopping center parking lot');
        return tile('ground','Transit district grounds');
    }
    setup.worldMaps.d1={id:'d1',worldArea:'d1',name:'Transit & Shops',width,height,spawn:{x:0,y:46},shops,buildings:shops,parking,parkingBays,cars,interactables,furniture:benches,rail,platform,train,tunnels:[{x:3,y:68,width:9,height:9},{x:78,y:68,width:9,height:9}],trees:[],driveway,
        station:{id:'d1',arrival:{x:45,y:69}},roads:{horizontal:{y:44,height:5},vertical:{x:43,width:5}},exits:{west:{mapId:'apartments',offset:0}},
        eyebrow:'TRANSIT · LOCAL SHOPS',subtitle:'A roadside station and neighborhood shopping center.',
        description:'Five shops and their parking lot sit north of the road: a discount store, food stall, laundry, barbershop and electronic repair store. South of the road, a platform serves a waiting train. Tracks disappear underground toward B6, H4 and F3. The road leads west to Apartments.',
        labels:[{x:45,y:63,text:'TRANSIT PLATFORM'},{x:29,y:32,text:'PARKING'},{x:61,y:32,text:'PARKING'},{x:7,y:67,text:'TUNNEL'},{x:82,y:67,text:'TUNNEL'}],
        ambientSounds:[{bounds:{x:16,y:60,width:58,height:16},text:'The waiting train’s ventilation gives off a low electrical hum.'}],
        legend:[['Platform','#a4a18b'],['Track','#29353d'],['Train','#779aa3'],['Parking','#47525a']],tileAt};
    for(const shop of shops.filter(shop=>!shop.stall)) {
        const furniture=[{x:1,y:3,width:3,height:1,label:shop.name==='Barbershop'?'Barber chair':'Service counter',style:shop.name==='Barbershop'?'seat':'desk'},{x:8,y:2,width:1,height:3,label:shop.name==='Laundry'?'Washers':'Shelves',style:'cabinet'}];
        const service={id:`${shop.id}:service`,kind:'kiosk',name:`${shop.name} service counter`,x:2,y:3,description:`The ${shop.name.toLowerCase()} service area.`,actions:[{id:'inspect',label:'Inspect',result:'The shop layout is open to explore. Services will be added later.'}]};
        setup.worldMaps[shop.id]={id:shop.id,worldArea:'d1',name:shop.name,width:11,height:10,spawn:{x:5,y:7},interior:true,eyebrow:'SHOPPING CENTER',subtitle:'Local shop',
            buildings:[],cars:[],parkingBays:[],furniture,ambientSound:'Ceiling lights hum over the quiet shop.',description:`A compact ${shop.name.toLowerCase()} with basic fittings and a service area.`,
            interactables:[service,{id:`${shop.id}:exit`,kind:'door',name:'Exit to shopping center',x:5,y:9,exit:true,lockId:`${shop.id}:front`,lockLevel:1,destination:{mapId:'d1',x:shop.door.x,y:22},description:'The door opens onto the shopping walkway.'}],
            tileAt(x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=11||y>=10)return {kind:'boundary',label:'Edge of shop',walkable:false};if(x===5&&y===9)return {kind:'entrance',label:'Shop exit',walkable:true};if(x===0||y===0||x===10||y===9)return {kind:'wall',label:'Shop wall',walkable:false};const item=furniture.find(item=>inside(x,y,item));return item?{kind:'furniture',label:item.label,walkable:false}:{kind:'floor',label:shop.name,walkable:true};}};
    }
    setup.worldMaps.apartments.exits.east={mapId:'d1',offset:0};
};
