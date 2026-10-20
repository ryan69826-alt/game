/* Discovery is saved independently of local map geometry and interior visibility. */
setup.worldAtlas = (() => {
    const locations=setup.districts;
    const current=()=>setup.worldMaps[State.variables.world?.mapId]?.worldArea||'apartments';
    const find=id=>locations.find(location=>location.id===id);
    function discover() {
        const previous=State.variables.worldDiscovery;
        const clean=values=>Array.isArray(values)?values.filter(id=>find(id)):[];
        const discovered=new Set(clean(previous?.discovered)),visited=new Set(clean(previous?.visited));
        const here=find(current());
        if(here) {
            visited.add(here.id);
            for(const location of locations) if(Math.abs(location.column-here.column)+Math.abs(location.row-here.row)<=1) discovered.add(location.id);
        }
        State.variables.worldDiscovery={version:1,discovered:[...discovered],visited:[...visited]};
        return State.variables.worldDiscovery;
    }
    const visible=()=>{const known=discover().discovered;return locations.filter(location=>known.includes(location.id));};
    const connections=(id=current())=>Object.values(setup.worldMaps[id]?.exits||{}).map(exit=>typeof exit==='string'?exit:exit.mapId).filter(id=>setup.worldMaps[id]);
    function draw(canvas) {
        const known=visible(),here=find(current());if(!here)return;
        const shown=known.filter(location=>Math.abs(location.column-here.column)<=1&&Math.abs(location.row-here.row)<=1);
        const routes=connections(),width=Math.max(1,Math.round(canvas.clientWidth)||300),height=Math.max(1,Math.round(canvas.clientHeight)||300);
        if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
        const ctx=canvas.getContext('2d'),step=Math.min(width/3.15,height/3.15),nodeW=step*.78,nodeH=step*.62;
        const position=location=>({x:width/2+(location.column-here.column)*step,y:height/2-(location.row-here.row)*step});
        ctx.clearRect(0,0,width,height);ctx.fillStyle='#142429';ctx.fillRect(0,0,width,height);
        for(const location of shown.filter(location=>routes.includes(location.id))) {
            const p=position(location);ctx.strokeStyle='#84b8a2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(width/2,height/2);ctx.lineTo(p.x,p.y);ctx.stroke();
        }
        for(const location of shown) {
            const p=position(location),selected=location.id===here.id,accessible=routes.includes(location.id);
            ctx.fillStyle=selected?'#bcf4d7':accessible?'#35594e':'#26373d';ctx.fillRect(p.x-nodeW/2,p.y-nodeH/2,nodeW,nodeH);
            ctx.strokeStyle=selected?'#dffff0':accessible?'#84b8a2':'#53626a';ctx.strokeRect(p.x-nodeW/2,p.y-nodeH/2,nodeW,nodeH);
            ctx.fillStyle=selected?'#142429':accessible?'#e0e9df':'#99a8aa';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.font=`bold ${Math.max(10,step*.23)}px Arial`;ctx.fillText(location.coordinate,p.x,p.y-nodeH*.17);
            ctx.font=`${Math.max(7,Math.min(10,step*.14))}px Arial`;
            const short=location.name==='Warehouse/Storage'?'Storage':location.name==='Transit Area w/ Shops'?'Transit':location.name==='Low Density Housing'?'Housing':location.name==='Executive Offices'?'Executive':location.name;
            ctx.fillText(short,p.x,p.y+nodeH*.23,nodeW-6);
        }
        canvas.dataset.locationId=current();canvas.dataset.iconCount=shown.length;canvas.dataset.visibleIds=shown.map(l=>l.id).join(',');canvas.dataset.connectionIds=routes.join(',');canvas.dataset.zoom='neighborhood';
        canvas.setAttribute('aria-label',`World map. Current area: ${here.name} (${here.coordinate}). Direct routes: ${routes.map(id=>find(id)?.coordinate||id).join(', ')||'none'}. Discovered districts: ${known.map(location=>`${location.coordinate} ${location.name}`).join('; ')}.`);
        const caption=document.getElementById('world-map-location');if(caption)caption.textContent=`${here.coordinate} · ${here.name}`;
        const count=document.getElementById('world-map-count');if(count)count.textContent=`${known.length} KNOWN`;
    }
    function open() {
        const shown=visible(),known=new Set(shown.map(location=>location.id));
        Dialog.setup('World map','atlas-window');
        const body=Dialog.body();body.replaceChildren();
        const note=document.createElement('p');note.className='atlas-note';
        note.textContent='Your current district reveals its north, south, east and west neighbors. Discovered districts remain on your map.';
        const grid=document.createElement('div');grid.className='atlas-grid';grid.setAttribute('aria-label','District grid, north at the top');
        for(let row=6;row>=0;row--) for(let column=0;column<8;column++) {
            const location=locations.find(item=>item.column===column&&item.row===row),cell=document.createElement('div');
            cell.className='atlas-cell';
            if(location&&known.has(location.id)) {
                cell.dataset.districtId=location.id;
                const coordinate=document.createElement('strong');coordinate.textContent=location.coordinate;
                const label=document.createElement('span');label.textContent=location.name;cell.append(coordinate,label);
                const status=document.createElement('small');
                if(location.id===current()) {cell.classList.add('atlas-current');status.textContent='You are here';}
                else status.textContent=connections().includes(location.id)?'Direct route':setup.worldMaps[location.id]?'Discovered · No direct route':'Not built yet · No direct route';
                cell.append(status);
            } else {cell.setAttribute('aria-label','Uncharted');cell.classList.add('atlas-unknown');}
            grid.append(cell);
        }
        const legend=document.createElement('p');legend.className='atlas-note';legend.textContent='Highlighted: current district · Lines on the sidebar map: direct routes · Blank: uncharted. Discovery does not grant access.';
        body.append(note,grid,legend);Dialog.open();
    }
    return {locations,current,discover,visible,connections,draw,open};
})();
