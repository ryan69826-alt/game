/* Current visibility, not a remembered floor-plan reveal. Hidden cells never
 * expose their terrain or furniture, and hidden objects cannot be interacted with. */
setup.rooms = (() => {
    const inside=(rect,x,y)=>x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height;
    const atDoor=(door,world)=>Math.abs(door.x-world.x)+Math.abs(door.y-world.y)<=1;
    function current(world=State.variables.world) {
        const map=setup.worldMaps[world?.mapId];
        const unit=map?.units?.find(unit=>inside(unit.bounds,world.x,world.y)||unit.door.x===world.x&&unit.door.y===world.y);
        const room=map?.rooms?.find(room=>inside(room.bounds,world.x,world.y)||room.door?.x===world.x&&room.door?.y===world.y||room.threshold?.x===world.x&&room.threshold?.y===world.y);
        return {map,unit,room,bathroom:room?.kind==='bathroom'||!!unit&&(inside(unit.bathroom,world.x,world.y)||unit.bathroomDoor.x===world.x&&unit.bathroomDoor.y===world.y)};
    }
    function unitVisible(unit,world=State.variables.world) {
        return inside(unit.bounds,world.x,world.y)||
            atDoor(unit.door,world)&&setup.interactions.isOpen(`unit-door-${unit.id}`,world.mapId);
    }
    function cellVisible(map,x,y,world=State.variables.world) {
        if(map.rooms) {
            const target=map.rooms.find(room=>inside(room.bounds,x,y)),here=current(world).room;
            if(!target||target.id===here?.id) return true;
            if(target.kind==='living') return !!here?.door&&atDoor(here.door,world)&&setup.interactions.isOpen(here.doorId,map.id);
            return here?.kind==='living'&&atDoor(target.door,world)&&setup.interactions.isOpen(target.doorId,map.id);
        }
        const unit=map.units?.find(unit=>inside(unit.bounds,x,y));
        if(!unit) return true;
        if(!unitVisible(unit,world)) return false;
        if(inside(unit.bathroom,x,y)) return inside(unit.bathroom,world.x,world.y)||
            atDoor(unit.bathroomDoor,world)&&setup.interactions.isOpen(`bathroom-door-${unit.id}`,map.id);
        if(inside(unit.bathroom,world.x,world.y)) return atDoor(unit.bathroomDoor,world)&&setup.interactions.isOpen(`bathroom-door-${unit.id}`,map.id);
        return true;
    }
    function objectVisible(object,world=State.variables.world) {
        const map=setup.worldMaps[world?.mapId];
        if(object.roomId) return current(world).room?.id===object.roomId;
        if(object.kind==='bed') return current(world).unit?.id===object.unitId&&!current(world).bathroom;
        if(object.interiorOf) return unitVisible(map.units.find(unit=>unit.id===object.interiorOf),world);
        return true;
    }
    function mask(ctx,map,world,camera,tileSize=16) {
        ctx.fillStyle='#101c21';let hidden=0;
        for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) if(!cellVisible(map,x,y,world)) {
            ctx.fillRect((x-camera.x)*tileSize,(y-camera.y)*tileSize,tileSize,tileSize);hidden++;
        }
        return hidden;
    }
    const activities={quiet:'Only a low ventilation hum is audible.',
        music:'Music plays nearby, its rhythm carrying through the room.',
        conversation:'Low voices and occasional laughter drift through the room.',
        plumbing:'Water runs through the pipes, followed by a faint metallic tick.',
        work:'Tools tap and scrape nearby, punctuated by brief pauses.'};
    function sourceFor(map,roomId,activity,sourceId) {
        const source=map.interactables.find(object=>object.id===sourceId);
        if(!source?.soundActivities?.includes(activity)||source.active===false) return null;
        const room=current({mapId:map.id,x:source.x,y:source.y});
        const sourceRoom=room.room?.id||(room.unit?room.unit.id+(room.bathroom?':bathroom':''):map.id==='housing-office'?'office':'hall');
        return sourceRoom===roomId?source:null;
    }
    function setActivity(mapId,roomId,activity,sourceId=null) {
        const map=setup.worldMaps[mapId];
        if(!map||!Object.hasOwn(activities,activity)||!['hall','office',...(map.rooms||[]).map(room=>room.id),...(map.units||[]).flatMap(unit=>[unit.id,`${unit.id}:bathroom`])].includes(roomId)) return false;
        if(activity!=='quiet'&&!sourceFor(map,roomId,activity,sourceId)) return false;
        State.variables.roomActivities={...State.variables.roomActivities,[`${mapId}:${roomId}`]:{activity,sourceId}};
        State.create(State.passage);$(document).trigger(':roomchange');return true;
    }
    function sounds(world=State.variables.world) {
        const cabin=setup.vehicleCabin.current();
        if(cabin) return setup.interactions.isOpen(cabin.car.id)?'The engine is off. A little air brushes past the open door.':'The engine is off. The closed cabin is quiet.';
        const {map,unit,room,bathroom}=current(world);if(!map) return '';
        const id=room?.id||(unit?unit.id+(bathroom?':bathroom':''):map.id==='housing-office'?'office':'hall');
        const activity=State.variables.roomActivities?.[`${map.id}:${id}`];
        if(activity&&Object.hasOwn(activities,activity.activity)&&(activity.activity==='quiet'||sourceFor(map,id,activity.activity,activity.sourceId))) return activities[activity.activity];
        const rest=State.variables.rest;
        if(unit&&rest?.activity?.unitId===unit.id&&!bathroom) {
            if(rest.activity.kind==='sit') return 'The bed frame creaks as you settle onto the mattress. Ventilation hums in the background.';
            if(rest.activity.kind==='wake') return 'Bedding rustles as you wake. The room is quiet except for a low ventilation hum.';
        }
        if(room) {
            if(room.kind==='bathroom') return 'The extractor fan hums softly.';
            if(rest?.activity?.unitId===room.id&&rest.activity.kind==='sit') return 'The bed frame creaks as you sit. A low ventilation hum fills the room.';
            return activities.quiet;
        }
        if(bathroom) return 'The extractor fan hums softly.';
        if(unit) return activities.quiet;
        if(map.id==='housing-office') return 'The ceiling lights give off a faint electrical hum.';
        if(map.interior) return 'A low ventilation hum carries through the quiet hallway.';
        const trees=map.trees||[];
        return trees.some(([x,y])=>Math.hypot(x-world.x,y-world.y)<=8)?(map.treeSounds||'A breeze rustles leaves in the nearby park.'):'A faint breeze brushes across the quiet grounds.';
    }
    function refresh() {
        const sound=document.getElementById('room-sounds');if(sound) sound.textContent=sounds();
        const description=document.getElementById('location-description'),{map,unit,room,bathroom}=current(),cabin=setup.vehicleCabin.current();
        if(cabin) {
            if(description) description.textContent=`You are seated inside ${cabin.car.name.toLowerCase()}. The parked vehicle has cabin storage separate from its trunk. Its engine is off.`;
            return;
        }
        if(description&&map) description.textContent=room?room.description:bathroom?'A compact bathroom with a toilet, tiled floor, and extractor fan.':unit?
            'A compact studio with a bed, dining table, kitchenette, and a separate bathroom.':map.description;
    }
    return {inside,current,unitVisible,cellVisible,objectVisible,mask,sounds,setActivity,refresh};
})();
$(document).on(':passagedisplay :timechange :interactionchange :roomchange :vehiclechange',()=>{if(document.querySelector('.world-sidebar')) setup.rooms.refresh();});
