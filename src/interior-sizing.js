/* A common 1.5× footprint standard. Expand floor space, not furniture sprites.
   Doors keep one-cell thresholds and all persistent object/room IDs stay stable. */
setup.interiorSizing=(()=>{
    const inside=(p,r)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
    function axis(length,target,protectedCells) {
        const sizes=Array(length).fill(1),free=Array.from({length:length-2},(_,i)=>length-2-i).filter(i=>!protectedCells.has(i));
        if(target<length||!free.length&&target>length)throw new Error('Interior cannot fit the requested footprint.');
        for(let extra=0;extra<target-length;extra++)sizes[free[extra%free.length]]++;
        const cuts=[0],reverse=[];sizes.forEach((size,i)=>{cuts.push(cuts.at(-1)+size);for(let n=0;n<size;n++)reverse.push(i);});
        return {cuts,reverse};
    }
    function resize(source,width,height,exterior) {
        const portals=source.interactables.filter(object=>['door','stairs'].includes(object.kind));
        const protect=(key,size)=>new Set(portals.flatMap(object=>{
            const margin=object.kind==='stairs'?1:0;
            return Array.from({length:(object[size]||1)+margin*2},(_,i)=>object[key]+i-margin);
        }));
        const xs=axis(source.width,width,protect('x','width')),ys=axis(source.height,height,protect('y','height'));
        const point=p=>({...p,x:xs.cuts[p.x],y:ys.cuts[p.y]});
        const rect=r=>({...point(r),width:xs.cuts[r.x+r.width]-xs.cuts[r.x],height:ys.cuts[r.y+r.height]-ys.cuts[r.y]});
        const furniture=(source.furniture||[]).map(point);
        const interactables=source.interactables.map(object=>({...point(object),...(object.interactionTiles?{interactionTiles:object.interactionTiles.map(point)}:{})}));
        const units=source.units?.map(unit=>({...unit,door:point(unit.door),anchor:point(unit.anchor),bounds:rect(unit.bounds),bathroom:rect(unit.bathroom),bathroomDoor:point(unit.bathroomDoor)}));
        const rooms=source.rooms?.map(room=>({...room,bounds:rect(room.bounds),...(room.door?{door:point(room.door)}:{}),...(room.threshold?{threshold:point(room.threshold)}:{})}));
        const result={...source,width,height,spawn:point(source.spawn),furniture,interactables,...(units?{units}:{}),...(rooms?{rooms}:{}),
            stairs:interactables.filter(object=>object.kind==='stairs'),interiorScale:1.5,exteriorSize:{width:exterior.width,height:exterior.height},
            layout:{point,sourceWidth:source.width,sourceHeight:source.height},
            tileAt(x,y){
                if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height)return {kind:'boundary',label:'Edge of the building',walkable:false};
                const p={x,y},old={x:xs.reverse[x],y:ys.reverse[y]};
                const portal=interactables.find(object=>['door','stairs'].includes(object.kind)&&inside(p,{...object,width:object.width||1,height:object.height||1}));
                if(portal)return {kind:portal.kind==='stairs'?'stairs':'entrance',label:portal.name,walkable:true};
                const item=furniture.find(item=>inside(p,item));if(item)return {kind:'furniture',label:item.label,walkable:false};
                const npc=interactables.find(object=>object.kind==='npc'&&inside(p,{...object,width:object.width||1,height:object.height||1}));
                if(npc)return {kind:'npc',label:npc.name,walkable:false};
                const tile=source.tileAt(old.x,old.y);
                if(['furniture','npc'].includes(tile.kind)) {
                    const room=source.rooms?.find(room=>inside(old,room.bounds));
                    const bathroom=room?.kind==='bathroom'||source.units?.some(unit=>inside(old,unit.bathroom));
                    return {kind:bathroom?'bathroom':'floor',label:room?.name||source.name,walkable:true};
                }
                return tile;
            }};
        return result;
    }
    function apply() {
        const maps=setup.worldMaps,sources={...maps},footprints={};
        for(const map of Object.values(sources).filter(map=>!map.interior))for(const building of [...map.buildings,...(map.housingOffice?[map.housingOffice]:[])]) {
            for(const door of map.interactables.filter(object=>object.destination&&inside(object,building))) {
                if(sources[door.destination.mapId]?.interior)footprints[door.destination.mapId]=building;
            }
        }
        // The basement belongs to the small club's building footprint.
        footprints['e1-underground-club']=footprints['e1-small-club'];
        for(const [id,exterior] of Object.entries(footprints)) {
            maps[id]=resize(sources[id],Math.ceil(exterior.width*1.5),Math.ceil(exterior.height*1.5),exterior);
            maps[id].worldArea=sources[id].worldArea||'apartments';
        }
        for(const map of Object.values(maps)) {
            for(const object of map.interactables)if(object.destination&&maps[object.destination.mapId]?.layout) {
                const target=maps[object.destination.mapId];object.destination=target.layout.point(object.destination);
                // Stair actions reference their original definition; update only its destination.
                const original=sources[map.id]?.interactables.find(old=>old.id===object.id);
                if(original&&original!==object)original.destination=object.destination;
            }
            if(!map.interior) {
                const old=map.buildings;
                const buildings=old.map(building=>{
                    const door=map.interactables.find(object=>object.destination&&inside(object,building)),target=maps[door?.destination.mapId];
                    return target?.layout?{...building,...(building.spawn?{spawn:target.layout.point(building.spawn)}:{}),...(building.exit?{exit:target.layout.point(building.exit)}:{})}:building;
                });
                map.buildings=buildings;if(map.venues===old)map.venues=buildings;if(map.shops===old)map.shops=buildings;
            }
        }
        // Apartments grew north of the shared street; crossings retain road alignment.
        maps.apartments.exits={west:{mapId:'b1',offset:-20},east:{mapId:'d1',offset:-20}};
        maps.b1.exits.east={mapId:'apartments',offset:20};maps.d1.exits.west={mapId:'apartments',offset:20};
    }
    function nearest(map,p,available=()=>true) {
        const start={x:Math.max(0,Math.min(map.width-1,p.x)),y:Math.max(0,Math.min(map.height-1,p.y))},queue=[start],seen=new Set();
        for(let i=0;i<queue.length;i++) {
            const point=queue[i],key=`${point.x},${point.y}`;if(seen.has(key))continue;seen.add(key);
            if(map.tileAt(point.x,point.y).walkable&&available(point))return point;
            for(const[dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]]){const x=point.x+dx,y=point.y+dy;if(x>=0&&y>=0&&x<map.width&&y<map.height)queue.push({x,y});}
        }
        return map.spawn;
    }
    function legacyPoint(mapId,p) {
        const map=setup.worldMaps[mapId];if(!map)return p;
        if(map.layout)return nearest(map,map.layout.point(p));
        if(mapId!=='apartments')return p;
        if(p.x<=24&&p.y>=27)return nearest(map,{x:p.x,y:p.y+20});
        if(p.y>=43)return nearest(map,{x:p.x,y:p.y+20});
        const old=[{x:30,y:15},{x:37,y:23},{x:30,y:31},{x:23,y:23},{x:42,y:32}];
        const next=[...map.buildings,map.housingOffice];
        const i=old.findIndex(door=>Math.abs(door.x-p.x)+Math.abs(door.y-p.y)<=2);
        return nearest(map,i>=0?{x:next[i].door.x+p.x-old[i].x,y:next[i].door.y+p.y-old[i].y}:{x:p.x,y:p.y});
    }
    function migrate(value) {
        if(!value||value.version===3)return value;
        const converted={...value,...legacyPoint(value.mapId||'apartments',value),version:3};
        const seat=State.variables.vehicleSeat;if(seat)Object.assign(seat,legacyPoint(seat.mapId,seat));
        if(State.variables.worldLayoutVersion!==2) {
            const containers=State.variables.inventory?.containers;
            if(containers) {
                const migrated={...containers};for(const id of Object.keys(containers))if(id.startsWith('ground:'))delete migrated[id];
                for(const [id,items] of Object.entries(containers)) {
                    const match=/^ground:([^:]+):(\d+):(\d+)$/.exec(id);if(!match)continue;
                    const map=setup.worldMaps[match[1]];if(!map){migrated[id]=items;continue;}
                    const p=nearest(map,legacyPoint(map.id,{x:+match[2],y:+match[3]}),p=>!migrated[`ground:${map.id}:${p.x}:${p.y}`]);
                    migrated[`ground:${map.id}:${p.x}:${p.y}`]=items;
                }
                State.variables.inventory.containers=migrated;
            }
            State.variables.worldLayoutVersion=2;
        }
        return converted;
    }
    return {apply,resize,legacyPoint,migrate};
})();
