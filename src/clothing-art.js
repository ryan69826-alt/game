/* Temporary pixel overlays for catalog equipment. Body artwork and anchors stay
   untouched; approved garment templates provide the fitted torso/leg outlines. */
setup.clothingArt=(()=>{
    const templates=new Map();
    function polygon(ctx,points,color){
        ctx.fillStyle=color;
        for(let y=Math.floor(Math.min(...points.map(p=>p[1])));y<=Math.ceil(Math.max(...points.map(p=>p[1])));y++){
            const crossings=[];
            for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))crossings.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
            crossings.sort((a,b)=>a-b);for(let i=0;i<crossings.length;i+=2)ctx.fillRect(Math.ceil(crossings[i]),y,Math.max(0,Math.floor(crossings[i+1])-Math.ceil(crossings[i])+1),1);
        }
    }
    function tinted(canvas,color){
        const result=document.createElement('canvas');result.width=canvas.width;result.height=canvas.height;
        const ctx=result.getContext('2d');ctx.drawImage(canvas,0,0);const pixels=ctx.getImageData(0,0,result.width,result.height);
        const rgb=color.match(/\w\w/g).map(n=>parseInt(n,16));
        for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3]){
            const light=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;
            if(light>36){const shade=Math.max(.45,Math.min(1.35,light/115));rgb.forEach((v,k)=>pixels.data[i+k]=Math.min(255,Math.round(v*shade)));}
        }
        ctx.putImageData(pixels,0,0);return result;
    }
    function draw(ctx,id,template,X,Y,bodyMask=null){
        const item=setup.clothing.definitions[id];if(!item?.art)return;
        if(bodyMask&&['gloves','wristband','watch','socks','anklesocks','anklebands'].includes(item.art)){
            const layer=document.createElement('canvas');layer.width=288;layer.height=416;const painted=layer.getContext('2d');
            draw(painted,id,template,X,Y);painted.globalCompositeOperation='destination-in';painted.drawImage(bodyMask,0,0);ctx.drawImage(layer,0,0);return;
        }
        const style=item.art,color=item.color,rect=(x,y,w,h,c=color)=>{ctx.fillStyle=c;ctx.fillRect(X(x),Y(y),Math.max(1,X(x+w)-X(x)),Math.max(1,Y(y+h)-Y(y)));};
        const shape=(points,c=color)=>polygon(ctx,points.map(([x,y])=>[X(x),Y(y)]),c);
        function fitted(basis,top=0,bottom=768,tank=false){
            ctx.save();ctx.beginPath();ctx.rect(0,Y(top),288,Y(bottom)-Y(top));ctx.clip();
            if(tank){ctx.beginPath();ctx.moveTo(X(270),Y(140));for(const [x,y]of [[296,158],[344,166],[367,145],[390,170],[390,320],[262,320]])ctx.lineTo(X(x),Y(y));ctx.closePath();ctx.clip();}
            const key=`${id}:${basis}`;if(!templates.has(key))templates.set(key,tinted(template(basis),color));
            ctx.drawImage(templates.get(key),0,0);ctx.restore();
        }
        if(['shirt','tshirt','longsleeve','undershirt','tank','bra','hoodie','jacket','raincoat'].includes(style)){
            if(['longsleeve','hoodie','jacket','raincoat'].includes(style)){
                shape([[235,202],[268,211],[247,303],[235,377],[205,375],[216,290]],'#263431');
                shape([[237,208],[263,215],[242,303],[231,371],[210,370],[221,290]]);
            }
            if(style==='raincoat')shape([[252,290],[377,290],[403,530],[220,530]],color);
            if(style==='bra')fitted('shirt',192,256);else fitted('shirt',0,768,['tank','undershirt'].includes(style));
            if(style==='bra'){rect(279,155,7,50);rect(361,165,7,40);rect(282,247,84,7);}
            if(['hoodie','jacket','raincoat'].includes(style)){rect(317,163,3,150,'#c4c1a9');rect(283,270,24,3,'#35413c');rect(334,270,24,3,'#35413c');}
        }else if(['pants','shorts','boxers','underwear','panties'].includes(style)){
            fitted('pants',0,style==='pants'?768:style==='shorts'?460:style==='boxers'?410:380);
        }else if(style==='skirt'){
            shape([[242,307],[350,307],[380,460],[207,460]],'#25312e');shape([[245,312],[346,312],[374,455],[213,455]]);rect(250,312,91,5,'#b0a1b2');
        }else if(['shoes','boots','sandals'].includes(style)){
            fitted('shoes');if(style==='sandals'){rect(223,666,40,5,'#c4ad83');rect(344,660,44,5,'#c4ad83');}
        }else if(['socks','anklesocks'].includes(style)){
            const top=style==='socks'?569:615;rect(224,top,37,649-top);rect(342,top,34,642-top);
        }else if(style==='belt'){
            rect(251,307,98,9,'#30352e');rect(253,309,92,5);rect(311,305,14,12,'#c9bd88');rect(314,308,8,6,'#514a37');
            for(const x of [260,286,331])rect(x,316,16,17);
        }else if(['wristband','watch','gloves'].includes(style)){
            if(style==='gloves'){rect(202,369,30,34);rect(397,358,32,40);}else{rect(210,354,23,8);if(style==='watch')rect(218,350,12,14,'#bcc5b9');}
        }else if(style==='anklebands'){rect(223,618,36,7);rect(342,612,34,7);}
        else if(style==='fishingpole'){
            rect(430,110,4,485,'#a89468');rect(416,374,17,14,'#7f8f8a');rect(450,112,1,410,'#718185');rect(434,110,17,2,'#718185');
        }
    }
    function foreground(ctx,character,model){
        const {X,Y}=model,hat=setup.clothing.definitions[character.clothing.hat],face=setup.clothing.definitions[character.clothing.facewear];
        if(hat?.art){const points=hat.art==='beanie'?[[271,32],[288,20],[337,21],[364,40],[365,62],[269,62]]:[[273,35],[294,23],[337,25],[361,45],[359,61],[271,61]];
            polygon(ctx,points.map(([x,y])=>[X(x),Y(y)]),'#26322e');polygon(ctx,points.map(([x,y])=>[X(x+2),Y(y+3)]),hat.color);
            ctx.fillStyle=hat.color;ctx.fillRect(X(277),Y(58),hat.art==='cap'?53:40,4);
        }
        if(face?.art==='glasses'){
            ctx.fillStyle='#384440';const y=Y(81);
            for(const x of [X(315),X(346)]){ctx.fillRect(x,y,10,1);ctx.fillRect(x,y+6,10,1);ctx.fillRect(x,y,1,7);ctx.fillRect(x+9,y,1,7);}
            ctx.fillRect(X(335),y+2,6,1);ctx.fillRect(X(294),y,10,1);
        }else if(face?.art==='mask')polygon(ctx,[[310,100],[365,97],[362,121],[330,129],[305,117]].map(([x,y])=>[X(x),Y(y)]),face.color);
    }
    return {draw,foreground};
})();
