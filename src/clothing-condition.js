/* Definitions hold maximums; worn records and item placements hold current
   durability. Missing legacy values mean fully intact. Reads never change saves. */
setup.clothingCondition=(()=>{
    const stages=['Intact','Worn','Tattered','Ragged','Broken'];
    const max=type=>setup.clothing.definitions[type]?.maxDurability??null;
    function value(type,current) {
        const limit=max(type);
        return limit===null?null:Math.max(0,Math.min(limit,Number.isFinite(current)?current:limit));
    }
    function current(slot,character=State.variables.character) {
        const type=character?.clothing?.[slot],record=character?.clothingDurability?.[slot];
        return value(type,record?.type===type?record.current:undefined);
    }
    function assign(slot,durability,character=State.variables.character) {
        const type=character.clothing[slot];
        character.clothingDurability={...character.clothingDurability,[slot]:{type,current:value(type,durability)}};
    }
    function stage(type,durability) {
        const limit=max(type),remaining=value(type,durability);
        if(limit===null)return 0;
        if(remaining<=0)return 4;
        if(remaining<=limit*.25)return 3;
        if(remaining<=limit*.5)return 2;
        if(remaining<=limit*.75)return 1;
        return 0;
    }
    function effectiveStat(type,stat,durability) {
        if(value(type,durability)===0&&['warmth','protection','stealth','waterProtection'].includes(stat))return 0;
        return setup.clothing.definitions[type]?.[stat]??0;
    }
    function describe(type,durability) {
        const limit=max(type),remaining=value(type,durability);
        return limit===null?'':`Durability: ${Number(remaining.toFixed(2))}/${limit} (${Number((remaining/limit*100).toFixed(1))}%) · ${stages[stage(type,remaining)]}`;
    }
    function set(slot,durability) {
        if(!State.variables.worldStarted||!Number.isFinite(durability)||max(State.variables.character?.clothing?.[slot])===null)
            return {ok:false,message:'Choose an equipped garment and a valid durability.'};
        assign(slot,durability);State.create(State.passage);
        $(document).trigger(':equipmentchange');$(document).trigger(':interactionchange');
        const type=State.variables.character.clothing[slot];
        return {ok:true,message:describe(type,current(slot))};
    }
    function damage(slot,amount) {
        if(!Number.isFinite(amount)||amount<0)return {ok:false,message:'Damage must be a nonnegative number.'};
        const durability=current(slot);return durability===null?{ok:false,message:'No clothing in that slot.'}:set(slot,durability-amount);
    }
    function render(ctx,character,slot,paint) {
        const type=character.clothing[slot],wear=stage(type,current(slot,character));
        if(!wear){paint(ctx);return;}
        const layer=document.createElement('canvas');layer.width=ctx.canvas.width;layer.height=ctx.canvas.height;
        const output=layer.getContext('2d');output.imageSmoothingEnabled=false;paint(output);
        const pixels=output.getImageData(0,0,layer.width,layer.height),data=pixels.data;
        const seed=[...type].reduce((sum,c)=>sum*31+c.charCodeAt(0),7)>>>0;
        // Stable pixel tears and fading affect only the isolated garment layer.
        for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){
            const i=(y*layer.width+x)*4;if(!data[i+3])continue;
            const hash=(Math.imul(Math.floor(x/13)+seed,374761393)^Math.imul(Math.floor(y/11)+1,668265263))>>>0;
            const localX=x%13,localY=y%11,tearY=3+Math.floor(localX/5);
            if(hash%100<wear*16&&localX>=2&&localX<=4+wear*2&&localY>=tearY&&localY<tearY+(wear>2?3:2)){data[i+3]=0;continue;}
            const gray=(data[i]+data[i+1]+data[i+2])/3;
            for(let c=0;c<3;c++)data[i+c]=Math.round((data[i+c]*(1-wear*.12)+gray*wear*.12)*(1-wear*.035));
        }
        output.putImageData(pixels,0,0);ctx.drawImage(layer,0,0);
    }
    return {max,value,current,assign,stage,effectiveStat,describe,set,damage,render};
})();
