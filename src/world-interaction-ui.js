/* All interaction windows stay over the location and pause held movement. */
setup.interactionUI = (() => {
    function refresh() {
        const button = document.getElementById('interact-button');
        if (!button) return;
        const targets = setup.interactions.nearby();
        button.disabled = targets.length === 0;
        document.getElementById('interaction-hint').textContent = targets.length === 1 ? targets[0].object.name :
            targets.length ? `${targets.length} objects nearby` : 'No nearby objects';
    }
    function open() {
        if (Dialog.isOpen() || !document.getElementById('interact-button')) return;
        const targets = setup.interactions.nearby();
        if (!targets.length) {
            document.getElementById('movement-status').textContent = 'Nothing to interact with nearby.';
            return;
        }
        Dialog.setup('Interact', 'character-window interaction-window');
        const root = Dialog.body();
        function button(label, action) {
            const element = document.createElement('button');element.type = 'button';element.textContent = label;
            element.addEventListener('click', action);return element;
        }
        function showTalk(object,focus=true) {
            root.replaceChildren();
            const title=document.createElement('h2');title.className='interaction-title';title.textContent=object.name;
            const text=document.createElement('p');text.className='world-note';text.textContent='“Looking for a place to live?”';
            const actions=document.createElement('div');actions.className='interaction-actions';
            actions.append(button('Rent apartment',()=>showRental(object)),button('Back',()=>showObject(object,true)));
            root.append(title,text,actions);if(focus) actions.firstElementChild.focus();
        }
        function showRental(object) {
            root.replaceChildren();
            const title=document.createElement('h2');title.className='interaction-title';title.textContent='Rent an apartment';
            const text=document.createElement('p');text.className='world-note';
            text.textContent=`Rent is ${setup.playerState.formatMoney(setup.housing.rentPrice)} per week. Pay the first week now; later payments are collected automatically every seven in-game days. Unpaid rent remains outstanding if funds run short.`;
            const form=document.createElement('div');form.className='rental-form';
            const label=document.createElement('label');label.htmlFor='rental-unit';label.textContent='Choose an apartment';
            const select=document.createElement('select');select.id=label.htmlFor;
            for(const unit of setup.housing.listings().sort((a,b)=>a.building-b.building||a.number-b.number)) select.append(new Option(unit.name,unit.id));
            const result=document.createElement('p');result.id='interaction-result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');
            const confirm=button(`Rent · ${setup.playerState.formatMoney(setup.housing.rentPrice)} first week`,()=>{
                const outcome=setup.housing.rent(select.value);result.textContent=outcome.message;
                if(outcome.ok) {confirm.disabled=true;select.disabled=true;handover.hidden=false;}
            });
            const rented=setup.housing.ensure().rentedUnit;
            const handover=button('Collect apartment key',()=>setup.inventoryUI.open('housing-counter'));handover.hidden=!rented;
            if(rented) {
                select.value=rented;select.disabled=true;confirm.disabled=true;
                result.textContent=`You already rent ${setup.housing.units().find(unit=>unit.id===rented).name}.`;
            }
            form.append(label,select,confirm);
            root.append(title,text,form,result,handover,button('Back to talk',()=>showTalk(object)));
            select.focus();
        }
        function showObject(object, focus = false) {
            root.replaceChildren();
            const title = document.createElement('h2');title.className = 'interaction-title';title.textContent = object.name;
            const description = document.createElement('p');description.className = 'world-note';description.textContent = (setup.vehicleCabin.current()?.car.id===object.id?'You are seated inside the parked vehicle. Its engine is off. Hotwiring is not available yet.':(object.storageId&&setup.selfStorage.owned(object.storageId)?setup.selfStorage.summary(object.storageId):object.description) || 'Choose an interaction.')+(['door','car'].includes(object.kind)?(()=>{const target=object.kind==='car'&&setup.vehicles.edge(object,State.variables.world)==='rear'?setup.vehicles.trunk(object):object;return ` Lock level ${setup.doorLocks.difficulty(target)} / 5 · ${setup.doorLocks.isLocked(target)?'Locked':'Unlocked'} · Your lockpicking level: ${setup.doorLocks.skill()}.`;})():'');
            const actions = document.createElement('div');actions.className = 'interaction-actions';
            const result = document.createElement('p');result.id = 'interaction-result';result.setAttribute('role', 'status');result.setAttribute('aria-live', 'polite');
            for (const action of setup.interactions.actionsFor(object)) {
                const control = button(action.label, () => {
                    const outcome = setup.interactions.run(object.id, action.id);
                    if(outcome.travelled) return;
                    if(outcome.ok&&outcome.transit) {setup.transitUI.open();return;}
                    if(outcome.ok&&outcome.externalId) {setup.inventoryUI.open(outcome.externalId);return;}
                    if(outcome.ok&&outcome.conversation==='housing') {showTalk(object);return;}
                    if(outcome.ok&&outcome.sleepBedId) {showSleep(object);return;}
                    if (outcome.ok && outcome.trunkId) {setup.inventoryUI.open(outcome.trunkId);return;}
                    if(outcome.refreshActions||outcome.vehicleChanged||['open','close','close-trunk','trunk','unlock','lock','lockpick'].includes(action.id)) {
                        // Opening a portal enables Enter/Exit in the same window.
                        showObject(object,true);document.getElementById('interaction-result').textContent=outcome.message;
                    } else {
                        result.textContent=outcome.message;
                        control.disabled=!!action.enabled&&!action.enabled(object);
                    }
                });
                control.disabled = !!action.enabled && !action.enabled(object);actions.append(control);
            }
            root.append(title, description, actions, result);
            if (targets.length > 1) root.append(button('Back to nearby objects', () => showObjects(true)));
            if (focus) actions.querySelector('button')?.focus();
        }
        function showSleep(object) {
            root.replaceChildren();
            const title=document.createElement('h2');title.className='interaction-title';title.textContent='Sleep';
            const help=document.createElement('p');help.className='world-note';help.textContent='Tiredness falls by 1 every 5 minutes asleep (12 per hour). Fatigue falls by 1 per minute, stopping at the floor set by tiredness. Choose up to 10 hours.';
            const label=document.createElement('label');label.htmlFor='sleep-hours';label.textContent='Sleep for';
            const select=document.createElement('select');select.id=label.htmlFor;
            for(let hour=1;hour<=10;hour++) select.append(new Option(`${hour} hour${hour===1?'':'s'}`,hour));select.value='8';
            const result=document.createElement('p');result.id='interaction-result';result.setAttribute('role','status');
            const confirm=button('Sleep for 8 hours',()=>{const outcome=setup.rest.sleep(object.id,Number(select.value));result.textContent=outcome.message;});
            select.addEventListener('change',()=>{confirm.textContent=`Sleep for ${select.value} hour${select.value==='1'?'':'s'}`;});
            const form=document.createElement('div');form.className='rental-form';form.append(label,select,confirm);
            root.append(title,help,form,result,button('Back to bed',()=>showObject(object,true)));select.focus();
        }
        function showObjects(focus = false) {
            root.replaceChildren();
            const help = document.createElement('p');help.className = 'world-note';help.textContent = 'Choose an object within reach.';
            const list = document.createElement('div');list.className = 'interaction-actions';
            for (const {object} of targets) list.append(button(object.name, () => showObject(object, true)));
            root.append(help, list);
            if (focus) list.querySelector('button')?.focus();
        }
        if (targets.length === 1) showObject(targets[0].object);else showObjects();
        Dialog.open();
    }
    return {refresh, open};
})();

$(document).on(':passagedisplay', () => {
    const button = document.getElementById('interact-button');
    if (!button) return;
    button.addEventListener('click', setup.interactionUI.open);
    setup.interactionUI.refresh();
});
$(document).on('keydown.interactions', event => {
    if (event.key.toLowerCase() !== 'e' || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
        Dialog.isOpen() || event.target.closest('input,select,textarea,[contenteditable="true"]') || !document.getElementById('interact-button')) return;
    event.preventDefault();setup.interactionUI.open();
});

$(document).on(':interactionchange',()=>{if(document.getElementById('interact-button')) setup.interactionUI.refresh();});
