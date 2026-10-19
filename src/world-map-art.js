/* Stateless tile artwork for local outdoor and interior maps. */
setup.worldMapArt=(()=>{
    function paint(map) {
        const tileSize=16;
        const terrain = document.createElement('canvas');terrain.width = map.width * tileSize;terrain.height = map.height * tileSize;
        const terrainContext = terrain.getContext('2d');
        const colors = {track:'#29353d',platform:'#a4a18b',train:'#779aa3',tunnel:'#162029',fence:'#87969a',shutter:'#9e9ca4',kiosk:'#72c4c4',ground: '#293e35', park: '#416444', road: '#3b4750', parking: '#47525a',
            pavement: '#66736c', path: '#889182', building: '#536b70', entrance: '#dfb777', tree: '#204b35', car: '#47525a', median: '#416444', wall:'#26373f',floor:'#5b665c',hall:'#7c8270',bathroom:'#7f9995',furniture:'#65584b',npc:'#5c9bb1'};
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            const {kind} = map.tileAt(x, y), px = x * tileSize, py = y * tileSize;
            terrainContext.fillStyle = colors[kind];terrainContext.fillRect(px, py, tileSize, tileSize);
            terrainContext.strokeStyle = '#b7d6c41b';terrainContext.lineWidth = .6;terrainContext.strokeRect(px, py, tileSize, tileSize);
            if(kind==='fence') {terrainContext.fillStyle='#273c42';terrainContext.fillRect(px+3,py+3,10,10);terrainContext.strokeStyle='#a4b8b5';terrainContext.beginPath();terrainContext.moveTo(px,py);terrainContext.lineTo(px+16,py+16);terrainContext.stroke();}
            else if (kind === 'tree') {
                terrainContext.fillStyle = '#6e9170';terrainContext.fillRect(px + 4, py + 3, 8, 9);
            } else if (kind === 'road') {
                const centerY = map.roads.horizontal.y + Math.floor(map.roads.horizontal.height / 2);
                const centerX = map.roads.vertical.x + Math.floor(map.roads.vertical.width / 2);
                terrainContext.fillStyle = '#98a99b';
                if (x >= (map.roads.horizontal.markingsStartX || 0) && y === centerY && x % 3 === 0 && (x < map.roads.vertical.x || x >= map.roads.vertical.x + map.roads.vertical.width)) terrainContext.fillRect(px + 3, py + 7, 10, 2);
                if (x === centerX && y % 3 === 0 && y < map.roads.horizontal.y) terrainContext.fillRect(px + 7, py + 3, 2, 10);
            }
        }
        if(map.rail) {
            const rail=map.rail,x=rail.x*tileSize,y=rail.y*tileSize,w=rail.width*tileSize;
            terrainContext.fillStyle='#685d4e';for(let xx=x;xx<x+w;xx+=12)terrainContext.fillRect(xx,y+8,3,56);
            terrainContext.fillStyle='#b4bdba';terrainContext.fillRect(x,y+16,w,3);terrainContext.fillRect(x,y+52,w,3);
            for(const tunnel of map.tunnels||[]) {const tx=tunnel.x*tileSize,ty=tunnel.y*tileSize,tw=tunnel.width*tileSize,th=tunnel.height*tileSize;terrainContext.fillStyle='#4b5a61';terrainContext.fillRect(tx,ty,tw,th);terrainContext.fillStyle='#101a22';terrainContext.fillRect(tx+8,ty+18,tw-16,th-28);terrainContext.fillStyle='#7e918f';terrainContext.fillRect(tx+8,ty+9,tw-16,4);}
        }
        if(map.platform) {
            const platform=map.platform;terrainContext.fillStyle='#d9bf6c';
            for(let x=platform.x*tileSize;x<(platform.x+platform.width)*tileSize;x+=8)terrainContext.fillRect(x,(platform.y+platform.height)*tileSize-5,4,3);
        }
        // Draw complete bays and vehicles once, rather than a mark per tile.
        terrainContext.strokeStyle = '#b2bdb2';terrainContext.lineWidth = 1;
        for (const bay of map.parkingBays || []) {
            const x = bay.x * tileSize, y = bay.y * tileSize, w = bay.width * tileSize, h = bay.height * tileSize;
            const opensSouth = bay.facing === 'north';
            terrainContext.beginPath();
            terrainContext.moveTo(x, opensSouth ? y + h : y);terrainContext.lineTo(x, opensSouth ? y : y + h);
            terrainContext.lineTo(x + w, opensSouth ? y : y + h);terrainContext.lineTo(x + w, opensSouth ? y + h : y);
            terrainContext.stroke();
        }
        const median = map.parking?.median;
        if(median) {
            terrainContext.strokeStyle = '#9aaa8b';
            terrainContext.strokeRect(median.x * tileSize + 1, median.y * tileSize + 1, median.width * tileSize - 2, median.height * tileSize - 2);
            for (let x = median.x; x < median.x + median.width; x += 2) {
                terrainContext.fillStyle = '#5c8056';terrainContext.fillRect(x * tileSize + 8, median.y * tileSize + 8, 16, 16);
            }
        }
        for (const car of map.cars || []) {
            terrainContext.save();
            terrainContext.translate((car.x+1)*tileSize,(car.y+1)*tileSize);
            terrainContext.rotate(setup.vehicles.angle(car));terrainContext.translate(-tileSize,-tileSize);
            terrainContext.fillStyle = '#17282c';
            for (const wx of [2, 26]) for (const wy of [6, 22]) terrainContext.fillRect(wx, wy, 4, 6);
            terrainContext.fillStyle = car.color;terrainContext.fillRect(5, 2, 22, 28);
            terrainContext.fillStyle = '#273e49';terrainContext.fillRect(8, 7, 16, 6);terrainContext.fillRect(8, 22, 16, 5);
            terrainContext.fillStyle = '#e9e3ba';terrainContext.fillRect(7, 3, 4, 2);terrainContext.fillRect(21, 3, 4, 2);
            terrainContext.fillStyle = '#b66a61';terrainContext.fillRect(7, 28, 4, 2);terrainContext.fillRect(21, 28, 4, 2);
            terrainContext.restore();
        }
        [...map.buildings, ...(map.housingOffice?[map.housingOffice]:[])].forEach((building, i) => {
            terrainContext.strokeStyle = '#9bb7b4';terrainContext.lineWidth = 2;
            terrainContext.strokeRect((building.x + .5) * tileSize, (building.y + .5) * tileSize, (building.width - 1) * tileSize, (building.height - 1) * tileSize);
            terrainContext.fillStyle = '#dbe5dd';terrainContext.font = 'bold 20px monospace';terrainContext.textAlign = 'center';
            terrainContext.font=building.label?'bold 13px monospace':'bold 20px monospace';
            terrainContext.fillText(building.label||`0${i + 1}`, (building.x + building.width / 2) * tileSize, (building.y + building.height / 2) * tileSize + 7);
        });
        for(const label of map.labels||[]) {terrainContext.fillStyle='#dbe5dd';terrainContext.font='bold 10px monospace';terrainContext.textAlign='center';terrainContext.fillText(label.text,label.x*tileSize,label.y*tileSize);}
        const furnitureColors={bed:'#657e9b',kitchen:'#b5ac86',table:'#907451',bath:'#d5ddd2',desk:'#9a7e55',seat:'#526c7a',cabinet:'#87978a'};
        for(const item of map.furniture||[]) {
            const x=item.x*tileSize,y=item.y*tileSize;
            terrainContext.save();
            terrainContext.translate(x+item.width*tileSize/2,y+item.height*tileSize/2);
            terrainContext.rotate((item.rotation||0)*Math.PI/2);
            const sideways=(item.rotation||0)%2,w=(sideways?item.height:item.width)*tileSize,h=(sideways?item.width:item.height)*tileSize;
            terrainContext.translate(-w/2,-h/2);
            terrainContext.fillStyle='#25353a';terrainContext.fillRect(1,1,w-2,h-2);
            terrainContext.fillStyle=furnitureColors[item.style]||'#907451';terrainContext.fillRect(3,3,w-6,h-6);
            if(item.style==='bed') {terrainContext.fillStyle='#d6d7c4';terrainContext.fillRect(4,4,w-8,8);}
            terrainContext.restore();
        }
        if(map.train) {
            const train=map.train,x=train.x*tileSize,y=train.y*tileSize,w=train.width*tileSize,h=train.height*tileSize,carWidth=Math.floor(w/3);
            terrainContext.fillStyle='#0f2028';terrainContext.fillRect(x,y,w,h);
            for(let car=0;car<3;car++) {
                const cx=x+car*carWidth;terrainContext.fillStyle='#779aa3';terrainContext.fillRect(cx+3,y+5,carWidth-6,h-10);
                terrainContext.fillStyle='#a9c1c4';terrainContext.fillRect(cx+7,y+12,carWidth-14,h-24);
                terrainContext.fillStyle='#263f4b';for(let wx=cx+12;wx<cx+carWidth-14;wx+=22){terrainContext.fillRect(wx,y+7,14,8);terrainContext.fillRect(wx,y+h-15,14,8);}
                terrainContext.fillStyle='#d3bb77';terrainContext.fillRect(cx+Math.floor(carWidth/2)-5,y+3,10,15);
            }
            terrainContext.fillStyle='#dde5cf';terrainContext.fillRect(x+4,y+20,3,7);terrainContext.fillRect(x+w-7,y+20,3,7);
        }
        for(const unit of map.units||[]) {
            terrainContext.fillStyle='#e2e5d6';terrainContext.font='bold 12px monospace';terrainContext.textAlign='center';
            terrainContext.fillText(String(unit.number),(unit.anchor.x+.5)*tileSize,(unit.anchor.y+.5)*tileSize+4);
            const hall=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>({x:unit.door.x+dx,y:unit.door.y+dy})).find(p=>map.tileAt(p.x,p.y).kind==='hall');
            if(hall) terrainContext.fillText(String(unit.number),(hall.x+.5)*tileSize,(hall.y+.5)*tileSize+4);
        }
        for(const npc of (map.interactables||[]).filter(object=>object.kind==='npc')) {
            const x=(npc.x+.5)*tileSize,y=(npc.y+.5)*tileSize;
            terrainContext.fillStyle='#9cd7ea';terrainContext.fillRect(x-4,y-5,8,10);
            terrainContext.fillStyle='#e7dec3';terrainContext.fillRect(x-3,y-6,6,4);
        }
        return terrain;
    }
    return {paint};
})();
