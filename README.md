# Neon Meridian

For a click-to-play website, see [GitHub Pages deployment](DEPLOYMENT.md).

A small browser RPG interface built with **Twine 2 / SugarCube 2.37.3**.
The current prototype opens on a main menu with exactly three choices:
Character Creation, Options, and Import/Export Saves. Character Creation has
independent gender and genital choices, a 4–7 ft height slider in one-inch steps,
four body-fat levels, four muscle levels, three eye colors, five hair colors,
seven hair lengths, and four skin tones. Male and female select different body
models. The female model also has Small/Medium/Large breast sizes under clothing.
Each model/size supports all 16 fat/muscle combinations: 64 body variants total.
Height, build, skin, eyes, hair, gender, and female breast size update the preview.
Genitals are saved independently and do not alter the clothed art. A breast-size
selection is retained when switching to male and restored when returning to female.
All protagonists are adults (age 26 in this prototype). There is no world yet.
Options provides larger text and reduced motion. Save management uses
SugarCube's built-in browser slots and disk import/export.

## Local browser preview

Requires Python 3.9+ and Linux x64; no Python packages or Node dependencies
are needed to build or play. Node is only required for automated browser tests.

```sh
cd /workspace/game
python3 scripts/project.py setup
python3 scripts/project.py dev
```

On your own computer, use the directory where you cloned this project instead.
Open `http://127.0.0.1:8000` in your browser. Editing a file under `src/` or `assets/`
automatically rebuilds and reloads the page. SugarCube restores the current
browser session on reload. Display preferences are stored locally.
Use **Save & return to menu** to retain character edits between visits and
reloads; reloading before returning can discard edits made in the current passage.
The save manager supports one browser slot and portable disk saves. Compilation errors appear in
the terminal and preserve the last successful HTML build. Stop with Ctrl+C.

The cloud instance's loopback address is not your computer's loopback address.
The single-file browser build is `dist/Neon-Meridian.html` (also available as
`dist/index.html`). Open it in a web browser. A chat source viewer may show HTML
as text instead of executing it; that viewer behavior is outside the game.
You can also clone the project and run the commands above. The HTML is self-contained:
no CDN, account, API key, or network connection is required to play it.

To create a standalone build:

```sh
python3 scripts/project.py build
```

Build also produces the named `dist/Neon-Meridian.html` entry.
Open either HTML file directly in any modern browser. The menu adapts to
narrow screens. Existing sessions from the earlier world preview redirect to
the main menu; no previous world content is shown.

## Source layout

- `src/story.twee`: Twine metadata, main menu, character creation layout.
- `src/character-data.js`: versioned serializable character schema and validation.
- `src/character-ui.js`: accessible inputs and live SugarCube state updates.
- `src/character-preview.js`: atlas selection, palette changes, hair alignment.
- `src/interface.css`: responsive interface and character preview styling.
- `assets/characters/`: replaceable placeholder artwork, embedded into the HTML.
- `src/settings.js`: SugarCube configuration and display preferences.
- `scripts/project.py`: pinned tool installation, build, and preview server.
- `.tools/`, `dist/`: ignored downloaded tools and generated output.

Character values live in SugarCube's `$character` variable and travel with
browser/disk saves. Artwork, DOM elements, and caches stay outside save data.
Older saves without character data receive defaults when opening creation.
Assets are embedded into the HTML for offline play; the renderer has no external
runtime dependencies. Head, body, and hair have independent canvas layers. One
canonical adult head is shared by both models, fixed to a common neck position.
Fat, muscle, gender, and breast size never move or resize it. Bodies attach to
that neck and reach a common foot baseline. A short overlapping skin bridge joins
the layers. Height still scales the whole figure. Hair is anchored to the shared
head and can combine with every body variant, skin tone, and eye color.
Version-1 character saves receive a default Medium breast size without losing
their other choices; the current schema version is 2.

Twee is the text source representation of Twine passages. Tweego 2.1.1 compiles
it with the genuine SugarCube runtime. The installer downloads official release
archives over verified HTTPS and checks pinned SHA-256 hashes before extraction.
Third-party licenses are retained under `.tools/`.

On Windows or macOS, install the matching native Tweego 2.1.1 release and the
SugarCube 2.37.3 story format from their official repositories. Put SugarCube's
`sugarcube-2` directory in Tweego's `storyformats` directory, then run:

```sh
mkdir -p dist
python3 scripts/project.py build --tweego /absolute/path/to/tweego
python3 -m http.server 8000 --directory dist
```

Alternatively, use Twine 2's **Import From File** on the compiled HTML. The
modular files under `src/` remain the source of truth; changes made inside the
Twine editor must be exported and reconciled before the next source build.

## Review this feature

Check all three main menu choices, the return link from Character Creation,
display preference toggles, save export/import, keyboard navigation, and a
narrow screen. In Character Creation, try both body controls independently, height
endpoints, and appearance colors/lengths. Save and return, then reopen creation
or use disk saves to verify your selections. Check that body changes keep the
head and hair fixed and the neck connected. Switch Female on to try all three
breast sizes. These remain placeholder sprites; the default neutral outfit stays on.

## Automated checks

Requires Node 20+ and Chromium. On this cloud machine Chromium is already
available at `/usr/bin/chromium`. On other machines, install Playwright's browser
after installing the locked development dependencies:

```sh
npm ci
npx playwright install chromium
npm test
```

Alternatively set `CHROMIUM_EXECUTABLE_PATH` to an existing Chromium binary.
Tests build and serve their own copy on loopback port 8765. Eight checks cover all
64 body renders with pixel-identical heads/hair and connected necks, gender and
breast-size switching, all other visual choices, keyboard height control,
menu/reload persistence, disk save/load, legacy save defaults, and narrow screens.
