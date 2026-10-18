/* One artwork component serves creation and the in-world sidebar. */
setup.characterDisplay = (() => {
    function mount(character) {
        const canvas = document.getElementById('character-canvas');
        const images = Array.from(document.querySelectorAll('.character-source'));
        const sources = Object.fromEntries(images.map(image => [image.id, image]));
        const layers = Object.fromEntries(['body', 'clothing', 'head', 'hair'].map(name => [name, document.getElementById(`${name}-layer`)]));
        const status = document.getElementById('preview-status');
        function refresh() {
            if (!canvas.isConnected) return;
            if (images.some(image => image.complete && !image.naturalWidth)) {
                status.textContent = 'Character artwork could not load. Your selections are retained.';
                return;
            }
            if (!images.every(image => image.complete && image.naturalWidth)) {
                status.textContent = 'Loading appearance…';
                return;
            }
            try {
                setup.characterPreview.draw(sources, layers, canvas, character);
                status.textContent = '';
            } catch (error) {
                status.textContent = 'Preview could not render. Your selections are retained.';
                console.error(error);
            }
        }
        for (const image of images) {
            image.addEventListener('load', refresh, {once: true});
            image.addEventListener('error', refresh, {once: true});
        }
        refresh();
        return {refresh};
    }
    return {mount};
})();
