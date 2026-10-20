/* Fixed adult bodysuit base and garment-only cells. All anchors use the base
 * sheet's coordinates; no garment depends on another garment being equipped. */
setup.characterFemale = (() => {
    const cache = new Map();
    const make = (w,h) => Object.assign(document.createElement('canvas'),{width:w,height:h});
    const targets = {
        shirt: {cell:1, crop:[224,132,176,188], fit:[224,139,176,188]},
        pants: {cell:2, crop:[177,273,182,388], fit:[207,303,175,366]},
        shoes: {cell:3, crop:[157,621,234,90], fit:[202,623,220,86]}
    };
    function cell(atlas, column, skin) {
        const key = `${column}:${skin.join(',')}`;
        if(cache.has(key)) return cache.get(key);
        const x = Math.round(column*atlas.naturalWidth/4);
        const width = Math.round((column+1)*atlas.naturalWidth/4)-x;
        const canvas = make(width,atlas.naturalHeight),ctx=canvas.getContext('2d');
        ctx.drawImage(atlas,x,0,width,canvas.height,0,0,width,canvas.height);
        const pixels=ctx.getImageData(0,0,width,canvas.height),data=pixels.data;
        for(let i=0;i<data.length;i+=4) {
            const [r,g,b,a]=data.slice(i,i+4);
            // Remove the export's colored matte fringe, retain solid outlines.
            if(a<211 || (r>g*2 && r>b*2) || (g>r*2 && g>b*1.5) || (b>r*2 && b>g*2)) {data[i+3]=0;continue;}
            data[i+3]=255;
            if(column===0 && r>g*1.08 && g>b*1.15 && r>65) {
                const shade=Math.max(.38,Math.min(1.3,(r*.3+g*.59+b*.11)/185));
                skin.forEach((value,c)=>data[i+c]=Math.round(value*shade));
            }
        }
        ctx.putImageData(pixels,0,0);cache.set(key,canvas);return canvas;
    }
    function draw(sources,layers,canvas,character,skin,eyes) {
        const source=sources['female-base-layers'],base=cell(source,0,skin);
        const scale=340/687,ox=86-199*scale,oy=46-21*scale;
        const X=x=>Math.round(ox+x*scale),Y=y=>Math.round(oy+y*scale);
        const neckY=Y(140),neckX=X(302),headTop=Y(21);
        const contexts=Object.fromEntries(Object.entries(layers).map(([name,layer])=>{
            const ctx=layer.getContext('2d');ctx.clearRect(0,0,layer.width,layer.height);ctx.imageSmoothingEnabled=false;
            return [name,ctx];
        }));
        // Head and body use the very same transform, preserving the original join.
        for(const [name,top,bottom] of [['head',0,neckY],['body',neckY,416]]) {
            const ctx=contexts[name];ctx.save();ctx.beginPath();ctx.rect(0,top,288,bottom-top);ctx.clip();
            ctx.drawImage(base,Math.round(ox),Math.round(oy),Math.round(base.width*scale),Math.round(base.height*scale));ctx.restore();
        }
        contexts.head.fillStyle=`rgb(${eyes.join(',')})`;
        for(const x of [324,357]) contexts.head.fillRect(X(x),Y(85),2,2);
        const worn=setup.clothing.equipped(character);
        if(worn.includes('backpack')||worn.includes('basic-backpack')) {
            const ctx=contexts.backpack,x=X(214),y=Y(165);
            ctx.fillStyle='#1b2825';ctx.fillRect(x-6,y,25,83);
            ctx.fillStyle='#3c5147';ctx.fillRect(x-4,y+3,21,77);
            ctx.fillStyle='#587060';ctx.fillRect(x-2,y+7,4,66);
            ctx.fillStyle='#293c33';ctx.fillRect(x+3,y+45,12,28);
            ctx.fillStyle='#b2aa85';ctx.fillRect(x+4,y+45,10,2);
        }
        function template(garment){
            const target=targets[garment],[x,y,w,h]=target.fit,result=make(288,416),ctx=result.getContext('2d');ctx.imageSmoothingEnabled=false;
            ctx.drawImage(cell(source,target.cell,skin),...target.crop,X(x),Y(y),Math.round(w*scale),Math.round(h*scale));return result;
        }
        for(const slot of ['underbottoms','undertop','feet','bottoms','top','waist','ankles','shoes','hands','wrists','overtop','handheld']){
            const garment=character.clothing[slot];
            if(targets[garment])contexts.clothing.drawImage(template(garment),0,0);
            else setup.clothingArt.draw(contexts.clothing,garment,template,X,Y,layers.body);
        }
        if(worn.includes('backpack')||worn.includes('basic-backpack')) {
            const ctx=contexts.clothing;ctx.fillStyle='#293c33';
            ctx.fillRect(X(259),Y(146),3,48);ctx.fillStyle='#6c7c64';ctx.fillRect(X(261),Y(150),1,42);
        }
        return {contexts,neckX,neckY,headTop,scale,X,Y,eye:{x:X(329),y:Y(85)},faceWidth:47,
            head:{faceLeft:0,faceWidth:76,eye:{y:64}},headLeft:X(289)};
    }
    return {draw};
})();
