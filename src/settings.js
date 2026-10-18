/* Presentation preferences. Character creation lives in character-*.js. */
Config.ui.stowBarInitially = true;
Config.saves.maxAutoSaves = 0;
Config.saves.maxSlotSaves = 1;
Config.history.maxStates = 10;

function applyPreferences() {
    document.documentElement.classList.toggle('large-text', settings.largeText);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
}

Setting.addToggle('largeText', {
    label: 'Larger text',
    default: false,
    onInit: applyPreferences,
    onChange: applyPreferences
});
Setting.addToggle('reduceMotion', {
    label: 'Reduce motion',
    default: false,
    onInit: applyPreferences,
    onChange: applyPreferences
});
