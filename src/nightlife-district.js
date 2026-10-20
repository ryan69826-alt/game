/* E1 is a compact venue block. Services and staffed activity come later. */
setup.nightlifeDistrict=()=>{
    const inside=(x,y,r)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    const width=100,height=54;
    const venues=[
        {id:'e1-bar',name:'Bar',label:'BAR',x:6,y:10,width:24,height:16,facing:'east',door:{x:29,y:18},accent:'#dcad78',style:'bar'},
        {id:'e1-clothing',name:'Clothing store',label:'CLOTHING',x:6,y:26,width:24,height:16,facing:'east',door:{x:29,y:34},accent:'#d69ec1',style:'clothing'},
        {id:'e1-hotel',name:'Hotel',label:'HOTEL',x:34,y:10,width:28,height:12,facing:'east',door:{x:61,y:16},accent:'#d5c48b',style:'hotel'},
        {id:'e1-casino',name:'Casino',label:'CASINO',x:34,y:22,width:28,height:10,facing:'west',door:{x:34,y:27},accent:'#b8bb85',style:'casino'},
        {id:'e1-nightclub',name:'Nightclub',label:'NIGHTCLUB',x:34,y:32,width:28,height:10,facing:'south',door:{x:48,y:41},accent:'#aa9ddd',style:'nightclub'},
        {id:'e1-small-club',name:'Small club',label:'SMALL CLUB',x:66,y:10,width:24,height:16,facing:'west',door:{x:66,y:18},accent:'#d294b2',style:'small-club'},
        {id:'e1-tattoo',name:'Tattoo parlor',label:'TATTOO',x:66,y:26,width:24,height:16,facing:'west',door:{x:66,y:34},accent:'#86bac5',style:'tattoo'}
    ].map(venue=>{
        const dx=venue.facing==='east'?1:venue.facing==='west'?-1:0,dy=venue.facing==='south'?1:0;
        return {...venue,approach:{x:venue.door.x+dx,y:venue.door.y+dy},
            spawn:venue.facing==='east'?{x:15,y:7}:venue.facing==='west'?{x:2,y:7}:{x:9,y:11},
            exit:venue.facing==='east'?{x:17,y:7}:venue.facing==='west'?{x:0,y:7}:{x:9,y:13}};
    });
    const alleys=[{x:30,y:10,width:4,height:34},{x:62,y:10,width:4,height:34}];
    const backAlley={x:6,y:6,width:84,height:4};
    const outdoorDoors=venues.map(venue=>({id:`${venue.id}:entrance`,kind:'door',name:`${venue.name} entrance`,...venue.door,
        lockId:`${venue.id}:front`,lockLevel:1,destination:{mapId:venue.id,...venue.spawn},description:`The ${venue.name.toLowerCase()} entrance faces ${venue.facing==='south'?'the street':'the alley'}.`}));
    function tileAt(x,y) {
        const tile=(kind,label,walkable=true)=>({kind,label,walkable});
        if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)return tile('boundary','Edge of the area',false);
        for(const venue of venues){if(x===venue.door.x&&y===venue.door.y)return tile('entrance',`${venue.name} entrance`);if(inside(x,y,venue))return tile('building',venue.name,false);}
        if(y===5&&x>=5&&x<=90||(x===5||x===90)&&y>=6&&y<=41)return tile('fence','Service boundary fence',false);
        if(y>=44&&y<=48)return tile('road','Nightlife district road');
        if(inside(x,y,backAlley))return tile('alley','Back alley');
        if(alleys.some(alley=>inside(x,y,alley)))return tile('alley','Nightlife alley');
        if(y>=42&&y<=43||y>=49&&y<=50)return tile('pavement','Street sidewalk');
        return tile('pavement','Nightlife district pavement');
    }
    setup.worldMaps.e1={id:'e1',worldArea:'e1',name:'Nightlife',width,height,spawn:{x:0,y:46},venues,buildings:venues,alleys,backAlley,
        interactables:outdoorDoors,trees:[],cars:[],parkingBays:[],roads:{horizontal:{y:44,height:5},vertical:{x:-10,width:0}},
        exits:{west:{mapId:'d1',offset:0}},eyebrow:'NIGHTLIFE · ALLEYS & VENUES',subtitle:'Neon signs above a compact block of connected venues.',
        description:'Two alleys run north from the road between connected buildings. A back alley joins their northern ends. Signs mark a bar, nightclub, casino, clothing store, hotel, tattoo parlor and small club. Stairs inside the small club descend to an underground club. The road leads west to Transit & Shops.',
        labels:[{x:48,y:8,text:'BACK ALLEY'}],ambientSounds:[{bounds:backAlley,text:'Air moves through the narrow service passage behind the buildings.'},...alleys.map(bounds=>({bounds,text:'A faint electrical hum comes from the signs above the alley.'}))],
        legend:[['Entrance','#dfb777'],['Alley','#354046'],['Sidewalk','#66736c']],tileAt};

    function furnishings(style) {
        const piece=(x,y,width,height,label,style)=>({x,y,width,height,label,style});
        switch(style) {
        case 'bar':return [piece(4,3,9,1,'Bar counter','desk'),... [5,8,11].map(x=>piece(x,5,1,1,'Bar stool','seat')),piece(5,9,2,2,'Table','table'),piece(11,9,2,2,'Table','table')];
        case 'clothing':return [piece(4,3,1,5,'Clothing rack','cabinet'),piece(12,3,1,5,'Clothing rack','cabinet'),piece(7,10,4,1,'Checkout counter','desk')];
        case 'hotel':return [piece(5,3,8,2,'Reception desk','desk'),piece(3,9,2,2,'Luggage cabinet','cabinet'),piece(11,9,3,1,'Lobby bench','seat')];
        case 'casino':return [piece(4,3,3,2,'Gaming table','table'),piece(10,3,3,2,'Gaming table','table'),piece(4,9,3,2,'Gaming table','table'),piece(10,9,3,2,'Gaming table','table')];
        case 'tattoo':return [piece(6,5,2,3,'Tattoo chair','seat'),piece(11,3,2,3,'Supply cabinet','cabinet'),piece(4,10,5,1,'Service desk','desk')];
        case 'small-club':return [piece(4,3,3,2,'Table','table'),piece(10,3,4,1,'Club counter','desk'),piece(5,9,4,1,'Bench','seat')];
        default:return [piece(4,2,10,2,'Stage','desk'),piece(3,9,4,1,'Lounge seats','seat'),piece(11,9,4,1,'Lounge seats','seat')];
        }
    }
    function stairs(id,name,x,y,destination,label) {
        return {id,kind:'stairs',name,x,y,width:2,height:2,description:'A stairway connects the small club and the underground club.',
            actions:[{id:'travel',label,result:()=>setup.worldTravel.enter({destination})}]};
    }
    function interior(id,name,style,spawn,portals) {
        const furniture=furnishings(style),stairways=portals.filter(object=>object.kind==='stairs');
        const counter=furniture[0];
        const fixture={id:`${id}:fixture`,kind:'facility',name:counter.label,x:counter.x,y:counter.y,
            description:`Basic fittings for the ${name.toLowerCase()}.`,actions:[{id:'inspect',label:'Inspect',result:style==='hotel'?'This is the hotel lobby. Guest rooms and hotel bookings will be added later.':`The ${name.toLowerCase()} layout is open to explore. Services will be added later.`}]};
        const map={id,worldArea:'e1',name,width:18,height:14,spawn,interior:true,buildings:[],trees:[],cars:[],parkingBays:[],furniture,stairs:stairways,
            eyebrow:style==='underground'?'NIGHTLIFE · UNDERGROUND':'NIGHTLIFE · VENUE',subtitle:style==='hotel'?'Reception and lobby':'Interior',
            description:style==='hotel'?'A small hotel lobby with a reception desk, seating and luggage storage. Guest rooms are not accessible yet.':style==='small-club'?'A compact club with tables, a counter and stairs descending to an underground club.':style==='underground'?'An underground club with a stage, lounge seating and an open floor. Stairs lead back up to the small club.':`A basic ${name.toLowerCase()} interior with an open floor and venue fittings. Services are not available yet.`,
            ambientSound:style==='underground'?'A low ventilation hum fills the underground room.':'Ventilation and ceiling lights hum over the quiet interior.',interactables:[...portals,fixture],
            tileAt(x,y){
                const tile=(kind,label,walkable=true)=>({kind,label,walkable});
                if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=18||y>=14)return tile('boundary','Edge of the venue',false);
                const portal=portals.find(portal=>inside(x,y,{...portal,width:portal.width||1,height:portal.height||1}));
                if(portal)return tile(portal.kind==='stairs'?'stairs':'entrance',portal.name);
                if(x===0||y===0||x===17||y===13)return tile('wall','Venue wall',false);
                const item=furniture.find(item=>inside(x,y,item));
                return item?tile('furniture',item.label,false):tile('floor',style==='nightclub'||style==='underground'?'Open dance floor':name);
            }};
        setup.worldMaps[id]=map;
    }
    for(const venue of venues) {
        const exit={id:`${venue.id}:exit`,kind:'door',name:'Exit to Nightlife',...venue.exit,exit:true,lockId:`${venue.id}:front`,lockLevel:1,
            destination:{mapId:'e1',...venue.approach},description:'The entrance leads back to the nightlife district.'};
        const portals=[exit];
        if(venue.style==='small-club')portals.push(stairs('e1-stairs-down','Stairs to underground club',13,10,{mapId:'e1-underground-club',x:3,y:4},'Go downstairs'));
        interior(venue.id,venue.name,venue.style,venue.spawn,portals);
    }
    interior('e1-underground-club','Underground club','underground',{x:3,y:4},[
        stairs('e1-stairs-up','Stairs to small club',2,2,{mapId:'e1-small-club',x:13,y:9},'Go upstairs')]);
    setup.worldMaps.d1.exits.east={mapId:'e1',offset:0};
};
