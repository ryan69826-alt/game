/* Personal actions share the overlaid dialog and game-time rest system. */
setup.actionUI = (() => {
    function open() {
        if(Dialog.isOpen()||!document.getElementById('actions-button')) return;
        Dialog.setup('Actions','character-window interaction-window');
        const root=Dialog.body();
        function button(label,action) {
            const element=document.createElement('button');element.type='button';element.textContent=label;
            element.addEventListener('click',action);return element;
        }
        function status() {
            const result=document.createElement('p');result.id='action-result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');return result;
        }
        function showMenu(focus=false) {
            root.replaceChildren();
            const help=document.createElement('p');help.className='world-note';help.textContent='Take a moment where you are.';
            const actions=document.createElement('div');actions.className='interaction-actions';const result=status();
            actions.append(button('Pass Time',()=>{result.textContent=setup.rest.passTime().message;}),button('Lay down to sleep',showSleep));
            const note=document.createElement('p');note.className='world-note';note.textContent='Pass Time advances the clock by 15 minutes.';
            root.append(help,actions,note,result);if(focus) actions.firstElementChild.focus();
        }
        function showSleep() {
            root.replaceChildren();
            const title=document.createElement('h2');title.className='interaction-title';title.textContent='Lay down to sleep';
            const help=document.createElement('p');help.className='world-note';
            const object=setup.rest.comfort();
            help.textContent=object?`${object.name} is within reach. Comfortable sleep reduces tiredness by 1 every 5 minutes.`:
                'No comfortable object is within reach. Sleeping here reduces tiredness by 1 every 7½ minutes, 1.5 times slower than on a bed.';
            const label=document.createElement('label');label.htmlFor='action-sleep-hours';label.textContent='Sleep for';
            const select=document.createElement('select');select.id=label.htmlFor;
            for(let hours=1;hours<=10;hours++) select.append(new Option(`${hours} hour${hours===1?'':'s'}`,hours));select.value='8';
            const result=status();
            const confirm=button('Sleep for 8 hours',()=>{result.textContent=setup.rest.sleepAnywhere(Number(select.value)).message;});
            select.addEventListener('change',()=>{confirm.textContent=`Sleep for ${select.value} hour${select.value==='1'?'':'s'}`;});
            const form=document.createElement('div');form.className='rental-form';form.append(label,select,confirm);
            root.append(title,help,form,result,button('Back to actions',()=>showMenu(true)));select.focus();
        }
        showMenu();Dialog.open();
    }
    return {open};
})();
$(document).on(':passagedisplay',()=>document.getElementById('actions-button')?.addEventListener('click',setup.actionUI.open));
$(document).on('keydown.personalActions',event=>{
    if(event.key.toLowerCase()!=='t'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||Dialog.isOpen()||
        event.target.closest('input,select,textarea,[contenteditable="true"]')||!document.getElementById('actions-button')) return;
    event.preventDefault();setup.actionUI.open();
});
