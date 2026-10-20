/* Modest courtyard scenery: deterministic pixels, independent of simulation. */
setup.courtyardPark=(()=>{
    function decorate(map) {
        map.parkScenery={
            shrubs:[[28,18],[29,18],[30,19],[40,18],[41,18],[43,19],[58,20],[59,21],[58,22],[28,31],[30,31],[31,30],[45,31],[46,31],[58,31],[59,30]],
            benches:[{x:34,y:31,facing:'north'},{x:50,y:18,facing:'south'}],
            barePatches:[{x:33,y:30,width:5,height:2},{x:49,y:18,width:5,height:2},{x:42,y:25,width:4,height:2},{x:55,y:30,width:2,height:2}]
        };
    }
    function paint(ctx,map,size) {
        const scenery=map.parkScenery;if(!scenery)return;
        const {park}=map,rect=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
        // Sparse, uneven grass; no geometric flowerbeds or manicured hedges.
        for(let y=park.y;y<park.y+park.height;y++)for(let x=park.x;x<park.x+park.width;x++) {
            if(map.tileAt(x,y).kind!=='park')continue;
            const seed=(x*73+y*151)%97,px=x*size,py=y*size;
            rect(seed%11===0?'#496244':'#456242',px+1,py+1,size-2,size-2);
            if(seed%5===0){rect('#66704c',px+3,py+9,5,2);rect('#536e48',px+10,py+4,2,4);}
            if(seed%7===0)rect('#737153',px+6,py+6,4,3);
        }
        for(const patch of scenery.barePatches) {
            const width=patch.width*size,height=patch.height*size,cx=patch.x*size+width/2;
            for(let row=3;row<height-2;row+=3) {
                const position=2*row/height-1,half=Math.floor(Math.sqrt(1-position*position)*width/8)*4;
                const ragged=(row%4)*2;
                rect(row%2?'#696b4c':'#706e4f',cx-half+ragged,patch.y*size+row,Math.max(2,half*2-ragged-3),3);
            }
        }
        for(const [x,y]of scenery.shrubs) {
            const px=x*size,py=y*size,variant=(x+y)%3;
            rect('#304733',px+2,py+10,13,5);
            rect('#3a5539',px+1,py+5,13,7);rect('#496442',px+3,py+2,9,9);
            rect('#5a7049',px+4,py+3,4,3);rect('#60744b',px+10,py+7,3,3);
            if(variant===0)rect('#7a7650',px+8,py+4,2,2);
        }
        for(const bench of scenery.benches) {
            const px=bench.x*size,py=bench.y*size,top=bench.facing==='north'?2:9;
            rect('#304334',px+1,py+11,46,4);
            rect('#333f3c',px+5,py+5,3,9);rect('#333f3c',px+37,py+5,3,9);
            rect('#7b7055',px+2,py+top,42,3);rect('#918064',px+2,py+6,42,3);
            rect('#5d5947',px+2,py+9,42,2);rect('#b19a71',px+12,py+6,8,1);
            rect('#514f42',px+29,py+6,2,3);
        }
        // Existing tree positions and their collision squares remain unchanged.
        for(const [x,y]of map.trees) {
            const px=x*size,py=y*size;
            rect('#2e4933',px-3,py+10,24,6);
            rect('#68553f',px+6,py+3,5,12);rect('#88704c',px+7,py+5,2,8);
            rect('#293e2f',px-5,py-11,25,14);rect('#344c33',px-9,py-7,32,14);
            rect('#425e3c',px-5,py-12,24,14);rect('#506c43',px-1,py-15,15,11);
            rect('#5c7549',px+1,py-12,7,4);rect('#3a5336',px+10,py-4,10,8);
            rect('#667a4c',px-4,py-5,5,3);rect('#304831',px+1,py+1,6,3);
        }
    }
    return {decorate,paint};
})();
