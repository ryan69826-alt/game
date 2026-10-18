# Neon Meridian

A modular browser RPG prototype built with Twine 2, SugarCube 2.37.3 and Tweego
2.1.1. For the click-to-play site, see [GitHub Pages deployment](DEPLOYMENT.md).
All protagonists are adults (age 26). Only the Apartments location is available;
no story, NPC schedules, time simulation, or trait modifiers have been added.

## Current character and equipment

The menu has Character Creation (Continue after starting), Options, and
Import/Export Saves. The creator has independent gender/genital selections,
Small/Medium/Large body sizes for each gender, female breast size, three eye
colors, five hair colors, seven hair lengths, and four skin tones. Height,
body-fat and muscle controls have been replaced. The six body fits use more
pronounced masculine/feminine silhouettes and a shared fixed head.

Clothing dropdowns follow Appearance: Top, Bottoms, Shoes, Wearable Storage, and
Handheld. Current choices are None or a generic shirt/pants/shoes/backpack; Handheld
has None until handheld equipment is added. Clothing renders separately from the
body using the matching six-fit detailed paper-doll atlas. Underwear stays opaque
when outer clothing is removed. Head/hair use the approved PNG references; all
layers use hard alpha and nearest-neighbor rendering at 288×416 for crisp pixels. See [artwork details](assets/characters/README.md).

There are 15 independent starting-trait checkboxes and 18 skills. Traits are saved
but have no modifiers until those effects are defined. Skills start at level 0
(untrained) with a refundable 250 XP creation pool. Level 1 costs 50 XP, level 2
costs another 100, then 200, doubling through level 10. Entries are cumulative
(150 XP = level 2). Number fields and ±10 buttons allocate/refund XP; Reset refunds
all. The last increment uses the remaining pool. No trait combinations are restricted.

Start at Apartments locks creation. The sidebar shows the same full-body sprite.
Character and Stats are read-only windows over the map; Inventory is also a
window. Escape, close button, or backdrop closes them. Character creation cannot
be reopened after starting. Use a private browser window to review a fresh creator
without changing an existing playthrough; disk export preserves saves across origins.

## Block inventories and cars

Cars face north (top of map). On either side, E offers Look through window and
Open door. Behind a car (south), E offers Open trunk. Its front and diagonal tiles
have no car interactions. Doors offer Knock/Open. Nearby prompts update every
move; multiple objects produce a chooser. Actions recheck reach and direction.
Opening a door updates both maps and persists. There are no access restrictions,
interiors, driving, or NPC/ground objects placed yet. Ground/NPC definitions can
still provide their own actions through the same interaction registry.

Opening a trunk shows its storage beside the player's worn storage. Drag an
item to a free destination square; it follows the pointer at the grab point. Valid
and invalid destinations have different outlines. Invalid/outside drops, Escape,
window blur and navigation preserve the original placement. Near the window edges,
dragging scrolls its contents. Selecting an item and then a square with mouse or
keyboard Tab/Enter also works. Short block labels never wrap; hover titles, accessible
names and selection messages retain full item names.
Rectangular items require adjoining squares, cannot overlap or extend past a grid,
and do not rotate. Transfers and interactions currently spend no movement turns.
Opening dialogs clears held movement; the world remains visible behind them.

Prototype capacities:

| Equipment / container | Grid | Blocks |
| --- | --- | --- |
| Shirt pocket | 1×1 | 1 |
| Pants pockets | Four separate 1×1 pockets | 4 |
| Shoes / underwear | None | 0 |
| Backpack | 4×4 | 16 |
| Each car trunk | 6×4 | 24 |

There is no base or invisible player inventory. Each pocket/bag has its
own grid; an unequipped item grants no storage. Equipment is selected in creation;
changing equipment during play is outside this feature. Trunks contain placeholder
water (1×2), tools (2×2), and cloth (1×1) to test packing/transfers. Each trunk is
independent, initialized only once, and never restocks when emptied. Contents and
placements persist through movement, reload, menu/Continue and disk saves.

## World and movement

Apartments is a 50×50 grid: four buildings face a park, a parking lot has edge and
median bays, and two five-square-wide roads meet at the south edge. Cars occupy
2×2 squares. A continuous sidewalk surrounds the park and connects each entrance.
Doors are walkable thresholds; buildings, cars, trees, and medians block movement.

The description takes 60% of the main area and maps take 40%, beside the character
sidebar. The scrolling local map sits above a complete current-area world overview.
Both maps fit desktop viewport heights; narrow screens stack them below the text.
The compact movement panel above the location title is the only exact-location
readout. Player coordinates are displayed starting at 1.

