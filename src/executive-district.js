/* F1: public corporate campus and an ID-controlled parking enclosure.
   Every tower floor uses its building footprint; jobs and appointments come later. */
setup.executiveDistrict=()=>{
    const inside=(x,y,r)=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height;
    const tile=(kind,label,walkable=true)=>({kind,label,walkable});
    const buildings=[
        {id:'f1-tower-1',name:'Meridian Tower',label:'MERIDIAN · 12F',x:10,y:10,width:20,height:24,floors:12},
        {id:'f1-tower-2',name:'Crown Tower',label:'CROWN · 16F',x:42,y:6,width:22,height:28,floors:16},
        {id:'f1-tower-3',name:'Apex Tower',label:'APEX · 12F',x:78,y:10,width:20,height:24,floors:12},
        {id:'f1-restaurant',name:'Skyline Restaurant',label:'SKYLINE DINING',x:13,y:40,width:25,height:14,style:'restaurant'},
        {id:'f1-clinic',name:'Corporate Clinic',label:'CORPORATE CLINIC',x:82,y:41,width:16,height:13,style:'clinic'},
        {id:'f1-security',name:'Security Office',label:'SECURITY',x:44,y:74,width:12,height:12,style:'security',facing:'north'}
    ].map(building=>{const facing=building.facing||'south',door={x:building.x+Math.floor(building.width/2),y:facing==='south'?building.y+building.height-1:building.y};return {...building,facing,door,accent:'#bed6de',approach:{x:door.x,y:door.y+(facing==='south'?1:-1)}};});
    const parking={x:63,y:73,width:43,height:21},gate={id:'f1-parking-gate',kind:'access-gate',name:'Executive parking gate',x:82,y:72,width:5,height:1,
        description:'A reinforced barrier and perimeter fence secure the parking lot. The scanner checks Executive Parking clearance on an installed ID implant.'};
    Object.defineProperty(gate,'actions',{get:()=>setup.corporateAccess.actions()});
    const parkingBays=[75,91].flatMap(y=>[65,69,73,77,89,93,97,101].map(x=>({x,y,width:2,height:2,facing:y===75?'north':'south'})));
    const cars=parkingBays.filter((_,i)=>i%2===0).map((bay,i)=>({...bay,color:['#a8bcc5','#292f3c','#d4d5c8'][i%3]}));
    const trees=[[8,37],[40,37],[73,37],[102,37],[10,57],[39,57],[77,57],[102,57]];
    const interactables=[gate,...buildings.map(building=>({id:`${building.id}:entrance`,name:`${building.name} entrance`,kind:'door',...building.door,lockId:`${building.id}:front`,lockLevel:1,
        destination:{mapId:building.floors?`${building.id}-floor-1`:building.id,x:Math.floor(Math.ceil(building.width*1.5)/2),y:building.facing==='north'?2:Math.ceil(building.height*1.5)-3},description:'A polished entrance opens into the corporate campus building.'})),
        ...cars.map((car,i)=>({...car,id:`f1-car-${i+1}`,name:`Executive vehicle ${i+1}`,kind:'car',lockLevel:3,trunkLockLevel:2,description:'A well-maintained vehicle in the secured executive parking lot.'}))];
    setup.worldMaps.f1={id:'f1',worldArea:'f1',name:'Executive Offices',width:120,height:100,spawn:{x:0,y:62},buildings,parking,parkingBays,cars,trees,gate,interactables,
        roads:{horizontal:{y:60,height:5},vertical:{x:-10,width:0}},exits:{west:{mapId:'e1',offset:0}},
        eyebrow:'CORPORATE CAMPUS · EXECUTIVE DISTRICT',subtitle:'Glass towers, pale stone and carefully tended greenery.',
        description:'Three corporate towers house senior management and executive suites. Broad promenades link their lobbies to Skyline Restaurant and the corporate clinic. Across the boulevard, a security office watches an enclosed parking lot whose gate requires corporate clearance on your ID implant.',
        colors:{ground:'#536c60',pavement:'#b2bdb8',path:'#d0d6cd',building:'#6c8998',park:'#71917b',fence:'#a7bdc5',parking:'#53616c'},treeSounds:'Air stirs the clipped trees along the corporate promenade.',
        labels:[{x:84,y:86,text:'SECURE PARKING'},{x:63,y:55,text:'EXECUTIVE PROMENADE'}],legend:[['Tower','#6c8998'],['Promenade','#d0d6cd'],['Gate','#c7af73'],['Parking','#53616c']],
        tileAt(x,y){
            if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=120||y>=100)return tile('boundary','Edge of Executive Offices',false);
            if(inside(x,y,gate))return tile(setup.corporateAccess.ensure().gateOpen?'path':'gate','ID-controlled parking barrier',setup.corporateAccess.ensure().gateOpen);
            if((y===72||y===94)&&x>=62&&x<=106||(x===62||x===106)&&y>=72&&y<=94)return tile('fence','Secure parking perimeter',false);
            for(const building of buildings){if(x===building.door.x&&y===building.door.y)return tile('entrance',building.name+' entrance');if(inside(x,y,building))return tile('building',building.name,false);}
            if(cars.some(car=>inside(x,y,car)))return tile('car','Executive vehicle',false);
            if(trees.some(([tx,ty])=>tx===x&&ty===y))return tile('tree','Manicured tree',false);
            if(y>=60&&y<=64)return tile('road','Executive boulevard');
            if(inside(x,y,parking))return tile('parking','Secure executive parking');
            if(x>=82&&x<=86&&y>=66&&y<72)return tile('road','Secure parking driveway');
            if(y===59||y===65)return tile('pavement','Boulevard sidewalk');
            if(y>=34&&y<=39&&x>=8&&x<=102||x>=50&&x<=55&&y>=34&&y<=59||y>=54&&y<=58&&x>=10&&x<=102||x>=75&&x<=77&&y>=34&&y<=58||x>=49&&x<=51&&y>=66&&y<=73)return tile('path','Executive promenade');
            return tile('ground','Landscaped corporate grounds');
        }};
    for(const building of buildings) {
        const floors=building.floors||1;
        for(let floor=1;floor<=floors;floor++) {
            const id=building.floors?`${building.id}-floor-${floor}`:building.id,w=Math.ceil(building.width*1.5),h=Math.ceil(building.height*1.5),north=building.facing==='north';
            const spawn={x:Math.floor(w/2),y:north?2:h-3};
            const furniture=[],objects=[];
            const add=(x,y,width,height,label,style)=>furniture.push({x,y,width,height,label,style});
            const role=building.floors?(floor===1?'Reception lobby':floor===floors?'Executive suites':floor%4===0?'Boardrooms':'Leadership offices'):building.style;
            if(building.floors) {
                add(8,6,6,1,floor===1?'Reception desk':'Executive desk','desk');
                add(8,12,4,2,'Conference table','table');add(w-7,6,3,1,'Lounge seating','seat');add(w-7,12,2,1,'Document cabinet','cabinet');
                const lift={id:`${id}:lift`,name:'Tower elevator',kind:'elevator',x:2,y:3,width:2,height:2,description:`${building.name} · Floor ${floor} of ${floors}. Select a floor.`,actions:[]};
                for(let destination=1;destination<=floors;destination++)lift.actions.push({id:`floor-${destination}`,label:`Floor ${destination}${destination===1?' · Lobby':destination===floors?' · Executive suites':''}`,enabled:()=>destination!==floor,result:()=>setup.worldTravel.enter({destination:{mapId:`${building.id}-floor-${destination}`,x:3,y:5}})});
                objects.push(lift);
            } else if(building.style==='restaurant') {
                add(5,4,9,1,'Dining reception','desk');for(const x of [6,16,26])for(const y of [9,14])add(x,y,3,2,'Dining table','table');add(w-5,3,2,6,'Service counter','kitchen');
            } else if(building.style==='clinic') {
                add(6,4,7,1,'Clinic reception','desk');add(4,9,4,1,'Waiting seats','seat');add(w-6,8,2,3,'Examination couch','seat');add(w-5,3,2,2,'Medical cabinet','cabinet');
            } else {add(5,4,5,1,'Security desk','desk');add(3,9,4,1,'Monitoring console','cabinet');add(w-5,3,2,2,'Secure cabinet','cabinet');}
            const counter=furniture[0];objects.push({id:`${id}:information`,kind:'facility',name:counter.label,...counter,description:building.floors?`${building.name}, floor ${floor}: ${role}.`:building.name,
                actions:[{id:'inspect',label:'Inspect',result:building.style==='security'?'Parking requires Executive Parking clearance on your ID implant. Clearance issuance and security staff will be developed later.':building.floors?`${role}. Corporate jobs and staff will be developed later.`:building.style==='clinic'?'A corporate healthcare reception and examination area. Treatment services will be developed later.':'An upscale dining room with neatly arranged tables. Restaurant service will be developed later.'}]});
            if(floor===1)objects.push({id:`${id}:exit`,kind:'door',name:'Exit to Executive Offices',x:spawn.x,y:north?0:h-1,exit:true,lockId:`${building.id}:front`,lockLevel:1,destination:{mapId:'f1',...building.approach}});
            setup.worldMaps[id]={id,worldArea:'f1',name:building.floors?`${building.name} · Floor ${floor}`:building.name,width:w,height:h,spawn,interior:true,exteriorFootprint:building,
                buildings:[],cars:[],trees:[],parkingBays:[],furniture,interactables:objects,floor,totalFloors:floors,
                eyebrow:'EXECUTIVE OFFICES · '+(building.floors?'CORPORATE TOWER':'CAMPUS SERVICES'),subtitle:role,
                description:building.floors?`${role} on floor ${floor} of ${building.name}. Polished floors, glass partitions and well-kept furnishings serve the city's corporate leadership. The elevator connects all ${floors} floors.`:`${building.name} has a calm, carefully maintained interior with high-quality furnishings.`,
                ambientSound:'Climate control hums softly behind the walls.',colors:{floor:'#85948e',wall:'#30464f'},
                tileAt(x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w||y>=h)return tile('boundary','Building edge',false);
                    const portal=objects.find(o=>['door','elevator'].includes(o.kind)&&inside(x,y,{...o,width:o.width||1,height:o.height||1}));if(portal)return tile(portal.kind==='door'?'entrance':'stairs',portal.name);
                    if(x===0||y===0||x===w-1||y===h-1)return tile('wall','Corporate building wall',false);
                    const fixture=furniture.find(f=>inside(x,y,f));return fixture?tile('furniture',fixture.label,false):tile('floor',role);}
            };
        }
    }
    setup.worldMaps.e1.exits.east={mapId:'f1',offset:0};
};
