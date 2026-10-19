/* A compact house is one 13×12 plan. Southern houses rotate the entire plan
   so the entrance, rooms and furnishings always face their street frontage. */
setup.houseInteriors=(()=>{
    function create(building) {
        const width=13,height=12,turns=building.facing==='north'?2:0,id=`a1-house-${building.number}`;
        const point=(x,y)=>turns?{x:width-1-x,y:height-1-y}:{x,y};
        function rect(x,y,w,h) {const a=point(x,y),b=point(x+w-1,y+h-1);return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:w,height:h};}
        const tile=(kind,label,walkable=true)=>({kind,label,walkable});
        const cells=Array.from({length:height},()=>Array.from({length:width},()=>tile('wall','House wall',false)));
        const put=(x,y,kind,label,walkable=true)=>{const p=point(x,y);cells[p.y][p.x]=tile(kind,label,walkable);};
        const rooms=[
            {id:`${id}:bedroom`,name:'Bedroom',kind:'bedroom',bounds:rect(1,1,4,4),door:point(3,5),description:'A small bedroom with a plain bed and enough space to move around it.'},
            {id:`${id}:side`,name:'Side room',kind:'side',bounds:rect(6,1,3,4),door:point(7,5),description:'A spare side room with a basic desk and storage cabinet.'},
            {id:`${id}:bathroom`,name:'Bathroom',kind:'bathroom',bounds:rect(10,1,2,4),door:point(10,5),description:'A narrow bathroom with a toilet, shower and extractor fan.'},
            {id:`${id}:living`,name:'Living / dining room',kind:'living',bounds:rect(1,6,11,5),description:'A modest combined living and dining room with a small kitchen counter, table and worn sofa.'}
        ];
        for(const room of rooms) {
            for(let y=room.bounds.y;y<room.bounds.y+room.bounds.height;y++) for(let x=room.bounds.x;x<room.bounds.x+room.bounds.width;x++) cells[y][x]=tile(room.kind==='bathroom'?'bathroom':'floor',room.name);
            if(room.door) cells[room.door.y][room.door.x]=tile('entrance',`${room.name} doorway`);
        }
        const furniture=[],interactables=[];
        function furnish(x,y,w,h,label,style,room) {
            const bounds=rect(x,y,w,h);
            for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) put(xx,yy,'furniture',label,false);
            const item={...bounds,label,style,rotation:turns};furniture.push(item);
            if(style==='bed') interactables.push({...item,id:`${id}:bed`,name:'Bed',kind:'bed',unitId:room.id,roomId:room.id,description:'A simple bed with a firm mattress.'});
        }
        furnish(1,1,2,3,'Bed','bed',rooms[0]);
        furnish(6,1,2,1,'Desk','desk',rooms[1]);furnish(8,1,1,2,'Cabinet','cabinet',rooms[1]);
        furnish(11,1,1,1,'Toilet','bath',rooms[2]);furnish(10,1,1,1,'Shower','bath',rooms[2]);
        furnish(1,7,3,1,'Kitchen counter','kitchen',rooms[3]);furnish(4,8,2,1,'Dining table','table',rooms[3]);furnish(9,9,2,1,'Sofa','seat',rooms[3]);
        for(const room of rooms.filter(room=>room.door)) {
            room.doorId=`${room.id}:door`;
            interactables.push({id:room.doorId,kind:'door',name:`${room.name} door`,...room.door,houseRoomId:room.id,lockLevel:1,description:`A plain ${room.name.toLowerCase()} door.`});
        }
        const exit=point(6,11),spawn=point(6,9);
        cells[exit.y][exit.x]=tile('entrance',`${building.name} exit`);
        const living=rooms[3];living.threshold=exit;
        interactables.push({id:`${id}:exit`,kind:'door',name:'Exit to street',...exit,exit:true,lockId:`${id}:front`,lockLevel:2,
            destination:{mapId:'a1',x:building.door.x,y:building.door.y+(building.facing==='south'?1:-1)},description:'The front door leads back to the street.'});
        return {id,worldArea:'a1',name:building.name,width,height,spawn,interior:true,facing:building.facing,eyebrow:'LOW END HOUSING · SINGLE FLOOR',
            rooms,buildings:[],cars:[],parkingBays:[],furniture,interactables,
            subtitle:'Bedroom · Side room · Living / dining · Bathroom',description:'A compact four-room house with simple fittings and worn finishes.',
            tileAt:(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&cells[y]?.[x]||tile('boundary','Edge of the house',false)};
    }
    return {create};
})();
