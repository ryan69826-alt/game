/* Insulation from equipped clothes only. Empty weighted slots contribute zero;
   the fixed denominator prevents missing clothing from inflating the average. */
setup.warmth=(()=>{
    const weights=Object.freeze({top:3,bottoms:3,overtop:3,undertop:2,underbottoms:2,feet:2,hands:2,shoes:2,hat:1,facewear:1,wrists:1,ankles:1});
    const totalWeight=Object.values(weights).reduce((sum,weight)=>sum+weight,0);
    const climate=Object.freeze({coldF:0,hotF:100,coldRequirement:8,hotRequirement:2});
    function clothingBreakdown(character=State.variables.character) {
        const worn=character?.clothing||{};
        return Object.entries(weights).map(([slot,weight])=>{
            const type=worn[slot],value=setup.clothing.choices[slot].includes(type)&&type!=='none'?setup.clothing.definitions[type]?.warmth:null;
            const warmth=Number.isFinite(value)?Math.max(-1,Math.min(10,value)):0;
            return {slot,item:Number.isFinite(value)?setup.clothing.definitions[type].name:'Empty',warmth,weight,contribution:warmth*weight};
        });
    }
    function clothingAverage(character=State.variables.character) {
        return clothingBreakdown(character).reduce((sum,row)=>sum+row.contribution,0)/totalWeight;
    }
    const worldRequirement=(temperature=setup.weather.temperature())=>Math.max(climate.hotRequirement,Math.min(climate.coldRequirement,
        climate.coldRequirement-(climate.coldRequirement-climate.hotRequirement)*(temperature-climate.coldF)/(climate.hotF-climate.coldF)));
    function category(difference) {
        // Symmetric rounding fills the fractional gaps in the integer bands.
        const rounded=Math.sign(difference)*Math.round(Math.abs(difference));
        if(rounded<=-4)return 'Freezing';
        if(rounded<=-2)return 'Cold';
        if(rounded<=1)return 'Comfortable';
        if(rounded<=3)return 'Warm';
        return 'Overheating';
    }
    function calculate(character=State.variables.character,temperature=setup.weather.temperature()) {
        const clothing=clothingAverage(character),world=worldRequirement(temperature),difference=clothing-world;
        return {clothing,world,difference,category:category(difference)};
    }
    return {weights,totalWeight,climate,clothingBreakdown,clothingAverage,worldRequirement,category,calculate};
})();
