/* Detailed paper-doll atlas. Body and three garments are independent cached
 * pixel layers. Color masks extract the clothes; the underwear base stays whole. */
setup.characterBody = (() => {
    const cache = new Map();
    const make = (w,h) => Object.assign(document.createElement('canvas'),{width:w,height:h});
    const skinPixel = (r,g,b) => r > 65 && r > g*1.18 && g > b*1.12;
    const opaque = (r,g,b,a) => a > 210 && !(r > g*2.8 && r > b*2.8);
    function extract(atlas,column,row,columns=6) {
        const key = `${atlas.id}:${column}:${row}`;
        if (cache.has(key)) return cache.get(key);
        const width = Math.floor(atlas.naturalWidth/columns), split = Math.round(atlas.naturalHeight*.5);
        const sy = row ? split : 0, height = row ? atlas.naturalHeight-split : split;
        const canvas = make(width,height), ctx = canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(atlas,column*atlas.naturalWidth/columns,sy,width,height,0,0,width,height);
        const image = ctx.getImageData(0,0,width,height), data = image.data;
        let left=width,right=0,top=height,bottom=0;
        for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
            const i=(y*width+x)*4;
            if(!opaque(...data.slice(i,i+4))) {data[i+3]=0;continue;}
            // Hard alpha and a limited palette prevent blurry edge pixels.
            data[i+3]=255;for(let c=0;c<3;c++) data[i+c]=Math.round(data[i+c]/8)*8;
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        }
        ctx.putImageData(image,0,0);
        const cropped=make(right-left+1,bottom-top+1);cropped.getContext('2d').drawImage(canvas,-left,-top);
        const pixels=cropped.getContext('2d').getImageData(0,0,cropped.width,cropped.height);
        let sum=0,count=0;
        for(let y=0;y<Math.min(10,cropped.height);y++) for(let x=0;x<cropped.width;x++) {
            const i=(y*cropped.width+x)*4;
            if(pixels.data[i+3] && skinPixel(...pixels.data.slice(i,i+3))) {sum+=x;count++;}
        }
        const result={id:key,canvas:cropped,pixels,neck:count?sum/count:cropped.width/2};cache.set(key,result);return result;
    }
    function layer(source, skin, garment) {
        const key = `${source.id}:${skin.join(',')}:${garment || 'base'}`;
        if(cache.has(key)) return cache.get(key);
        const canvas=make(source.canvas.width,source.canvas.height),ctx=canvas.getContext('2d');
        const image=new ImageData(new Uint8ClampedArray(source.pixels.data),canvas.width,canvas.height);
        const data=image.data;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
            const i=(y*canvas.width+x)*4;if(!data[i+3]) continue;
            const [r,g,b]=data.slice(i,i+3),warm=skinPixel(r,g,b);
            if(garment) {
                const fraction=y/canvas.height;
                const inBand=garment==='shirt'?fraction<.40:garment==='pants'?fraction>=.40 && fraction<.82:fraction>=.82;
                if(warm || !inBand) {data[i+3]=0;continue;}
                // Arm outlines are body pixels, not dangling shirt sleeves.
                if((garment==='shirt' || garment==='pants') && !(garment==='shirt' ? g>r*1.10 && b>r*1.12 : b>r*1.08 && b>=g)) {
                    let cloth=false;
                    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
                        const nx=x+dx,ny=y+dy;if(nx<0 || nx>=canvas.width || ny<0 || ny>=canvas.height) continue;
                        const p=(ny*canvas.width+nx)*4,s=source.pixels.data;
                        if(s[p+3] && (garment==='shirt' ? s[p+1]>s[p]*1.10 && s[p+2]>s[p]*1.12 : s[p+2]>s[p]*1.08 && s[p+2]>=s[p+1])) cloth=true;
                    }
                    if(!cloth) data[i+3]=0;
                }
            } else if(warm) {
                const shade=Math.max(.45,Math.min(1.25,(r*.3+g*.59+b*.11)/145));
                skin.forEach((value,c)=>data[i+c]=Math.round(value*shade/8)*8);
            }
        }
        ctx.putImageData(image,0,0);cache.set(key,canvas);return canvas;
    }
    function draw(body,clothes,character,neckY,skin,atlas,baseline,neckX,backpack) {
        // The original medium male art stays unchanged. Female art uses its own renderer.
        const base=extract(atlas,1,0), dressed=extract(atlas,1,1), key='Male-Medium';
        function paint(ctx,source,image) {
            const trim=Math.round(source.canvas.height*.045),sourceHeight=source.canvas.height-trim;
            const scale=(baseline-neckY)/sourceHeight;
            ctx.imageSmoothingEnabled=false;
            ctx.drawImage(image,0,trim,image.width,sourceHeight,Math.round(neckX-source.neck*scale),neckY,Math.round(source.canvas.width*scale),baseline-neckY);
        }
        const worn=setup.clothing.equipped(character);
        // Backpack sits behind the torso and uses crisp integer rectangles.
        if(worn.includes('backpack')) {
            const scale=(baseline-neckY)/base.canvas.height,left=Math.round(neckX-base.neck*scale)-10;
            const y=neckY+24;
            backpack.fillStyle='#1b2825';backpack.fillRect(left+4,y,25,98);backpack.fillRect(left,y+8,32,82);
            backpack.fillStyle='#3c5147';backpack.fillRect(left+3,y+8,26,82);backpack.fillRect(left+6,y+3,18,94);
            backpack.fillStyle='#587060';backpack.fillRect(left+5,y+10,5,73);
            backpack.fillStyle='#293c33';backpack.fillRect(left+12,y+12,15,42);backpack.fillRect(left+5,y+60,22,28);
            backpack.fillStyle='#6c7c64';backpack.fillRect(left+6,y+60,20,2);backpack.fillRect(left+25,y+12,2,40);
            backpack.fillStyle='#b2aa85';backpack.fillRect(left+20,y+61,3,5);backpack.fillRect(left+25,y+34,3,5);
            backpack.fillStyle='#1b2825';backpack.fillRect(left+10,y-4,12,4);

        }
        paint(body,base,layer(base,skin));
        for(const garment of ['shirt','pants','shoes']) if(worn.includes(garment)) {
            if(garment==='shoes') {
                clothes.save();clothes.translate(-2,1);paint(clothes,dressed,layer(dressed,skin,garment));clothes.restore();
                clothes.save();clothes.translate(2,1);paint(clothes,dressed,layer(dressed,skin,garment));clothes.restore();
            }
            paint(clothes,dressed,layer(dressed,skin,garment));
        }
        if(worn.includes('backpack')) {
            for(let y=0;y<58;y++) {
                const x=neckX-23-Math.round(y*.15);
                clothes.fillStyle='#26372d';clothes.fillRect(x,neckY+9+y,6,1);
                clothes.fillStyle='#627661';clothes.fillRect(x+1,neckY+9+y,3,1);
            }
            clothes.fillStyle='#aca484';clothes.fillRect(neckX-29,neckY+47,7,7);
            clothes.fillStyle='#324638';clothes.fillRect(neckX-27,neckY+48,3,4);
        }
        return key;
    }
    return {draw};
})();
