/* Layered runtime renderer: fixed bases + separate clothing + aligned hair.
 * Head, body, clothing, and hair are independent canvases. Body fit and
 * equipment never reposition the shared head or change the foot baseline.
 * Atlases and canvas objects are never stored in SugarCube's save data.
 */
setup.characterPreview = (() => {
    const SKIN = {Pale: [231,190,165], Tan: [183,119,75], Olive: [166,145,95], Dark: [99,61,45]};
    const HAIR = {Blonde: [210,176,97], Black: [37,31,35], Brown: [89,55,36], Orange: [190,94,35], Gray: [151,153,160]};
    const EYES = {Blue: [83,155,220], Green: [92,165,104], Brown: [113,72,40]};
    const HEAD_SCALE = .79;
    const cache = new Map();
    const hairCache = new Map();
    const hairRowSplits = new Map();
    const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), {width:w, height:h});
    const skinPixel = (r,g,b) => r > 65 && r > g * 1.18 && g > b * 1.12;

    function bodyCell(atlas, fat, muscle) {
        const index = `${atlas.id}-${fat}-${muscle}`;
        if (cache.has(index)) return cache.get(index);
        const cw = atlas.naturalWidth / 4, ch = atlas.naturalHeight / 4;
        const cell = makeCanvas(Math.floor(cw), Math.floor(ch));
        const ctx = cell.getContext('2d', {willReadFrequently:true});
        ctx.drawImage(atlas, muscle*cw, fat*ch, cw, ch, 0, 0, cell.width, cell.height);
        const data = ctx.getImageData(0,0,cell.width,cell.height);
        let left=cell.width, right=0, top=cell.height, bottom=0;
        for (let y=0; y<cell.height; y++) for (let x=0; x<cell.width; x++) {
            if (data.data[(y*cell.width+x)*4+3] > 180) {
                left=Math.min(left,x); right=Math.max(right,x);
                top=Math.min(top,y); bottom=Math.max(bottom,y);
            }
        }
        const width=right-left+1, height=bottom-top+1;
        const cropped=makeCanvas(width,height);
        cropped.getContext('2d').drawImage(cell,left,top,width,height,0,0,width,height);
        const pixels=cropped.getContext('2d').getImageData(0,0,width,height);
        const result={canvas:cropped, pixels};
        cache.set(index,result);
        return result;
    }

    function tintedBody(cell, character, includeEyes=false) {
        const canvas=makeCanvas(cell.canvas.width,cell.canvas.height);
        const ctx=canvas.getContext('2d');
        const pixels=new ImageData(new Uint8ClampedArray(cell.pixels.data),canvas.width,canvas.height);
        const skin=SKIN[character.skinTone], eye=EYES[character.eyeColor];
        for(let i=0; i<pixels.data.length; i+=4) {
            const [r,g,b,a]=pixels.data.slice(i,i+4);
            if(a<180) {pixels.data[i+3]=0;continue;}
            pixels.data[i+3]=255;
            if(skinPixel(r,g,b)) {
                const shade=Math.max(.48,Math.min(1.22,(r*.3+g*.59+b*.11)/130));
                skin.forEach((v,k)=>pixels.data[i+k]=Math.round(v*shade));
            } else if(includeEyes && b>r*1.12 && b>=g*.95 && g>70) {
                eye.forEach((v,k)=>pixels.data[i+k]=v);
            }
        }
        ctx.putImageData(pixels,0,0);
        return canvas;
    }

    const hairPixel = (r,g,b) => r>65 && b>55 && r>g*1.45 && b>g*1.35 && b>r*.5;
    const eyePixel = (r,g,b) => b>r*1.12 && b>=g*.95 && g>70;
    function eyeAnchor(pixels, width, height, fraction=.25) {
        let xSum=0,ySum=0,count=0;
        for(let y=0;y<height*fraction;y++) for(let x=0;x<width;x++) {
            const i=(y*width+x)*4;
            if(pixels.data[i+3]>150 && eyePixel(...pixels.data.slice(i,i+3))) {
                xSum+=x;ySum+=y;count++;
            }
        }
        if(!count) throw new Error('Missing eye alignment anchor in sprite artwork');
        return {x:xSum/count,y:ySum/count};
    }
    function hairLayer(atlas, length, color, longHair=false) {
        const lengths=longHair?['Chest','Waist','Knee','Floor']:setup.character.choices.hairLength;
        const index=lengths.indexOf(length),key=`${atlas.id}-${index}-${color}`;
        if(hairCache.has(key)) return hairCache.get(key);
        if(!hairRowSplits.has(atlas.id)) {
            const sample=makeCanvas(atlas.naturalWidth,atlas.naturalHeight);
            const context=sample.getContext('2d');context.drawImage(atlas,0,0);
            const data=context.getImageData(0,0,sample.width,sample.height).data;
            let start=0,bestStart=0,bestLength=0;
            for(let y=Math.floor(sample.height*.32);y<sample.height*.58;y++) {
                let opaque=0;
                for(let x=0;x<sample.width;x++) if(data[(y*sample.width+x)*4+3]>180) opaque++;
                if(opaque<8) {
                    if(!start) start=y;
                    if(y-start+1>bestLength) {bestStart=start;bestLength=y-start+1;}
                } else start=0;
            }
            if(!bestLength) throw new Error('Missing hair atlas row gutter');
            hairRowSplits.set(atlas.id,Math.round(bestStart+bestLength/2));
        }
        const columns=longHair?2:4,cw=atlas.naturalWidth/columns,split=hairRowSplits.get(atlas.id);
        const sy=index<columns?0:split,ch=index<columns?split:atlas.naturalHeight-split;
        const cell=makeCanvas(Math.floor(cw),Math.floor(ch)),ctx=cell.getContext('2d');
        ctx.drawImage(atlas,(index%columns)*cw,sy,cw,ch,0,0,cell.width,cell.height);
        const pixels=ctx.getImageData(0,0,cell.width,cell.height);
        const eye=eyeAnchor(pixels,cell.width,cell.height,longHair?1:.25);
        // Skin beside the eyes measures the head, independent of hair length.
        let faceLeft=cell.width,faceRight=0;
        for(let y=Math.max(0,Math.floor(eye.y-ch*.035));y<Math.min(cell.height,eye.y+ch*.035);y++) for(let x=0;x<cell.width;x++) {
            const i=(y*cell.width+x)*4;
            if(pixels.data[i+3]>180 && skinPixel(...pixels.data.slice(i,i+3))) {faceLeft=Math.min(faceLeft,x);faceRight=Math.max(faceRight,x);}
        }
        const faceWidth=faceRight-faceLeft+1,cut=Math.round(eye.y+faceWidth*.65);
        const rgb=HAIR[color];let bottom=0,left=cell.width,right=0,top=cell.height;
        for(let i=0;i<pixels.data.length;i+=4) {
            const [r,g,b,a]=pixels.data.slice(i,i+4);
            if(a>180 && hairPixel(r,g,b)) {
                pixels.data[i+3]=255;
                const y=Math.floor(i/4/cell.width),x=i/4%cell.width;
                bottom=Math.max(bottom,y);top=Math.min(top,y);left=Math.min(left,x);right=Math.max(right,x);
                const shade=Math.max(.4,Math.min(1.4,(r*.3+g*.59+b*.11)/115));
                rgb.forEach((v,k)=>pixels.data[i+k]=Math.min(255,Math.round(v*shade)));
            } else pixels.data[i+3]=0;
        }
        // Complete curtains have no baked-in arm/body holes. Preserve their
        // natural outlines instead of cutting rectangular strips from the left.
        ctx.putImageData(pixels,0,0);
        const result={canvas:cell,eye,faceWidth,cut,bottom,bounds:{left,right,top,bottom},longHair};
        hairCache.set(key,result);return result;
    }
    function drawHair(ctx, image, hair, destination, faceWidth, neckY, baseline, length) {
        // Head fit and length are independent. Long hair stretches only BELOW
        // the neck; shrinking the head never shortens it or shifts the scalp.
        const scale=faceWidth/hair.faceWidth;
        const x=destination.x-hair.eye.x*scale,y=destination.y-hair.eye.y*scale;
        if(!hair.longHair) {
            ctx.drawImage(image,Math.round(x),Math.round(y),Math.round(image.width*scale),Math.round(image.height*scale));
            return {left:x+hair.bounds.left*scale,right:x+hair.bounds.right*scale,end:y+hair.bottom*scale};
        }
        const topY=Math.round(y),upperHeight=Math.round(hair.cut*scale);
        const cutY=topY+upperHeight;
        const fraction={Chest:.25,Waist:.43,Knee:.75,Floor:1}[length];
        const end=neckY+(baseline-neckY)*fraction;
        const lowerScale=(end-cutY)/(hair.bottom-hair.cut);
        ctx.drawImage(image,0,0,image.width,hair.cut,Math.round(x),topY,Math.round(image.width*scale),upperHeight);
        ctx.drawImage(image,0,hair.cut,image.width,image.height-hair.cut,Math.round(x),cutY,Math.round(image.width*scale),Math.round((image.height-hair.cut)*lowerScale));
        return {left:x+hair.bounds.left*scale,right:x+hair.bounds.right*scale,end};
    }

    let sharedHead;
    function headPart(reference) {
        if(sharedHead) return sharedHead;
        // Extract one canonical adult head ONCE from the original approved art.
        // It is never taken from the changing body sprites.
        const source=bodyCell(reference,0,0);
        const cut=Math.round(source.canvas.height*.213);
        const canvas=makeCanvas(source.canvas.width,cut);
        canvas.getContext('2d').drawImage(source.canvas,0,0);
        const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
        let left=canvas.width,right=0;
        for(let y=cut-5;y<cut-1;y++) for(let x=0;x<canvas.width;x++) {
            const i=(y*canvas.width+x)*4;
            if(pixels.data[i+3]>180 && skinPixel(...pixels.data.slice(i,i+3))) {left=Math.min(left,x);right=Math.max(right,x);}
        }
        const eye=eyeAnchor(source.pixels,source.canvas.width,source.canvas.height);
        let faceLeft=canvas.width,faceRight=0;
        for(let y=Math.floor(eye.y-source.canvas.height*.025);y<eye.y+source.canvas.height*.025;y++) for(let x=0;x<canvas.width;x++) {
            const i=(y*canvas.width+x)*4;
            if(pixels.data[i+3]>180 && skinPixel(...pixels.data.slice(i,i+3))) {faceLeft=Math.min(faceLeft,x);faceRight=Math.max(faceRight,x);}
        }
        const eyePixels=[];
        for(let y=0;y<cut;y++) for(let x=0;x<canvas.width;x++) {
            const i=(y*canvas.width+x)*4;
            if(pixels.data[i+3]>150 && eyePixel(...pixels.data.slice(i,i+3))) eyePixels.push({x,y});
        }
        const eyeColumns=[...new Set(eyePixels.map(pixel=>pixel.x))].sort((a,b)=>a-b),groups=[];
        for(const x of eyeColumns) {
            if(!groups.length || x-groups.at(-1).at(-1)>2) groups.push([]);
            groups.at(-1).push(x);
        }
        const eyePoints=groups.map(columns=>{
            const points=eyePixels.filter(point=>columns.includes(point.x));
            return {x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
        });
        sharedHead={canvas,pixels,eyePoints,faceLeft,faceWidth:faceRight-faceLeft+1,neckX:(left+right)/2,neckWidth:right-left+1,
            fullHeight:source.canvas.height,eye:eyeAnchor(source.pixels,source.canvas.width,source.canvas.height)};
        return sharedHead;
    }
    function clearLayer(canvas) {
        const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.imageSmoothingEnabled=false;return ctx;
    }
    function keepFaceVisible(hairContext, headCanvas, head, headLeft, headTop, headScale) {
        // Hair templates and the shared head have different jaw/nose outlines.
        // Respect the actual rendered face instead of trusting the template's
        // transparent face opening. Leave fringe/temple hair above the brows.
        const faceX=Math.floor(headLeft+(head.faceLeft+head.faceWidth*.25)*headScale);
        const browY=Math.floor(headTop+(head.eye.y-head.faceWidth*.14)*headScale);
        const mask=makeCanvas(headCanvas.width,headCanvas.height),ctx=mask.getContext('2d');
        const pixels=headCanvas.getContext('2d').getImageData(0,0,mask.width,mask.height);
        for(let y=0;y<mask.height;y++) for(let x=0;x<mask.width;x++) {
            const i=(y*mask.width+x)*4;
            pixels.data[i+3]=x>=faceX && y>=browY && pixels.data[i+3]>20?255:0;
        }
        ctx.putImageData(pixels,0,0);
        hairContext.save();hairContext.globalCompositeOperation='destination-out';
        hairContext.drawImage(mask,0,0);hairContext.restore();
    }
    function draw(sources, layers, canvas, character) {
        if(character.gender==='Female') {
            const model=setup.characterFemale.draw(sources,layers,canvas,character,SKIN[character.skinTone],EYES[character.eyeColor]);
            const {contexts,neckX,neckY,headTop,eye,faceWidth}=model;
            let bounds={left:0,right:0,end:0};
            if(character.hairLength!=='Shaved') {
                const longHair=['Chest','Waist','Knee','Floor'].includes(character.hairLength);
                const hair=hairLayer(sources[longHair?'long-hair-atlas':'hair-atlas'],character.hairLength,character.hairColor,longHair);
                bounds=drawHair(contexts.hair,hair.canvas,hair,eye,faceWidth,neckY,386,character.hairLength);
                keepFaceVisible(contexts.hair,layers.head,model.head,model.headLeft,headTop,model.scale);
            }
            const ctx=clearLayer(canvas);
            for(const name of ['backpack','body','clothing','head','hair']) ctx.drawImage(layers[name],0,0);
            setup.clothingArt.foreground(ctx,character,model);
            Object.assign(canvas.dataset,{hairBounds:JSON.stringify(bounds),headHeight:neckY-headTop,figureHeight:340,
                variation:'Female-Fixed',clothingFit:'Female-Fixed',neckX,neckY});
            canvas.setAttribute('aria-label',`Adult female bodysuit base, ${character.skinTone.toLowerCase()} skin, ${character.eyeColor.toLowerCase()} eyes, ${character.hairColor.toLowerCase()} ${character.hairLength.toLowerCase()} hair.`);
            return;
        }
        const head=headPart(sources['head-reference']);
        const backpackContext=clearLayer(layers.backpack),bodyContext=clearLayer(layers.body),clothingContext=clearLayer(layers.clothing),headContext=clearLayer(layers.head),hairContext=clearLayer(layers.hair);
        const baseline=386,height=320;
        const headScale=height/head.fullHeight*HEAD_SCALE,headWidth=Math.round(head.canvas.width*headScale);
        const headHeight=Math.round(head.canvas.height*headScale),headTop=baseline-height;
        const neckX=144,headLeft=Math.round(neckX-head.neckX*headScale);
        const neckY=headTop+headHeight-4;
        const model=setup.characterBody.draw(bodyContext,clothingContext,character,neckY,SKIN[character.skinTone],sources['paper-dolls'],baseline,neckX,backpackContext);
        // Cover the common neck joint with the exact shared skin palette.
        const upper=Math.max(4,Math.round(head.neckWidth*headScale/2));
        bodyContext.fillStyle=`rgb(${SKIN[character.skinTone].join(',')})`;
        bodyContext.fillRect(neckX-upper,neckY,upper*2,4);
        headContext.drawImage(tintedBody(head,character,true),headLeft,headTop,headWidth,headHeight);
        // Preserve a one-pixel iris when nearest-neighbor downsampling would
        // otherwise discard every source iris pixel on the smaller head.
        headContext.fillStyle=`rgb(${EYES[character.eyeColor].join(',')})`;
        for(const eye of head.eyePoints) headContext.fillRect(Math.round(headLeft+eye.x*headScale),Math.round(headTop+eye.y*headScale),1,1);
        const destination={x:headLeft+head.eye.x*headScale,y:headTop+head.eye.y*headScale};
        const longHair=['Chest','Waist','Knee','Floor'].includes(character.hairLength);
        const hair=hairLayer(sources[longHair?'long-hair-atlas':'hair-atlas'],character.hairLength,character.hairColor,longHair);
        const bounds=drawHair(hairContext,hair.canvas,hair,destination,head.faceWidth*headScale,neckY,baseline,character.hairLength);
        keepFaceVisible(hairContext,layers.head,head,headLeft,headTop,headScale);
        canvas.dataset.hairBounds=JSON.stringify(bounds);
        canvas.dataset.headHeight=headHeight;
        canvas.dataset.figureHeight=height;
        const ctx=clearLayer(canvas);
        ctx.drawImage(layers.backpack,0,0);ctx.drawImage(layers.body,0,0);
        // Soles occlude the bare toes; the underlying body remains independent.
        if(setup.clothing.equipped(character).includes('shoes')) ctx.clearRect(0,baseline-8,canvas.width,canvas.height-baseline+8);
        for(const layer of [layers.clothing,layers.head,layers.hair]) ctx.drawImage(layer,0,0);
        canvas.setAttribute('aria-label',`Adult ${character.gender.toLowerCase()} model, fixed base, ${character.skinTone.toLowerCase()} skin, ${character.eyeColor.toLowerCase()} eyes, ${character.hairColor.toLowerCase()} ${character.hairLength.toLowerCase()} hair.`);
        canvas.dataset.variation=model;
        canvas.dataset.clothingFit=model;
        canvas.dataset.neckY=neckY;
        canvas.dataset.neckX=neckX;
    }
    return {draw};
})();
