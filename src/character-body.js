/* Pixel geometry, not baked-in outfits. Six fits drive independent body and
 * clothing models. The common neck/head never moves between fits. */
setup.characterBody = (() => {
    function draw(bodyContext, clothingContext, character, neckY, skin) {
        const key = `${character.gender}-${character.bodySize}`;
        const fit = setup.clothing.fits[key];
        const female = character.gender === 'Female';
        const {shoulder: s, waist: w, hip: h, arm: a, leg: l} = fit;
        const bust = female ? {Small: 2, Medium: 4, Large: 6}[character.breastSize] : 0;
        // Work at half resolution so all contours are true two-pixel steps.
        const body = Object.assign(document.createElement('canvas'), {width: 72, height: 104});
        const clothes = Object.assign(document.createElement('canvas'), {width: 72, height: 104});
        const b = body.getContext('2d'), c = clothes.getContext('2d');
        const shade = factor => `rgb(${skin.map(value => Math.round(value * factor)).join(',')})`;
        function polygon(ctx, points, fill, outline = '#342f35') {
            ctx.beginPath();points.forEach(([x,y], i) => ctx[i ? 'lineTo' : 'moveTo'](Math.round((72+x)/2)+.5, Math.round((neckY+y)/2)+.5));
            ctx.closePath();ctx.fillStyle = fill;ctx.fill();ctx.strokeStyle = outline;ctx.lineWidth = 1;ctx.stroke();
        }
        const feet = 193 - neckY;
        const hipY = Math.round(feet * .52), kneeY = Math.round(feet * .78);
        const torso = [[-5,0],[5,0],[7,5],[s,10],[s+bust,24],[s+bust-2,30],[w,42],[h,hipY],[-h,hipY],[-w,42],[-s+2,26],[-s,10],[-7,5]];
        const leftArm = [[-s,11],[-s-a,19],[-s-a-2,48],[-s-a,62],[-s-a+4,62],[-s-a+5,49],[-s+3,24]];
        const rightArm = [[s-1,12],[s+a,22],[s+a+2,47],[s+a+1,61],[s+a-3,62],[s+a-5,47],[s-4,27]];
        const leftLeg = [[-h,hipY-3],[-1,hipY],[-3,kneeY],[-5,feet-5],[-l-7,feet-5],[-l-6,kneeY],[-h-1,hipY+8]];
        const rightLeg = [[0,hipY],[h,hipY-3],[h+1,hipY+8],[l+4,kneeY],[l+5,feet-5],[1,feet-5],[0,kneeY]];
        polygon(b,leftArm,shade(.84));polygon(b,rightArm,shade(1));
        polygon(b,leftLeg,shade(.85));polygon(b,rightLeg,shade(1));polygon(b,torso,shade(1));
        // Opaque base underwear remains when clothes are deselected.
        polygon(b,[[-h+1,hipY-9],[h-1,hipY-9],[h,hipY+3],[5,hipY+10],[-5,hipY+10],[-h,hipY+3]],'#494455');
        if (female) polygon(b,[[-s+1,20],[s+bust-1,20],[s+bust-2,31],[-s+3,31]],'#494455');
        else {
            polygon(b,[[-s+4,19],[-2,21],[-2,26],[-s+6,25]],shade(.88),shade(.88));
            polygon(b,[[1,21],[s-2,18],[s-3,26],[1,26]],shade(.91),shade(.91));
        }
        polygon(b,[[-l-7,feet-6],[-5,feet-6],[-1,feet],[-l-9,feet]],shade(.9));
        polygon(b,[[1,feet-6],[l+5,feet-6],[l+10,feet],[0,feet]],shade(1));
        const worn = character.clothing;
        if (worn.backpack) {
            polygon(c,[[-s-7,12],[-s+1,10],[-s+6,48],[-s-8,47],[-s-10,36]],'#4e6e65');
            polygon(c,[[-s-8,28],[-s-1,28],[-s,42],[-s-8,42]],'#37544e');
        }
        if (worn.shirt) {
            polygon(c,[[-s,10],[-s-a,17],[-s-a,28],[-s+1,30],[-s+4,21]],'#657d99');
            polygon(c,[[s-1,11],[s+a,18],[s+a,30],[s-3,30],[s-5,20]],'#819bb8');
            polygon(c,torso.slice(0,7).concat([[w+2,48],[-w-2,48],[-w,42],[-s+2,26],[-s,10],[-7,5]]),'#7891ad');
            polygon(c,[[-6,3],[5,3],[7,7],[1,11],[-5,8]],'#526b87');
            // Offset seam gives the same three-quarter direction as the head.
            polygon(c,[[-w+2,31],[-w+4,32],[-w+4,45],[-w+2,45]],'#657d99','#657d99');
        }
        if (worn.pants) {
            polygon(c,leftLeg,'#344252');polygon(c,rightLeg,'#435369');
            polygon(c,[[-w-2,46],[w+2,46],[h,hipY],[h,hipY+5],[2,hipY+9],[-h,hipY+5],[-h,hipY]],'#435369');
            polygon(c,[[-w-2,46],[w+2,46],[w+3,50],[-w-3,50]],'#2b3440');
            polygon(c,[[w-3,51],[w+1,52],[w,58],[w-4,58]],'#344252','#344252');
        }
        if (worn.shoes) {
            polygon(c,[[-l-7,feet-7],[-5,feet-7],[-1,feet],[-l-9,feet]],'#30343d');
            polygon(c,[[1,feet-7],[l+5,feet-7],[l+10,feet],[0,feet]],'#3c424d');
        }
        if (worn.backpack) polygon(c,[[-s+1,8],[-s+4,8],[-s+1,36],[-s-2,35]],'#395b51');
        bodyContext.imageSmoothingEnabled = clothingContext.imageSmoothingEnabled = false;
        bodyContext.drawImage(body,0,0,144,208);clothingContext.drawImage(clothes,0,0,144,208);
        return key;
    }
    return {draw};
})();
