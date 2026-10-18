/* Layered runtime renderer: 16 body cells + palette swaps + aligned hair layers.
 * Head, body, and hair are independent canvases. Only height changes their
 * common geometry; body composition and model selection never reposition head.
 * Atlases and canvas objects are never stored in SugarCube's save data.
 */
setup.characterPreview = (() => {
    const SKIN = {Pale: [231,190,165], Tan: [183,119,75], Olive: [166,145,95], Dark: [99,61,45]};
    const HAIR = {Blonde: [210,176,97], Black: [37,31,35], Brown: [89,55,36], Orange: [190,94,35], Gray: [151,153,160]};
    const EYES = {Blue: [83,155,220], Green: [92,165,104], Brown: [113,72,40]};
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
            if(a<80) continue;
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
            if(a>110 && hairPixel(r,g,b)) {
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
        sharedHead={canvas,pixels,eyePoints,faceWidth:faceRight-faceLeft+1,neckX:(left+right)/2,neckWidth:right-left+1,
            fullHeight:source.canvas.height,eye:eyeAnchor(source.pixels,source.canvas.width,source.canvas.height)};
        return sharedHead;
    }
    function neckAnchor(cell) {
        if(cell.neck) return cell.neck;
        const {width,height}=cell.canvas;
        for(let y=0;y<height*.15;y++) {
            const xs=[];
            for(let x=0;x<width;x++) {
                const i=(y*width+x)*4;
                if(cell.pixels.data[i+3]>180 && skinPixel(...cell.pixels.data.slice(i,i+3))) xs.push(x);
            }
            if(xs.length>=5) {
                const width=xs.at(-1)-xs[0]+1;
                // Trim the redundant upper neck; the shared head already
                // contains its own lower neck pixels.
                cell.neck={x:(xs[0]+xs.at(-1))/2,y:y+Math.round(width*.45),width};
                return cell.neck;
            }
        }
        throw new Error('Body sprite has no neck attachment point');
    }
    function clearLayer(canvas) {
        const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.imageSmoothingEnabled=false;return ctx;
    }
    function draw(sources, layers, canvas, character) {
        const fat=setup.character.choices.bodyFat.indexOf(character.bodyFat);
        const muscle=setup.character.choices.muscleMass.indexOf(character.muscleMass);
        const model=character.gender==='Female'?`female-${character.breastSize.toLowerCase()}`:'male-bodies';
        const cell=bodyCell(sources[model],fat,muscle),head=headPart(sources['head-reference']);
        const bodyContext=clearLayer(layers.body),headContext=clearLayer(layers.head),hairContext=clearLayer(layers.hair);
        const baseline=193,height=Math.round(166*character.heightInches/84);
        const headScale=height/head.fullHeight*.72,headWidth=Math.round(head.canvas.width*headScale);
        const headHeight=Math.round(head.canvas.height*headScale),headTop=baseline-height;
        const neckX=72,headLeft=Math.round(neckX-head.neckX*headScale);
        const neckY=headTop+headHeight-2;
        // Each body is attached below the same neck and stretched only to the
        // same foot baseline. No selected body bounds affect head geometry.
        const neck=neckAnchor(cell),bodyScale=(baseline-neckY)/(cell.canvas.height-neck.y);
        const bodyLeft=Math.round(neckX-neck.x*bodyScale),bodyTop=neckY-neck.y*bodyScale;
        bodyContext.save();bodyContext.beginPath();bodyContext.rect(0,neckY,canvas.width,canvas.height-neckY);bodyContext.clip();
        bodyContext.drawImage(tintedBody(cell,character),bodyLeft,Math.round(bodyTop),Math.round(cell.canvas.width*bodyScale),Math.round(cell.canvas.height*bodyScale));
        // A short skin bridge overlaps both layers, hiding the atlas neck cap
        // and smoothly tapering the body neck into the shared head's neck.
        const upper=Math.max(4,Math.round(head.neckWidth*headScale)/2);
        const lower=Math.max(3,Math.round(neck.width*bodyScale)/2);
        bodyContext.fillStyle=`rgb(${SKIN[character.skinTone].join(',')})`;
        bodyContext.beginPath();bodyContext.moveTo(neckX-upper,neckY);bodyContext.lineTo(neckX+upper,neckY);
        bodyContext.lineTo(neckX+lower,neckY+4);bodyContext.lineTo(neckX-lower,neckY+4);bodyContext.closePath();bodyContext.fill();
        bodyContext.restore();
        headContext.drawImage(tintedBody(head,character,true),headLeft,headTop,headWidth,headHeight);
        // Preserve a one-pixel iris when nearest-neighbor downsampling would
        // otherwise discard every source iris pixel on the smaller head.
        headContext.fillStyle=`rgb(${EYES[character.eyeColor].join(',')})`;
        for(const eye of head.eyePoints) headContext.fillRect(Math.round(headLeft+eye.x*headScale),Math.round(headTop+eye.y*headScale),1,1);
        const destination={x:headLeft+head.eye.x*headScale,y:headTop+head.eye.y*headScale};
        const longHair=['Chest','Waist','Knee','Floor'].includes(character.hairLength);
        const hair=hairLayer(sources[longHair?'long-hair-atlas':'hair-atlas'],character.hairLength,character.hairColor,longHair);
        const bounds=drawHair(hairContext,hair.canvas,hair,destination,head.faceWidth*headScale,neckY,baseline,character.hairLength);
        canvas.dataset.hairBounds=JSON.stringify(bounds);
        canvas.dataset.headHeight=headHeight;
        canvas.dataset.figureHeight=height;
        const ctx=clearLayer(canvas);
        for(const layer of [layers.body,layers.head,layers.hair]) ctx.drawImage(layer,0,0);
        const breast=character.gender==='Female'?`, ${character.breastSize.toLowerCase()} breast size`:'';
        canvas.setAttribute('aria-label',`Adult ${character.gender.toLowerCase()} model, ${setup.character.heightLabel(character.heightInches)}, ${character.bodyFat.toLowerCase()} body fat, ${character.muscleMass.toLowerCase()} muscle${breast}, ${character.skinTone.toLowerCase()} skin, ${character.eyeColor.toLowerCase()} eyes, ${character.hairColor.toLowerCase()} ${character.hairLength.toLowerCase()} hair.`);
        canvas.dataset.variation=`${model}-${fat}-${muscle}`;
        canvas.dataset.neckY=neckY;
        canvas.dataset.neckX=neckX;
    }
    return {draw};
})();
