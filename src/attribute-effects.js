/* Sensations are player-facing; raw environmental values stay in simulation.
   Clothing insulation, body heat and mechanical penalties can build on this later. */
setup.attributeEffects=(()=>{
    function temperatureFeeling(value) {
        if(value<=32)return 'You feel freezing cold. Your fingers sting, and you long for warmth.';
        if(value<45)return 'You feel cold. Your skin prickles, and you want to find somewhere warmer.';
        if(value<60)return 'You feel cool. A lingering chill makes you want another layer.';
        if(value<75)return 'You feel comfortable in the mild air.';
        if(value<85)return 'You feel warm. The air leaves a little heat on your skin.';
        if(value<95)return 'You feel hot. Sweat starts to gather, and you want to cool down.';
        return 'You feel sweltering hot. The heat is oppressive, and you long for somewhere cooler.';
    }
    function refresh() {
        const output=document.getElementById('attribute-effects');if(!output)return;
        const text=temperatureFeeling(setup.weather.temperature());
        if(output.textContent!==text)output.textContent=text;
    }
    return {temperatureFeeling,refresh};
})();
$(document).on(':passagedisplay :timechange',setup.attributeEffects.refresh);
