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
        function showObject(object, focus = false) {
            root.replaceChildren();
            const title = document.createElement('h2');title.className = 'interaction-title';title.textContent = object.name;
            const description = document.createElement('p');description.className = 'world-note';description.textContent = object.description || 'Choose an interaction.';
            const actions = document.createElement('div');actions.className = 'interaction-actions';
            const result = document.createElement('p');result.id = 'interaction-result';result.setAttribute('role', 'status');result.setAttribute('aria-live', 'polite');
            for (const action of setup.interactions.actionsFor(object)) {
                const control = button(action.label, () => {
                    result.textContent = setup.interactions.run(object.id, action.id).message;
                    control.disabled = !!action.enabled && !action.enabled(object);
                });
                control.disabled = !!action.enabled && !action.enabled(object);actions.append(control);
            }
            root.append(title, description, actions, result);
            if (targets.length > 1) root.append(button('Back to nearby objects', () => showObjects(true)));
            if (focus) actions.querySelector('button')?.focus();
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
