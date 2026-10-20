/* Pointer dragging keeps a pixel-sized item under the grab point. No save data
 * changes until a valid drop; cancellation and dialog/navigation cleanup are free. */
setup.inventoryDrag = (() => {
    function mount(root,trunkId,onDrop) {
        const lifetime = new AbortController();let active=null,ghost=null,highlight=null,suppressed=false,frame=0;
        function clear() {
            cancelAnimationFrame(frame);frame=0;
            ghost?.remove();ghost=null;
            highlight?.classList.remove('drop-valid','drop-invalid');highlight=null;
            if(active && root.hasPointerCapture(active.pointerId)) root.releasePointerCapture(active.pointerId);
            active?.element.classList.remove('is-dragging');active=null;
            document.documentElement.classList.remove('inventory-dragging');
        }
        function destination(event) {
            const node=document.elementFromPoint(event.clientX,event.clientY);
            const item=active.from.startsWith('equipped:')?setup.equipment.preview(active.from.slice(9)):setup.inventory.placements({id:active.from}).find(item=>item.id===active.id);
            const character=node?.closest('[data-character-equip]');
            if(character&&root.contains(character)) {
                const slot=item&&setup.equipment.slotFor(item.type);
                return {grid:character,kind:'equip',valid:!!slot&&!active.from.startsWith('equipped:')&&State.variables.character.clothing[slot]==='none'};
            }
            const equip=node?.closest('[data-equip-slot]');
            if(equip&&root.contains(equip)) return {grid:equip,kind:'equip',valid:!!item&&!active.from.startsWith('equipped:')&&setup.equipment.slotFor(item.type)===equip.dataset.equipSlot&&State.variables.character.clothing[equip.dataset.equipSlot]==='none'};
            const map=document.getElementById('local-map'),bounds=map?.getBoundingClientRect();
            const onMap=node?.id==='ui-overlay'&&bounds&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
            const ground=node?.closest('[data-ground-drop],#local-map')||(onMap?map:null);
            if(ground) {const container=setup.groundItems.current();return {grid:ground,kind:'ground',valid:!!item&&!!container&&!!setup.inventory.firstFit(container,item,setup.inventory.placements(container))};}
            const grid=node?.closest('.inventory-grid');
            if(!grid||!root.contains(grid)) return null;
            const rect=grid.getBoundingClientRect(),gap=Number.parseFloat(getComputedStyle(grid).gap)||0;
            const columns=Number(grid.dataset.columns),rows=Number(grid.dataset.rows);
            const x=Math.round((event.clientX-active.offsetX-rect.left)/((rect.width+gap)/columns));
            const y=Math.round((event.clientY-active.offsetY-rect.top)/((rect.height+gap)/rows));
            const container=setup.inventory.accessible(trunkId)?.find(value=>value.id===grid.dataset.storageId);
            const ownPocket=active.from.startsWith('equipped:')&&item&&setup.clothing.definitions[item.type].pockets.some(pocket=>pocket.id===container?.id);
            const valid=!!(container&&item&&!ownPocket&&setup.inventory.fits(container,item,x,y,active.from===container.id?item.id:null));
            return {grid,container,x,y,valid};
        }

        root.addEventListener('pointerdown',event=>{
            const element=event.target.closest('.inventory-item');
            if(!element || event.button!==0 || !event.isPrimary) return;
            clear();const rect=element.getBoundingClientRect();
            active={id:element.dataset.item,from:element.closest('[data-container]').dataset.container,element,
                startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,started:false,pointerId:event.pointerId};
        },{signal:lifetime.signal});
        document.addEventListener('pointermove',event=>{
            if(!active || event.pointerId!==active.pointerId) return;
            if(!active.started && Math.hypot(event.clientX-active.startX,event.clientY-active.startY)<4) return;
            event.preventDefault();
            if(!active.started) {
                active.started=true;root.setPointerCapture(active.pointerId);ghost=active.element.cloneNode(true);ghost.className='inventory-item inventory-drag-ghost';
                ghost.removeAttribute('data-item');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
                ghost.style.width=`${active.width}px`;ghost.style.height=`${active.height}px`;document.body.append(ghost);
                active.element.classList.add('is-dragging');document.documentElement.classList.add('inventory-dragging');
            }
            active.lastY=event.clientY;
            if(!frame) {
                const scroll=()=>{
                    if(!active?.started) return;
                    const bounds=root.getBoundingClientRect();
                    const delta=active.lastY<bounds.top+40?-8:active.lastY>bounds.bottom-40?8:0;
                    if(delta) root.scrollTop+=delta;
                    frame=requestAnimationFrame(scroll);
                };frame=requestAnimationFrame(scroll);
            }
            ghost.style.left=`${event.clientX-active.offsetX}px`;ghost.style.top=`${event.clientY-active.offsetY}px`;
            highlight?.classList.remove('drop-valid','drop-invalid');
            const target=destination(event);highlight=target?.grid || null;
            highlight?.classList.add(target.valid?'drop-valid':'drop-invalid');ghost.dataset.valid=String(!!target?.valid);
        },{signal:lifetime.signal,passive:false});
        document.addEventListener('pointerup',event=>{
            if(!active || event.pointerId!==active.pointerId) return;
            if(!active.started) {clear();return;}
            const target=destination(event),source={...active};
            suppressed=true;setTimeout(()=>{suppressed=false;},0);
            clear();event.preventDefault();
            if(target?.kind==='ground') {onDrop(setup.equipment.drop(source.from,source.id,trunkId));return;}
            if(target?.kind==='equip') {onDrop(target.valid?setup.equipment.equip(source.from,source.id,trunkId):{ok:false,message:'Use an empty matching clothing slot.'});return;}
            if(!target?.container) {onDrop({ok:false,message:'Drop onto a storage grid. The item stays where it was.'});return;}
            onDrop(setup.equipment.move(source.from,target.container.id,source.id,target.x,target.y,trunkId));
        },{signal:lifetime.signal});
        const cancel=()=>clear();
        document.addEventListener('pointercancel',cancel,{signal:lifetime.signal});
        window.addEventListener('blur',cancel,{signal:lifetime.signal});
        document.addEventListener('visibilitychange',()=>{if(document.hidden) clear();},{signal:lifetime.signal});
        document.addEventListener('keydown',event=>{if(event.key==='Escape') clear();},{signal:lifetime.signal});
        const destroy=()=>{clear();lifetime.abort();$(document).off('.inventoryDrag');};
        $(document).off('.inventoryDrag').one(':dialogclosed.inventoryDrag :passageinit.inventoryDrag',destroy);
        return {ignoreClick:()=>suppressed,destroy};
    }
    return {mount};
})();