Use arrows, WASD, direction buttons, or click an adjacent square. Every successful
cardinal step spends one turn. Holding repeats every 200 ms. Multiple held
directions alternate at that shared pace; releasing one leaves the others active.
Direction aliases share a slot. Blocked attempts cost nothing and keep inputs
active. Dialogs, blur, hidden tabs, and navigation clear held inputs. Movement and
turn count persist through reloads, Continue, and disk saves.

## Local development and preview

Requires Python 3.9+ and Linux x64. Node 20+ and Chromium are needed only for tests.
The setup downloads official release archives using verified HTTPS and pinned
SHA-256 hashes. Existing tool/dependency installations can be reused.

```sh
cd /workspace/game
python3 scripts/project.py setup
npm ci
python3 scripts/project.py dev
```

On your computer use the cloned repository's directory and open
`http://127.0.0.1:8000`. Source/artwork edits rebuild and reload automatically.
Compilation failures preserve the last good build. Ctrl+C stops the server.
Cloud loopback addresses are not accessible on the player's computer; use the
published Pages site for cloud review. Never use a chat HTML source viewer as the
browser preview. `python3 scripts/project.py build` produces identical standalone
`dist/index.html` and `dist/Neon-Meridian.html`, with all active PNG assets embedded.

Creation edits are committed when navigating out of the passage. Use Save & return
to menu before reloading. SugarCube provides a browser save slot and portable disk
Save/Load. Browser saves are tied to origin; Options stores larger text/reduced
motion locally. Import the compiled HTML into Twine 2 if desired, but modular files
under `src/` remain the source of truth.

On Windows/macOS install native Tweego 2.1.1 and SugarCube 2.37.3 from their official
repositories; place `sugarcube-2` under Tweego's `storyformats`, then build with
`python3 scripts/project.py build --tweego /absolute/path/to/tweego`.

## Source and saves

- `story.twee`, `world.twee`: menu, creator, world, sidebar and window markup.
- `character-data.js`: version-5 serializable schema, defaults and migrations.
- `character-rules.js`, `character-creation-build.js`: traits, XP and allocation UI.
- `character-ui.js`, `character-display.js`: creator controls/shared preview lifecycle.
- `character-body.js`, `character-preview.js`, `clothing.js`: body fits, independent
  equipment art, head/hair, equipment and capacity definitions.
- `inventory.js`, `inventory-ui.js`, `inventory-drag.js`: packing, access, transfers,
  pointer dragging, cancellation/cleanup and block windows.
- `world-map-data.js`, `world-movement.js`, `world-map-ui.js`: terrain, movement,
  held-input pacing, map rendering and camera.
- `world-interactions.js`, `world-interaction-ui.js`: reach, directional actions,
  prompts and object windows. Definitions can supply custom action text/handlers.
- `world-ui.js`, `world.css`, `interface.css`, `settings.js`: sheets, responsive
  presentation and preferences.
- `scripts/project.py`: setup/build/watching preview. `.tools/` and `dist/` are ignored.

`$character` stores appearance, equipped item IDs in five categories, traits and skill XP.
Old character saves migrate to Medium with shirt/pants/shoes and no backpack;
other valid selections, traits and XP remain. Removed height/composition fields
are discarded. Invalid traits are filtered; imported XP is rounded down and capped
to 250 in skill order. `$world` stores only map ID, position and turn. `$openedObjects`
stores door flags; `$inventory` version 2 stores container IDs and item placements. Version-4 equipment
booleans migrate to category selections. Old shared pocket grids repack into the
new independent pockets and any equipped backpack. Items too large to fit return
to existing car trunks; an inventory notice lists their destinations. Migration is
transactional and preserves item IDs and quantities, without legacy hidden storage.
SugarCube history is bounded to ten moments. Artwork, item definitions, geometry,
DOM and canvas caches stay outside saves.

## Verification

```sh
npm ci
npx playwright install chromium  # or CHROMIUM_EXECUTABLE_PATH / system Chromium
npm test
```

Tests build their own copy, serve it on loopback port 8765, and exercise the real
SugarCube browser runtime. Coverage includes six distinct body/clothing fits,
fixed head/hair and connected necks, independent clothing layers, breast sizes,
all visual choices, long-hair face/curtain regressions, creator migration,
traits/XP, responsive layouts, read-only sheets, map geometry/collision,
movement/held-direction pacing, interaction reach/actions, directional car access,
block packing/failed transfers, separate single-block pockets, dropdown categories,
pointer tracking/drop/cancel behavior, legacy item migration, crisp sprite edges,
no invisible storage, empty-trunk persistence,
reloads, and portable save round trips. CI runs the same suite before Pages deploys.

For review: try all six fits and clothing dropdowns in a fresh creator, enter
Apartments, open sidebar Inventory, walk to a car's side/back and press E, and
transfer the differently sized placeholder items between pockets, backpack and
trunk. Stop here for feedback before adding another feature.
