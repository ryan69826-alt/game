/* One canonical floor plan, rotated as a whole: doors, furnishings, room labels
 * and exit coordinates all retain their relationship to the outdoor entrance. */
setup.interiorMaps = (() => {
    const tile=(kind,label,walkable=true)=>({kind,label,walkable});
    function apartment(building,index) {
        const turns={south:0,west:1,north:2,east:3}[building.facing];
        const width=48,height=15,mapId=`apartment-${index}`;
        const point=(x,y)=> turns===0?{x,y}:turns===1?{x:height-1-y,y:x}:
            turns===2?{x:width-1-x,y:height-1-y}:{x:y,y:width-1-x};
        const cells=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>
            tile('wall',`${building.name} wall`,false)));
        const furniture=[],units=[],interactables=[];
        const put=(x,y,kind,label,walkable=true)=>cells[y][x]=tile(kind,label,walkable);
        function furnish(x,y,w,h,label,style,unitId) {
            for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) put(xx,yy,'furniture',label,false);
            const a=point(x,y),b=point(x+w-1,y+h-1);
            const object={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x)+1,height:Math.abs(a.y-b.y)+1,label,style,rotation:turns};
            furniture.push(object);
            if(style==='bed') interactables.push({...object,id:`bed-${unitId}`,kind:'bed',name:'Bed',unitId,description:'A bed with a firm mattress and clean bedding.'});
        }
        for(let y=10;y<=13;y++) for(let x=1;x<47;x++) put(x,y,'hall',`${building.name} hallway`);
        put(5,14,'entrance',`${building.name} exit`);
        // Four studios in one row. Unit 1 is nearest the entry on the left.
        for(let column=0;column<4;column++) {
            const number=column+1,unitId=`${index}-${number}`,name=`Apartment ${index} · Unit ${number}`;
            const left=1+column*12,y0=1,doorX=left+4,doorY=9,bathX=left;
            for(let y=y0;y<y0+8;y++) for(let x=left;x<left+10;x++) put(x,y,'floor',`${name} living area`);
            for(let y=y0;y<y0+4;y++) for(let x=bathX;x<bathX+4;x++) {
                const edge=x===bathX||x===bathX+3||y===y0||y===y0+3;
                put(x,y,edge?'wall':'bathroom',`${name} bathroom${edge?' wall':''}`,!edge);
            }
            put(bathX+3,y0+2,'entrance',`${name} bathroom doorway`);
            furnish(bathX+1,y0+1,1,1,'Toilet','bath');
            furnish(left+5,y0+1,2,3,'Bed','bed',unitId);
            furnish(left,y0+6,3,1,'Kitchen counter','kitchen');
            furnish(left+5,y0+6,2,1,'Dining table','table');
            put(doorX,doorY,'entrance',`${name} door`);
            const door=point(doorX,doorY),anchor=point(left+4,y0+4);
            function rectangle(x,y,w,h) {const a=point(x,y),b=point(x+w-1,y+h-1);return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x)+1,height:Math.abs(a.y-b.y)+1};}
            const bathroomDoor=point(bathX+3,y0+2);
            units.push({id:unitId,name,building:index,number,mapId,door,anchor,bounds:rectangle(left,y0,10,8),bathroom:rectangle(bathX+1,y0+1,2,2),bathroomDoor});
            interactables.push({id:`bathroom-door-${unitId}`,kind:'door',name:'Bathroom door',...bathroomDoor,width:1,height:1,interiorOf:unitId,lockId:`bathroom-${unitId}`,lockLevel:1,description:'A small bathroom door.'});
            interactables.push({id:`unit-door-${unitId}`,kind:'door',name:`Unit ${number} door`,...door,width:1,height:1,unitId,lockId:`unit-${unitId}`,lockLevel:2,description:`${name}. Unlock with its matching key or try lockpicking.`});
        }
        const exit=point(5,14),spawn=point(5,12);
        const outside={x:building.door.x+({west:-1,east:1}[building.facing]||0),
            y:building.door.y+({north:-1,south:1}[building.facing]||0)};
        interactables.push({id:`exit-${mapId}`,kind:'door',name:'Exit to courtyard',...exit,width:1,height:1,
            exit:true,lockId:`building-${index}`,lockLevel:1,destination:{mapId:'apartments',...outside},description:'The exit leads back toward the central park.'});
        const rotatedWidth=turns%2?height:width,rotatedHeight=turns%2?width:height;
        const rotated=Array.from({length:rotatedHeight},()=>Array(rotatedWidth));
        for(let y=0;y<height;y++) for(let x=0;x<width;x++) {const p=point(x,y);rotated[p.y][p.x]=cells[y][x];}
        return {id:mapId,name:building.name,width:rotatedWidth,height:rotatedHeight,spawn,interior:true,
            facing:building.facing,exteriorAnchor:{...building.door},units,furniture,interactables,
            buildings:[],cars:[],parkingBays:[],description:'A single-floor building with four studio apartments in one row beside a shared hallway. Each unit has a living area, bed, kitchenette, and bathroom.',
            subtitle:'Single floor · Four apartments',
            tileAt:(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&rotated[y]?.[x] || tile('boundary','Edge of the building',false)};
    }
    function office(building) {
        const width=12,height=12,spawn={x:8,y:2};
        const furniture=[{x:6,y:8,width:4,height:1,label:'Front desk',style:'desk'},{x:1,y:9,width:3,height:1,label:'Storage shelves',style:'cabinet'}];
        const storageDoor={id:'office-storage-door',kind:'door',name:'Storeroom door',x:3,y:7,lockId:'office-storage',lockLevel:1,houseRoomId:'office-storage'};
        const rooms=[
            {id:'office-storage',name:'Storeroom',kind:'storage',bounds:{x:1,y:8,width:4,height:3},door:{x:3,y:7},doorId:storageDoor.id,description:'A small storeroom holds office supplies on shelves.'},
            {id:'office-reception',name:'Reception',kind:'living',bounds:{x:1,y:1,width:10,height:6},description:'A compact reception area with a rental desk and a separate storeroom.'},
            {id:'office-reception',name:'Reception',kind:'living',bounds:{x:6,y:7,width:5,height:4},description:'The receptionist works behind a plain front desk.'}
        ];
        const receptionist={id:'housing-receptionist',kind:'npc',role:'housing',name:'Housing receptionist',x:8,y:9,width:1,height:1,
            interactionTiles:[{x:7,y:7},{x:8,y:7},{x:9,y:7}],
            description:'An adult housing receptionist sits behind the front desk, ready to handle apartment rentals.'};
        return {id:'housing-office',name:'Housing Office',width,height,spawn,interior:true,facing:'north',
            exteriorAnchor:{...building.door},buildings:[],cars:[],parkingBays:[],furniture,units:[],rooms,
            subtitle:'Apartment rentals',description:'A compact housing office with a rental desk and a separate supply storeroom. The receptionist works behind the front desk. Approach the desk and press E to interact.',
            interactables:[receptionist,storageDoor,{id:'office-exit',kind:'door',name:'Exit to courtyard',x:8,y:0,width:1,height:1,exit:true,lockId:'housing-office',lockLevel:1,
                destination:{mapId:'apartments',x:building.door.x,y:building.door.y-1},description:'The north-facing entrance leads back outside.'}],
            tileAt(x,y) {
                if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height) return tile('boundary','Edge of the office',false);
                if(x===8&&y===0) return tile('entrance','Housing office exit');
                if(x===0||y===0||x===width-1||y===height-1) return tile('wall','Office wall',false);
                if(x===3&&y===7)return tile('entrance','Storeroom doorway');
                if((y===7&&x>=1&&x<=5)||(x===5&&y>=7))return tile('wall','Storeroom wall',false);
                if(x===receptionist.x&&y===receptionist.y) return tile('npc','Housing receptionist',false);
                const object=furniture.find(f=>x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.height);
                return object?tile('furniture',object.label,false):tile('floor','Housing office');
            }};
    }
    return {apartment,office};
})();
