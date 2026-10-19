/* Current visibility, not a remembered floor-plan reveal. Hidden cells never
 * expose their terrain or furniture, and hidden objects cannot be interacted with. */
setup.rooms = (() => {
    const inside=(rect,x,y)=>x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height;
    const atDoor=(door,world)=>Math.abs(door.x-world.x)+Math.abs(door.y-world.y)<=1;
    function current(world=State.variables.world) {
        const map=setup.worldMaps[world?.mapId];
        const unit=map?.units?.find(unit=>inside(unit.bounds,world.x,world.y)||unit.door.x===world.x&&unit.door.y===world.y);
        return {map,unit,bathroom:!!unit&&(inside(unit.bathroom,world.x,world.y)||unit.bathroomDoor.x===world.x&&unit.bathroomDoor.y===world.y)};
    }
    function unitVisible(unit,world=State.variables.world) {
        return inside(unit.bounds,world.x,world.y)||
            atDoor(unit.door,world)&&setup.interactions.isOpen(`unit-door-${unit.id}`,world.mapId);
    }
    function cellVisible(map,x,y,world=State.variables.world) {
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
    const activities={quiet:'Only the steady ventilation and faint city traffic are audible.',
        music:'Music plays nearby, its rhythm carrying through the room.',
        conversation:'Low voices and occasional laughter drift through the room.',
        plumbing:'Water runs through the pipes, followed by a faint metallic tick.',
        work:'Tools tap and scrape nearby, punctuated by brief pauses.'};
    function setActivity(mapId,roomId,activity) {
        const map=setup.worldMaps[mapId];
        if(!map||!Object.hasOwn(activities,activity)||!['hall','office',...(map.units||[]).flatMap(unit=>[unit.id,`${unit.id}:bathroom`])].includes(roomId)) return false;
        State.variables.roomActivities={...State.variables.roomActivities,[`${mapId}:${roomId}`]:activity};
        State.create(State.passage);$(document).trigger(':roomchange');return true;
    }
    function sounds(world=State.variables.world) {
        const {map,unit,bathroom}=current(world);if(!map) return '';
        const id=unit?unit.id+(bathroom?':bathroom':''):map.id==='housing-office'?'office':'hall';
        const activity=State.variables.roomActivities?.[`${map.id}:${id}`];
        if(activity&&Object.hasOwn(activities,activity)) return activities[activity];
        const rest=State.variables.rest;
        if(unit&&rest?.activity?.unitId===unit.id&&!bathroom) {
            if(rest.activity.kind==='sit') return 'The bed frame creaks as you settle onto the mattress. Ventilation hums in the background.';
            if(rest.activity.kind==='wake') return 'Bedding rustles as you wake. Beyond it, the room is quiet except for ventilation and distant traffic.';
        }
        if(bathroom) return 'The extractor fan hums softly; a pipe occasionally ticks behind the wall.';
        if(unit) return activities.quiet;
        if(map.id==='housing-office') return 'Keys tap at the reception desk. Paper rustles beneath the hum of the ceiling lights.';
        return map.interior?'Your footsteps echo along the hallway, accompanied by a low ventilation hum.':'Distant traffic rolls past, with leaves rustling in the central park.';
    }
    function refresh() {
        const sound=document.getElementById('room-sounds');if(sound) sound.textContent=sounds();
        const description=document.getElementById('location-description'),{map,unit,bathroom}=current();
        if(description&&map) description.textContent=bathroom?'A compact bathroom with a toilet, tiled floor, and extractor fan.':unit?
            'A compact studio with a bed, dining table, kitchenette, and a separate bathroom.':map.description;
    }
    return {inside,current,unitVisible,cellVisible,objectVisible,mask,sounds,setActivity,refresh};
})();
$(document).on(':passagedisplay :timechange :interactionchange :roomchange',()=>{if(document.querySelector('.world-sidebar')) setup.rooms.refresh();});
