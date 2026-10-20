/* Geometry upgrades preserve time, leases and item identities. History contains
   no gameplay state; v1/v2 first map through v3 before the current layout. */
setup.layoutMigration=(()=>{
    const inside=(p,r)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
    const unitId=id=>String(id).replace(/^([1-4])-([56])$/,(_,building,number)=>`${building}-${number==='5'?3:4}`);
    function nearest(map,p,available=()=>true) {
        if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return {...map.spawn};
        const start={x:Math.max(0,Math.min(map.width-1,Math.round(p.x))),y:Math.max(0,Math.min(map.height-1,Math.round(p.y)))},queue=[start],seen=new Set();
        for(let i=0;i<queue.length;i++) {
            const point=queue[i],key=`${point.x},${point.y}`;if(seen.has(key))continue;seen.add(key);
            if(map.tileAt(point.x,point.y).walkable&&available(point))return point;
            for(const [dx,dy]of[[0,1],[1,0],[0,-1],[-1,0]]){const x=point.x+dx,y=point.y+dy;if(x>=0&&y>=0&&x<map.width&&y<map.height)queue.push({x,y});}
        }
        return {...map.spawn};
    }
    function v3Point(id,p) {
        const old=Object.hasOwn(setup.layoutHistory,id)?setup.layoutHistory[id]:null;if(!old)return p;
        if(old.xs)return {x:old.xs[p.x],y:old.ys[p.y]};
        if(id!=='apartments')return p;
        if(p.x<=24&&p.y>=27||p.y>=43)return {x:p.x,y:p.y+20};
        const doors=[[30,15],[37,23],[30,31],[23,23],[42,32]],ids=['apartment-door-1','apartment-door-2','apartment-door-3','apartment-door-4','housing-office-door'];
        const i=doors.findIndex(([x,y])=>Math.abs(x-p.x)+Math.abs(y-p.y)<=2),next=old.interactables.find(o=>o.id===ids[i]);
        return next?{x:next.x+p.x-doors[i][0],y:next.y+p.y-doors[i][1]}:p;
    }
    function fromV4(id,p) {
        const map=setup.worldMaps[id];if(id!=='apartments')return p;
        if(p.x>=9&&p.x<=24&&p.y>=48&&p.y<=62)return nearest(map,{x:p.x+66,y:p.y});
        if(p.x>=61&&p.x<=73&&p.y>=46&&p.y<=56)return nearest(map,{x:p.x,y:p.y+8});
        if(p.x>=14&&p.x<=74&&p.y>=4&&p.y<=45)return nearest(map,{x:p.x,y:p.y+10});
        return nearest(map,p);
    }
    function currentPoint(id,p) {
        const map=Object.hasOwn(setup.worldMaps,id)?setup.worldMaps[id]:null,old=Object.hasOwn(setup.layoutHistory,id)?setup.layoutHistory[id]:null;if(!map||!old)return p;
        if(/^apartment-[1-4]$/.test(id)) {
            const previous=old.units.find(unit=>inside(p,unit.bounds)),next=previous&&map.units.find(unit=>unit.id===unitId(previous.id));
            if(next) {
                const bathroom=inside(p,previous.bathroom),from=bathroom?previous.bathroom:previous.bounds,to=bathroom?next.bathroom:next.bounds;
                return nearest(map,{x:to.x+(p.x-from.x)*Math.max(1,to.width-1)/Math.max(1,from.width-1),y:to.y+(p.y-from.y)*Math.max(1,to.height-1)/Math.max(1,from.height-1)},point=>inside(point,to)&&(bathroom||!inside(point,next.bathroom)));
            }
            return {...map.spawn};
        }
        const portal=old.interactables.find(o=>Math.abs(o.x-p.x)+Math.abs(o.y-p.y)<=1),matching=portal&&map.interactables.find(o=>o.id===portal.id);
        if(matching)return nearest(map,{x:matching.x+p.x-portal.x,y:matching.y+p.y-portal.y});
        if(id==='e1'&&p.y>=42)return nearest(map,{x:p.x,y:p.y+16});
        if(id==='apartments')return fromV4(id,p);
        if(id==='housing-office'||!map.interior)return nearest(map,p);
        return nearest(map,{x:p.x*(map.width-1)/(old.width-1),y:p.y*(map.height-1)/(old.height-1)});
    }
    function migrate(value) {
        if(!value||value.version===5)return value;
        const oldVersion=value.version||1,convert=(id,p)=>oldVersion===4?fromV4(id,p):currentPoint(id,oldVersion<3?v3Point(id,p):p);
        const converted={...value,...convert(value.mapId||'apartments',value),version:5};
        const seat=State.variables.vehicleSeat;if(seat)Object.assign(seat,convert(seat.mapId,seat));
        if(State.variables.worldLayoutVersion!==4) {
            const containers=State.variables.inventory?.containers;
            if(containers) {
                const migrated={...containers};for(const id of Object.keys(containers))if(id.startsWith('ground:'))delete migrated[id];
                for(const [id,items]of Object.entries(containers)) {
                    const match=/^ground:([^:]+):(\d+):(\d+)$/.exec(id);if(!match)continue;
                    const map=Object.hasOwn(setup.worldMaps,match[1])?setup.worldMaps[match[1]]:null;if(!map){migrated[id]=items;continue;}
                    const p=nearest(map,convert(map.id,{x:+match[2],y:+match[3]}),p=>!migrated[`ground:${map.id}:${p.x}:${p.y}`]);
                    migrated[`ground:${map.id}:${p.x}:${p.y}`]=items;
                }
                State.variables.inventory.containers=migrated;
            }
            const housing=State.variables.housing;if(housing?.rentedUnit)housing.rentedUnit=unitId(housing.rentedUnit);
            const activity=State.variables.rest?.activity;if(activity?.unitId)activity.unitId=unitId(activity.unitId);
            for(const key of ['openedObjects','doorLocks']) {
                const flags=State.variables[key];if(!flags)continue;
                for(const [id,flag]of Object.entries(flags)) {
                    const renamed=id.replace(/((?:unit-door-|bathroom-door-|unit-|bathroom-))([1-4])-([56])$/,(_,prefix,building,number)=>prefix+unitId(`${building}-${number}`));
                    if(renamed!==id&&!Object.hasOwn(flags,renamed))flags[renamed]=flag;
                }
            }
            State.variables.worldLayoutVersion=4;
        }
        return converted;
    }
    return {migrate,nearest,unitId};
})();
