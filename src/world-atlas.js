/* Region-level locations, independent of each area's walkable tile geometry. */
setup.worldAtlas = (() => {
    const locations=[{id:'apartments',name:'Apartments',x:.5,y:.5}];
    const current=()=>setup.worldMaps[State.variables.world?.mapId]?.worldArea||'apartments';
    function draw(canvas) {
        const width=Math.max(1,Math.round(canvas.clientWidth)||300),height=Math.max(1,Math.round(canvas.clientHeight)||300);
        if(canvas.width!==width) canvas.width=width;if(canvas.height!==height) canvas.height=height;
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,width,height);ctx.fillStyle='#142429';ctx.fillRect(0,0,width,height);
        ctx.strokeStyle='#b7d6c40b';ctx.lineWidth=1;
        for(let x=0;x<width;x+=30) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
        for(let y=0;y<height;y+=30) {ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
        for(const location of locations) {
            const x=location.x*width,y=location.y*Math.max(40,height-24),selected=location.id===current();
            if(selected) {ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fillStyle='#28443e';ctx.fill();ctx.strokeStyle='#bcf4d7';ctx.stroke();}
            ctx.fillStyle=selected?'#bcf4d7':'#7faaa0';ctx.fillRect(x-9,y-15,18,26);
            ctx.fillStyle='#19322d';for(const dx of [-5,2]) for(const dy of [-10,-3,4]) ctx.fillRect(x+dx,y+dy,3,3);
            ctx.fillStyle='#e0e9df';ctx.font='13px Arial';ctx.textAlign='center';ctx.fillText(location.name,x,y+45);
        }
        canvas.dataset.locationId=current();canvas.dataset.iconCount=locations.length;
        canvas.setAttribute('aria-label',`World map. Current area: ${locations.find(location=>location.id===current())?.name||current()}.`);
    }
    return {locations,current,draw};
})();
