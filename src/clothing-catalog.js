/* Spreadsheet catalog. Pocket [columns, rows] values are storage compartments;
   size is the provisional folded item footprint, independent of storage capacity. */
setup.clothingCatalog=(()=>{
    // Whole-slot concealment for the initial closed/opaque outfit model.
    const coverage={
        hoodie:['top','undertop','waist','wrists'],jacket:['top','undertop','waist','wrists'],'rain-coat':['top','undertop','waist','wrists'],
        'plain-shirt':['undertop'],'t-shirt':['undertop'],'long-sleeve-shirt':['undertop','wrists'],'tank-top':['undertop'],
        'plain-pants':['underbottoms','ankles','feet'],shorts:['underbottoms'],skirt:['underbottoms'],
        'generic-shoes':['feet'],sneakers:['feet'],boots:['feet','ankles']
    };
    const rows=[
        ['plain-cap','Plain Cap','hat',5,[],[1,1],'cap','#4d6385',20,0,0,0,0,0,8],
        ['beanie','Beanie','hat',7,[],[1,1],'beanie','#8b6055',20,2,0,0,0,0,8],
        ['simple-glasses','Simple Glasses','facewear',-1,[],[1,1],'glasses','#8e9da4',10,-5,0,0,2,0,10],
        ['face-mask','Face Mask','facewear',4,[],[1,1],'mask','#8faeb2',10,5,0,0,0,-5,6],
        ['hoodie','Hoodie','overtop',6,[[1,2]],[2,2],'hoodie','#776a91',75,0,2,0,0,0,2],
        ['jacket','Jacket','overtop',8,[],[2,2],'jacket','#785e4f',75,0,2,1,0,0,2],
        ['rain-coat','Rain Coat','overtop',6,[],[2,3],'raincoat','#a99d51',75,-5,2,1,0,0,2],
        ['plain-shirt','Plain Shirt','top',4,[[1,1]],[2,2],'shirt','#b1b5aa',50,0,1,0,0,5,4],
        ['t-shirt','T-Shirt','top',5,[[1,1]],[2,2],'tshirt','#718a99',50,0,1,0,0,5,4],
        ['long-sleeve-shirt','Long Sleeve Shirt','top',6,[[1,1]],[2,2],'longsleeve','#8d6e65',60,5,1,0,0,0,4],
        ['tank-top','Tank Top','top',3,[],[2,1],'tank','#829875',40,-5,0,0,3,10,7],
        ['undershirt','Undershirt','undertop',3,[],[2,1],'undershirt','#aab2a8',40,0,0,0,2,10,7],
        ['sports-bra','Sports Bra','undertop',2,[[1,1]],[2,1],'bra','#7b829b',25,0,0,0,10,25,8],
        ['plain-bra','Plain Bra','undertop',2,[[1,1]],[2,1],'bra','#a98f8c',25,0,0,0,10,25,8],
        ['plain-tank-top','Plain Tank Top','undertop',3,[],[2,1],'tank','#a5a696',30,0,0,0,3,10,7],
        ['basic-belt','Basic Belt','waist',2,[[2,1],[2,1],[1,1],[1,1]],[2,1],'belt','#73604a',15,-10,0,0,0,-5,5],
        ['wristband','Wristband','wrists',1,[],[1,1],'wristband','#8e6966',5,0,0,0,1,0,9],
        ['cheap-watch','Cheap Watch','wrists',-1,[],[1,1],'watch','#9ca39e',10,-5,0,0,2,0,8],
        ['light-gloves','Light Gloves','hands',5,[],[1,1],'gloves','#7c827b',20,0,0,0,0,-5,3],
        ['plain-pants','Plain Pants','bottoms',5,[[2,1],[2,1]],[2,2],'pants','#667c93',75,5,2,0,0,0,3],
        ['shorts','Shorts','bottoms',3,[[2,1],[2,1]],[2,1],'shorts','#8a8270',50,-10,1,0,3,15,6],
        ['skirt','Skirt','bottoms',3,[[1,1],[1,1]],[2,2],'skirt','#806b87',50,-10,1,0,5,20,7],
        ['underwear','Underwear','underbottoms',3,[],[1,1],'underwear','#a7ada4',25,0,0,0,10,25,8],
        ['boxers','Boxers','underbottoms',4,[],[1,1],'boxers','#75869a',25,0,0,0,5,20,7],
        ['panties','Panties','underbottoms',2,[],[1,1],'panties','#aa8e9b',25,0,0,0,10,25,8],
        ['ankle-bands','Ankle Bands','ankles',1,[],[1,1],'anklebands','#876a5b',10,-5,0,0,2,0,7],
        ['ankle-socks','Ankle Socks','feet',5,[],[1,1],'anklesocks','#abae9f',20,0,0,0,0,2,7],
        ['plain-socks','Plain Socks','feet',4,[],[1,1],'socks','#9b9c93',20,0,0,0,0,0,7],
        ['generic-shoes','Generic Shoes','shoes',5,[],[2,1],'shoes','#766f64',30,-15,1,0,0,0,6],
        ['sneakers','Sneakers','shoes',5,[],[2,1],'shoes','#829aa1',30,-15,2,0,0,0,6],
        ['boots','Boots','shoes',6,[],[2,2],'boots','#6c5748',40,-20,3,0,0,-5,4],
        ['sandals','Sandals','shoes',2,[],[2,1],'sandals','#a9926d',20,-10,0,0,2,0,8],
        ['basic-backpack','Basic Backpack','storage',null,[[4,4]],[2,3],'backpack','#68816e',100,-30,0,0,0,-10,4],
        ['fishing-pole','Fishing Pole','handheld',null,[],[1,4],'fishingpole','#9c8560',100,-50,0,null,0,0,8]
    ];
    const items=rows.map(([id,name,slot,warmth,compartments,size,art,color,maxDurability,stealth,protection,waterProtection,allure,exposure,accessibility])=>({id,name,slot,warmth,size,art,color,maxDurability,stealth,protection,waterProtection,allure,exposure,accessibility,covers:coverage[id]||[],
        pockets:compartments.map(([columns,rows],index)=>({id:`worn:${id}:${index+1}`,name:`${name} · pocket ${index+1}`,columns,rows}))}));
    return {items};
})();
