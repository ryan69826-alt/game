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
    function draw(canvas) {
        const shown=visible(),here=find(current());
        const width=Math.max(1,Math.round(canvas.clientWidth)||300),height=Math.max(1,Math.round(canvas.clientHeight)||300);
        if(canvas.width!==width) canvas.width=width;if(canvas.height!==height) canvas.height=height;
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,width,height);ctx.fillStyle='#142429';ctx.fillRect(0,0,width,height);
        const margin=12,cell=Math.min((width-margin*2)/8,(height-margin*2)/7),left=(width-cell*8)/2,top=(height-cell*7)/2;
        for(let row=0;row<7;row++) for(let col=0;col<8;col++) {
            const x=left+col*cell,y=top+(6-row)*cell;
            ctx.strokeStyle='#b7d6c415';ctx.strokeRect(x,y,cell,cell);
        }
        for(const location of shown) {
            const x=left+location.column*cell,y=top+(6-location.row)*cell,selected=location.id===current();
            ctx.fillStyle=selected?'#bcf4d7':'#3b5c51';ctx.fillRect(x+1,y+1,cell-2,cell-2);
            ctx.fillStyle=selected?'#142429':'#e0e9df';ctx.font=`${Math.max(6,Math.min(11,cell*.48))}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(location.coordinate,x+cell/2,y+cell/2);
        }
        canvas.dataset.locationId=current();canvas.dataset.iconCount=shown.length;
        canvas.setAttribute('aria-label',`World map. Current area: ${here?.name||current()} (${here?.coordinate||''}). Discovered districts: ${shown.map(location=>`${location.coordinate} ${location.name}`).join('; ')}.`);
        const count=document.getElementById('world-map-count');if(count) count.textContent=`${shown.length} KNOWN`;
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
                else status.textContent=setup.worldMaps[location.id]?'Discovered':'Discovered · Not built yet';
                cell.append(status);
            } else {cell.setAttribute('aria-label','Uncharted');cell.classList.add('atlas-unknown');}
            grid.append(cell);
        }
        const legend=document.createElement('p');legend.className='atlas-note';legend.textContent='Highlighted: current district · Blank: uncharted. District tiles show relative position, not local map size.';
        body.append(note,grid,legend);Dialog.open();
    }
    return {locations,current,discover,visible,draw,open};
})();
