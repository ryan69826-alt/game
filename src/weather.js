/* Saved seed, derived annual forecasts. Morning temperatures follow seasonal
   bands; adjacent days and year boundaries differ by at most five Fahrenheit. */
setup.weather=(()=>{
    const daySeconds=86400,halfDay=43200,cache=new Map();
    function legacySeed() {
        let seed=2166136261;
        for(const character of JSON.stringify(State.variables.character||{}))seed=Math.imul(seed^character.charCodeAt(0),16777619);
        return seed>>>0;
    }
    function ensure() {
        const old=State.variables.weather;
        if(old?.version!==1||!Number.isInteger(old.seed)||old.seed<0||old.seed>0xffffffff)
            State.variables.weather={version:1,seed:State.variables.worldStarted?legacySeed():Math.floor(Math.random()*0x100000000)};
        return State.variables.weather;
    }
    const midnight=(year,month=0,day=1)=>Date.UTC(year,month,day)/1000;
    function band(stamp) {
        const year=new Date(stamp*1000).getUTCFullYear(),length=(midnight(year+1)-midnight(year))/daySeconds;
        const center=50-25*Math.cos(2*Math.PI*(stamp-midnight(year,0,15))/daySeconds/length);
        return {min:center-12.5,max:center+12.5};
    }
    function random(seed,year,index) {
        let value=(seed^Math.imul(year,0x9e3779b1)^Math.imul(index+1,0x85ebca6b))>>>0;
        value=Math.imul(value^(value>>>16),0x7feb352d);value=Math.imul(value^(value>>>15),0x846ca68b);
        return ((value^(value>>>16))>>>0)/0x100000000;
    }
    function first(seed,year) {const range=band(midnight(year));return range.min+25*random(seed,year,0);}
    function yearForecast(year) {
        const seed=ensure().seed,key=`${seed}:${year}`;
        if(cache.has(key))return cache.get(key);
        const start=midnight(year),count=(midnight(year+1)-start)/daySeconds,next=first(seed,year+1),values=[first(seed,year)];
        for(let index=1;index<count;index++) {
            const range=band(start+index*daySeconds),remaining=count-index;
            // Leave a reachable path to next January's independently seeded first day.
            const min=Math.max(range.min,values[index-1]-5,next-remaining*5);
            const max=Math.min(range.max,values[index-1]+5,next+remaining*5);
            values.push(min+(max-min)*random(seed,year,index));
        }
        // Runtime caches never enter saves or SugarCube history; cap long journeys.
        if(cache.size>=8)cache.delete(cache.keys().next().value);
        Object.freeze(values);cache.set(key,values);return values;
    }
    function morning(stamp) {
        const year=new Date(stamp*1000).getUTCFullYear(),index=Math.floor((stamp-midnight(year))/daySeconds);
        return yearForecast(year)[index];
    }
    function temperature(stamp=setup.gameClock.now()) {
        const date=new Date(stamp*1000),today=midnight(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
        const sunrise=today+7*3600,sunset=today+19*3600;
        if(stamp<sunrise) {
            const previous=morning(today-daySeconds)+10,current=morning(today);
            return previous+(current-previous)*(stamp-(sunset-daySeconds))/halfDay;
        }
        const current=morning(today);
        if(stamp<=sunset)return current+10*(stamp-sunrise)/halfDay;
        return current+10+(morning(today+daySeconds)-current-10)*(stamp-sunset)/halfDay;
    }
    return {ensure,band,yearForecast,morning,temperature};
})();

// Initialize migrated saves before the next history moment captures variables.
$(document).on(':passageinit.weather',()=>{if(State.variables.worldStarted)setup.weather.ensure();});
