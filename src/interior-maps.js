/* One canonical floor plan, rotated as a whole: doors, furnishings, room labels
 * and exit coordinates all retain their relationship to the outdoor entrance. */
setup.interiorMaps = (() => {
    const tile=(kind,label,walkable=true)=>({kind,label,walkable});
    function apartment(building,index) {
        const turns={south:0,west:1,north:2,east:3}[building.facing];
        const width=25,height=29,mapId=`apartment-${index}`;
        const point=(x,y)=> turns===0?{x,y}:turns===1?{x:height-1-y,y:x}:
            turns===2?{x:width-1-x,y:height-1-y}:{x:y,y:width-1-x};
        const cells=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>
            tile('wall',`${building.name} wall`,false)));
        const furniture=[],units=[],interactables=[];
        const put=(x,y,kind,label,walkable=true)=>cells[y][x]=tile(kind,label,walkable);
        function furnish(x,y,w,h,label,style) {
            for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) put(xx,yy,'furniture',label,false);
            const a=point(x,y),b=point(x+w-1,y+h-1);
            furniture.push({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x)+1,height:Math.abs(a.y-b.y)+1,label,style});
        }
        for(let y=1;y<28;y++) for(let x=11;x<=13;x++) put(x,y,'hall',`${building.name} hallway`);
        put(12,28,'entrance',`${building.name} exit`);
        for(let row=0;row<3;row++) for(let side=0;side<2;side++) {
            const number=row*2+side+1,unitId=`${index}-${number}`,name=`Apartment ${index} · Unit ${number}`;
            const y0=1+row*9,left=side===0?1:15,right=side===0?9:23,doorX=side===0?10:14,doorY=y0+4;
            for(let y=y0;y<y0+8;y++) for(let x=left;x<=right;x++) put(x,y,'floor',`${name} living area`);
            // A small enclosed bathroom at the far corner; opening faces inward.
            const bathX=side===0?1:20;
            for(let y=y0;y<y0+4;y++) for(let x=bathX;x<bathX+4;x++) {
                const edge=x===bathX || x===bathX+3 || y===y0 || y===y0+3;
                put(x,y,edge?'wall':'bathroom',`${name} bathroom${edge?' wall':''}`,!edge);
            }
            put(side===0?bathX+3:bathX,y0+2,'bathroom',`${name} bathroom doorway`);
            furnish(bathX+1,y0+1,1,1,'Toilet','bath');
            furnish(side===0?6:16,y0+1,2,3,'Bed','bed');
            furnish(side===0?1:21,y0+6,3,1,'Kitchen counter','kitchen');
            furnish(side===0?6:16,y0+6,2,1,'Dining table','table');
            put(doorX,doorY,'entrance',`${name} door`);
            const door=point(doorX,doorY),anchor=point(side===0?5:19,y0+4);
            const unit={id:unitId,name,building:index,number,mapId,door,anchor};units.push(unit);
            interactables.push({id:`unit-door-${unitId}`,kind:'door',name:`Unit ${number} door`,...door,width:1,height:1,
                unitId,description:`${name}. Rent this apartment at the housing office to unlock its door.`});
        }
        const exit=point(12,28),spawn=point(12,26);
        const outside={x:building.door.x+({west:-1,east:1}[building.facing]||0),
            y:building.door.y+({north:-1,south:1}[building.facing]||0)};
        interactables.push({id:`exit-${mapId}`,kind:'door',name:'Exit to courtyard',...exit,width:1,height:1,
            exit:true,destination:{mapId:'apartments',...outside},description:'The exit leads back toward the central park.'});
        const rotatedWidth=turns%2?height:width,rotatedHeight=turns%2?width:height;
        const rotated=Array.from({length:rotatedHeight},()=>Array(rotatedWidth));
        for(let y=0;y<height;y++) for(let x=0;x<width;x++) {const p=point(x,y);rotated[p.y][p.x]=cells[y][x];}
        return {id:mapId,name:building.name,width:rotatedWidth,height:rotatedHeight,spawn,interior:true,
            facing:building.facing,exteriorAnchor:{...building.door},units,furniture,interactables,
            buildings:[],cars:[],parkingBays:[],description:'A single-floor building with six studio apartments, three on each side of a shared hallway. Each unit has a living area, bed, kitchenette, and bathroom.',
            subtitle:'Single floor · Six apartments',
            tileAt:(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&rotated[y]?.[x] || tile('boundary','Edge of the building',false)};
    }
    function office(building) {
        const width=17,height=17,spawn={x:8,y:2};
        const furniture=[
            {x:5,y:8,width:7,height:1,label:'Front desk',style:'desk'},
            {x:2,y:5,width:1,height:3,label:'Waiting seats',style:'seat'},
            {x:14,y:5,width:1,height:3,label:'Waiting seats',style:'seat'},
            {x:2,y:13,width:3,height:1,label:'Filing cabinets',style:'cabinet'},
            {x:12,y:13,width:3,height:1,label:'Filing cabinets',style:'cabinet'}
        ];
        const receptionist={id:'housing-receptionist',kind:'npc',role:'housing',name:'Housing receptionist',x:8,y:9,width:1,height:1,
            interactionTiles:[{x:7,y:7},{x:8,y:7},{x:9,y:7}],
            description:'An adult housing receptionist sits behind the front desk, ready to handle apartment rentals.'};
        return {id:'housing-office',name:'Housing Office',width,height,spawn,interior:true,facing:'north',
            exteriorAnchor:{...building.door},buildings:[],cars:[],parkingBays:[],furniture,units:[],
            subtitle:'Apartment rentals',description:'A compact housing office with waiting seats and filing cabinets. The receptionist works behind the front desk. Approach the desk and press E to interact.',
            interactables:[receptionist,{id:'office-exit',kind:'door',name:'Exit to courtyard',x:8,y:0,width:1,height:1,exit:true,
                destination:{mapId:'apartments',x:building.door.x,y:building.door.y-1},description:'The north-facing entrance leads back outside.'}],
            tileAt(x,y) {
                if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height) return tile('boundary','Edge of the office',false);
                if(x===8&&y===0) return tile('entrance','Housing office exit');
                if(x===0||y===0||x===width-1||y===height-1) return tile('wall','Office wall',false);
                if(x===receptionist.x&&y===receptionist.y) return tile('npc','Housing receptionist',false);
                const object=furniture.find(f=>x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.height);
                return object?tile('furniture',object.label,false):tile('floor','Housing office');
            }};
    }
    return {apartment,office};
})();
