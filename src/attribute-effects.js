/* Sensations are player-facing; raw environmental values stay in simulation.
   Equipped clothing and ambient temperature determine warmth sensations. */
setup.attributeEffects=(()=>{
    const descriptions={
        Freezing:'You feel freezing cold. Your fingers sting, and you long for warmth.',
        Cold:'You feel cold. Your skin prickles, and you want to find somewhere warmer.',
        Chilly:'You feel chilly. A little more warmth would be welcome.',
        Comfortable:'You feel comfortable, neither chilled nor overheated.',
        Warm:'You feel warm. Heat lingers beneath your clothing.',
        Hot:'You feel hot. Your clothing feels stifling, and you want somewhere cooler.',
        Overheating:'You feel as though you are overheating. Sweat gathers, and you want to cool down.'
    };
    function temperatureFeeling(value) {
        return descriptions[setup.warmth.calculate(State.variables.character,value).category];
    }
    function refresh() {
        const output=document.getElementById('attribute-effects');if(!output)return;
        const text=temperatureFeeling(setup.weather.temperature());
        if(output.textContent!==text)output.textContent=text;
    }
    return {temperatureFeeling,refresh};
})();
$(document).on(':passagedisplay :timechange :equipmentchange',setup.attributeEffects.refresh);
