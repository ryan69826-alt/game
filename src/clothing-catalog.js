/* Spreadsheet catalog. Pocket [columns, rows] values are storage compartments;
   size is the provisional folded item footprint, independent of storage capacity. */
setup.clothingCatalog=(()=>{
    const rows=[
        ['plain-cap','Plain Cap','hat',5,[],[1,1],'cap','#4d6385'],
        ['beanie','Beanie','hat',7,[],[1,1],'beanie','#8b6055'],
        ['simple-glasses','Simple Glasses','facewear',-1,[],[1,1],'glasses','#8e9da4'],
        ['face-mask','Face Mask','facewear',4,[],[1,1],'mask','#8faeb2'],
        ['hoodie','Hoodie','overtop',6,[[1,2]],[2,2],'hoodie','#776a91'],
        ['jacket','Jacket','overtop',8,[],[2,2],'jacket','#785e4f'],
        ['rain-coat','Rain Coat','overtop',6,[],[2,3],'raincoat','#a99d51'],
        ['plain-shirt','Plain Shirt','top',4,[[1,1]],[2,2],'shirt','#b1b5aa'],
        ['t-shirt','T-Shirt','top',5,[[1,1]],[2,2],'tshirt','#718a99'],
        ['long-sleeve-shirt','Long Sleeve Shirt','top',6,[[1,1]],[2,2],'longsleeve','#8d6e65'],
        ['tank-top','Tank Top','top',3,[],[2,1],'tank','#829875'],
        ['undershirt','Undershirt','undertop',3,[],[2,1],'undershirt','#aab2a8'],
        ['sports-bra','Sports Bra','undertop',2,[[1,1]],[2,1],'bra','#7b829b'],
        ['plain-bra','Plain Bra','undertop',2,[[1,1]],[2,1],'bra','#a98f8c'],
        ['plain-tank-top','Plain Tank Top','undertop',3,[],[2,1],'tank','#a5a696'],
        ['basic-belt','Basic Belt','waist',2,[[2,1],[2,1],[1,1],[1,1]],[2,1],'belt','#73604a'],
        ['wristband','Wristband','wrists',1,[],[1,1],'wristband','#8e6966'],
        ['cheap-watch','Cheap Watch','wrists',-1,[],[1,1],'watch','#9ca39e'],
        ['light-gloves','Light Gloves','hands',5,[],[1,1],'gloves','#7c827b'],
        ['plain-pants','Plain Pants','bottoms',5,[[2,1],[2,1]],[2,2],'pants','#667c93'],
        ['shorts','Shorts','bottoms',3,[[2,1],[2,1]],[2,1],'shorts','#8a8270'],
        ['skirt','Skirt','bottoms',3,[[1,1],[1,1]],[2,2],'skirt','#806b87'],
        ['underwear','Underwear','underbottoms',3,[],[1,1],'underwear','#a7ada4'],
        ['boxers','Boxers','underbottoms',4,[],[1,1],'boxers','#75869a'],
        ['panties','Panties','underbottoms',2,[],[1,1],'panties','#aa8e9b'],
        ['ankle-bands','Ankle Bands','ankles',1,[],[1,1],'anklebands','#876a5b'],
        ['ankle-socks','Ankle Socks','feet',5,[],[1,1],'anklesocks','#abae9f'],
        ['plain-socks','Plain Socks','feet',4,[],[1,1],'socks','#9b9c93'],
        ['generic-shoes','Generic Shoes','shoes',5,[],[2,1],'shoes','#766f64'],
        ['sneakers','Sneakers','shoes',5,[],[2,1],'shoes','#829aa1'],
        ['boots','Boots','shoes',6,[],[2,2],'boots','#6c5748'],
        ['sandals','Sandals','shoes',2,[],[2,1],'sandals','#a9926d'],
        ['basic-backpack','Basic Backpack','storage',null,[[4,4]],[2,3],'backpack','#68816e'],
        ['fishing-pole','Fishing Pole','handheld',null,[],[1,4],'fishingpole','#9c8560']
    ];
    const items=rows.map(([id,name,slot,warmth,compartments,size,art,color])=>({id,name,slot,warmth,size,art,color,
        pockets:compartments.map(([columns,rows],index)=>({id:`worn:${id}:${index+1}`,name:`${name} · pocket ${index+1}`,columns,rows}))}));
    return {items};
})();
