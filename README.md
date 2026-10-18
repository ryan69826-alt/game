# Neon Meridian

For a click-to-play website, see [GitHub Pages deployment](DEPLOYMENT.md).

A small browser RPG interface built with **Twine 2 / SugarCube 2.37.3**.
The current prototype opens on a main menu with exactly three choices:
Character Creation (Continue after entering the world), Options, and Import/Export Saves. Character Creation has
independent gender and genital choices, a 4–7 ft height slider in one-inch steps,
four body-fat levels, four muscle levels, three eye colors, five hair colors,
seven hair lengths, and four skin tones. Male and female select different body
models. The female model also has Small/Medium/Large breast sizes under clothing.
Each model/size supports all 16 fat/muscle combinations: 64 body variants total.
Height, build, skin, eyes, hair, gender, and female breast size update the preview.
Genitals are saved independently and do not alter the clothed art. A breast-size
selection is retained when switching to male and restored when returning to female.
Character Creation also has 15 independent starting-trait checkboxes and 18 skills.
Traits are saved but have no stat or skill modifiers until those effects are defined.
Skills begin untrained at level 0 and have a shared, refundable 250 XP creation pool.
Reaching level 1 costs 50 XP; each following level costs twice the previous cost
(100 more for level 2, 200 more for level 3), through level 10. XP entered per skill
is cumulative: 150 XP means level 2 with 0/200 toward level 3. Use the number fields
or ±10 XP buttons; the last increment uses the remaining pool. Reset refunds all
skill XP. No combinations of traits are restricted yet.
All protagonists are adults (age 26 in this prototype).
Use **Start at Apartments** in the creator to enter the first urban location.
Apartments has a vertical area map on the right (40% of the main area) and a
description column on the left (60%). On narrow screens, the map stacks below
the description so both remain readable. Apartments is a 50×50 square grid with
four buildings facing a small park, a parking lot, a road across the south edge,
and a second road running north from that road. Both roads are five squares wide
with markings on their center squares. The parking lot has edge bays, clear drive
aisles, and extra bays beside a planted median. Each car occupies a 2×2 square
footprint. A continuous sidewalk circles the park and connects all four apartment
entrances; no sidewalk crosses the park. The scrolling local map follows
the player; the world map below shows the complete current area, player position,
and local camera rectangle. Only Apartments is available for now.

Use arrow keys, WASD, on-screen direction buttons, or click an adjacent square.
Each successful cardinal step costs one turn; walls, cars, trees, area boundaries,
and nonadjacent clicks cost none. Holding a key does not repeat turns. Doors are
walkable thresholds; building interiors are not implemented. Open dialogs pause
movement. Coordinates shown to players start at 1. Movement position and turn count
survive reloads, menu/Continue, and disk saves. No time or NPC simulation runs yet.
A persistent
left sidebar displays the exact customized full-body character, a location link,
and Character/Stats buttons. Both buttons open read-only windows over the unchanged
Apartments screen. Character shows the saved identity, appearance, and traits;
Stats shows all 18 skill levels and XP progress. There is no editing link, and
character creation cannot reopen after entering the world. Close windows with
Escape, the close button, or the backdrop; focus returns to the opening button.
Old saves on Character/Stats passages return safely to Apartments.
Additional stats and trait effects remain undefined. No other locations, story,
NPCs, or time simulation are implemented. Continue returns to Apartments.
The sidebar's Saves link supports saving/loading from world pages.
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
the main menu, except the old Apartment passage which now redirects to Apartments.

## Source layout

- `src/story.twee`: Twine metadata, menu, creator, and shared artwork markup.
- `src/world.twee`: Apartments, Character, Stats, and the shared sidebar.
- `src/world-ui.js`: read-only character and skill windows.
- `src/world-map-data.js`: location definitions, grid dimensions, terrain, and entrances.
- `src/world-movement.js`: position validation, collision rules, and turn/session commits.
- `src/world-map-ui.js`: map rendering, scrolling camera, input, and movement feedback.
- `src/world.css`: responsive world layout with a left sidebar.
- `src/character-display.js`: shared artwork loading/rendering lifecycle.
- `src/character-data.js`: versioned serializable character schema and validation.
- `src/character-ui.js`: accessible appearance inputs and live SugarCube state updates.
- `src/character-rules.js`: trait/skill definitions, doubling XP thresholds and budget rules.
- `src/character-creation-build.js`: trait checkboxes and refundable skill allocation UI.
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
the layers. The head uses balanced stylized adult proportions,
and overlapping neck sections are trimmed. Height still scales the whole figure.
Hair is anchored to the shared
head and can combine with every body variant, skin tone, and eye color.
Chest and longer hair use complete body-free templates, with head fit and length
handled independently so both sides remain intact. Small breast size uses the
former Medium artwork; Medium is between that size and the unchanged Large.
Version-1 character saves receive a default Medium breast size without losing
their other choices. Version 3 adds empty starting traits and zero XP for every
skill to older saves. Invalid trait IDs are discarded; imported skill XP is rounded
down, made nonnegative, and capped to the 250 XP pool in the listed skill order.

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
Tests build and serve their own copy on loopback port 8765. Twenty-two checks cover all
64 body renders with pixel-identical heads/hair and connected necks, gender and
breast-size switching, all other visual choices, keyboard height control,
menu/reload persistence, disk save/load, legacy save defaults, and narrow screens.
Proportion and long-hair regressions additionally check both height endpoints,
continuous left hair silhouettes, and room around the complete hair in the canvas.
Face-visibility checks cover Waist/Knee/Floor hair at both height limits, with
light/dark skin and hair, verifying that eyes, nose, and mouth retain their pixels.

Starting-build checks cover all trait selections, XP thresholds through level 10,
allocation/refunds, overspending and invalid input, legacy normalization, and
trait/skill persistence through menu, reload, and disk save/load.

World checks compare the sidebar sprite with the creator and verify read-only
windows, unchanged location DOM/history, focus restoration, three ways to close,
XP display, reloads, disk saves, and old passage compatibility. Sidebar and window
layouts are checked at 1440, 700, 390, and 320 pixels with larger text enabled.
To review manually, enter Apartments,
open and close both sidebar windows, then use Saves or Main menu.

Movement checks cover the two roads, connected routes to all four inward-facing
entrances, obstacles and bounds, button/keyboard/map input, camera updates,
dialog pauses, legacy defaults, and position/turn persistence through reload and
portable saves. Map geometry and rendering stay outside saves; `$world` stores
only version, area ID, position, and movement turn count. Each accepted step creates
a SugarCube moment without rebuilding the page; the existing ten-moment history
limit keeps session history bounded.
