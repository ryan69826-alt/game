/* A deterministic Gregorian game calendar. UTC is used as a neutral game
 * timezone so browser locale, daylight saving, and the real clock cannot drift it. */
setup.gameClock = (() => {
    const starts=[
        {date:'2026-03-20',name:'Spring equinox'},
        {date:'2026-06-21',name:'Summer solstice'},
        {date:'2026-09-23',name:'Autumn equinox'},
        {date:'2026-12-21',name:'Winter solstice'}
    ];
    const stepSeconds=5,maxElapsedSeconds=200000000000;
    const dateFormat=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const startTimestamp=date=>Date.parse(`${date}T08:00:00Z`)/1000;
    function elapsed(world=State.variables.world) {
        if(Number.isSafeInteger(world?.elapsedSeconds)&&world.elapsedSeconds>=0) return Math.min(maxElapsedSeconds,world.elapsedSeconds);
        return Number.isSafeInteger(world?.turn)&&world.turn>=0?Math.min(Math.floor(maxElapsedSeconds/5),world.turn)*5:0;
    }
    function now() {
        const date=starts.some(start=>start.date===State.variables.character?.startDate)?State.variables.character.startDate:starts[0].date;
        return startTimestamp(date)+elapsed();
    }
    const formatDate=timestamp=>dateFormat.format(new Date(timestamp*1000));
    const formatTime=timestamp=>timeFormat.format(new Date(timestamp*1000));
    const formatStamp=timestamp=>`${formatDate(timestamp)} · ${formatTime(timestamp)}`;
    const startLabel=date=>`${starts.find(start=>start.date===date).name} — ${formatDate(startTimestamp(date))}`;
    function refresh() {
        const date=document.getElementById('player-date'),time=document.getElementById('player-time');
        if(!date||!time) return;
        const timestamp=now(),iso=new Date(timestamp*1000).toISOString();
        date.textContent=formatDate(timestamp);date.dateTime=iso.slice(0,10);
        time.textContent=formatTime(timestamp);time.dateTime=iso;
        const temperature=document.getElementById('player-temperature');
        if(temperature)temperature.textContent=`${setup.weather.temperature(timestamp).toFixed(1)}°F`;
    }
    return {starts,stepSeconds,maxElapsedSeconds,elapsed,now,formatDate,formatTime,formatStamp,startLabel,refresh};
})();
$(document).on(':passagedisplay :timechange',setup.gameClock.refresh);
