# Neon Meridian

A modular browser RPG prototype built with Twine 2, SugarCube 2.37.3 and Tweego
2.1.1. For the click-to-play site, see [GitHub Pages deployment](DEPLOYMENT.md).
All protagonists are adults (age 26). Only the Apartments location is available;
no story, NPC schedules, or trait modifiers have been added. The game clock advances with movement only.

## Current character and equipment

The menu has Character Creation (Continue after starting), Options, and
Import/Export Saves. The creator has independent gender/genital selections,
three eye colors, five hair colors, seven hair lengths, four skin tones, and four seasonal start dates.
Body size and breast size controls are removed. Each gender uses one fixed base;
old saves normalize shape fields to Medium without losing equipment, traits or XP.
The male artwork is the existing medium model. The female base is prepared from
user-provided pixel art, retaining its original bodysuit, head and proportions.

Clothing dropdowns follow Appearance: Top, Bottoms, Shoes, Wearable Storage, and
Handheld. Current choices are None or a generic shirt/pants/shoes/backpack; Handheld
has None until handheld equipment is added. The female shirt, pants and shoes are
independent garment-only assets, aligned directly to the base rather than extracted
from a dressed character. Deselecting garments leaves the bodysuit visible. Male
underwear stays opaque. Hair remains a separate layer. All layers use hard alpha
and nearest-neighbor rendering at 288×416. See [artwork details](assets/characters/README.md).

There are 15 independent starting-trait checkboxes and 18 skills. Traits are saved
but have no modifiers until those effects are defined. Skills start at level 0
(untrained) with a refundable 250 XP creation pool. Level 1 costs 50 XP, level 2
costs another 100, then 200, doubling through level 10. Entries are cumulative
(150 XP = level 2). Number fields and ±10 buttons allocate/refund XP; Reset refunds
all. The last increment uses the remaining pool. No trait combinations are restricted.

Skills share the same six categories in creation and the Stats window: Physical
(Athleticism, Endurance, Agility, Swimming, Dancing), Combat (Melee Combat, Ranged), Covert
(Stealth, Lockpicking), Practical (Tending, Housekeeping, Medical, Crafting), Social
(Charm, Deception, Intimidation), and Mental (Perception, Focus). Category definitions
live in `character-rules.js`; grouping does not change save keys, XP or progression.
The old generic Combat skill has been removed; Athleticism retains its own XP.

Start at Apartments locks creation. The sidebar shows the same full-body sprite.
Character and Stats are read-only windows over the map; Inventory is also a
window. Escape, close button, or backdrop closes them. Character creation cannot
be reopened after starting. Use a private browser window to review a fresh creator
without changing an existing playthrough; disk export preserves saves across origins.

## Apartments, housing, money and health

The four buildings each contain one floor with six furnished studio apartments.
Each floor plan (including furniture and unit doors) rotates to match the outdoor
building's entrance toward the park. Open an entrance with E, then choose Enter;
inside, Open and Exit returns through the corresponding outdoor door. The lower
world map always shows the district and the building you are inside.

The north-facing Housing Office stands immediately right of Apartment 3, linked
by sidewalk. Its receptionist is behind a blocking desk; approach the service
positions on the front side and press E. The first screen has Talk and Attack.
Talk → Rent apartment lists only six units: 1–2, 1–5, 2–3, 3–1, 3–4, and 4–6. Attack is an explicit
placeholder and makes no attack until combat rules are developed.

The player starts with **$99,999** and **100 / 100 health**. Both appear above
Character in the sidebar and in Stats; the old Apartments navigation tab is gone.
Rent is **$600 per week**. Renting charges the first week, records the lease,
and puts a matching physical key on the receptionist's tray. The next payment falls exactly seven in-game
days after signing, then every seven days. Movement collects due rent atomically
with the clock update. Missed weeks are caught up without duplicate bills;
insufficient funds leave outstanding rent, and later funds cover it on movement.
No eviction or penalties are implemented. Duplicate leases, insufficient upfront
funds, invalid units, and remote rental calls cannot take payment.
Money, health, lease, due date, arrears, map position and open doors survive saves.

## Keys, room visibility, sounds and rest

Use **Collect apartment key** after renting to open the key tray alongside worn
storage. Drag the 1×1 key into a real pocket or bag; collection never bypasses
capacity. The key stays at reception if storage is full, and cannot be retrieved
remotely. Only a carried matching key opens a locked apartment door from the hall.
Open doors remain passable if the key is subsequently put down; doors can be
closed, and a person inside can open the latch to leave. Existing leases are
preserved, with one key waiting at reception rather than silently entering a bag.
No key respawns after collection, storage transfers, or reloads.

Closed-room interiors, furniture, and interior objects are concealed. A room is
visible while inside or at its open doorway; moving away conceals it again.
Bathrooms have their own doors and visibility. Door numbers remain visible from
the hall. The district overview continues to show roofs rather than interiors.

The Sounds description follows the current room and activity. Sitting produces
bed-frame creaks; waking produces bedding sounds. `setup.rooms.setActivity(mapId,
roomId, activity)` supports quiet, music, conversation, plumbing and work sounds
for future NPC/event systems; changes persist and do not cost time.

Beds offer **Sit**, **Nap for 1 hour**, and **Sleep** with a 1–10 hour choice.
Sitting takes no time. Rest advances the game clock and processes any rent due.
Tiredness starts at 0, rises by 1 per 900 awake game seconds, and caps at 100.
Fatigue is capped at 100 and cannot fall below `floor(tiredness × 0.4)`;
tiredness alone contributes at most 40. Higher means worse. Fatigue falls by 1
per game minute whenever no fatigue-increasing activity is happening, including
walking, sleep and unconsciousness. Partial minutes carry across updates and
saves; a fatigue-increasing action resets that recovery minute. Lowering
tiredness lowers the floor, and subsequent recovery brings fatigue down to it.
Sleep and unconsciousness reduce tiredness by 1 per five minutes (12 per hour),
resetting the awake counter on waking. Reaching 100 tiredness or 100 fatigue
triggers collapse and stops held movement. The player remains unconscious until
tiredness is at most 80: from 100, this takes 100 minutes. A fatigue-only collapse
when already at or below 80 tiredness lasts one recovery minute, waking at 99
fatigue. Fatigue never increases while unconscious. No health damage, eviction
or other penalty is invented. `setup.rest.exert(cost, durationSeconds = 0)`
supplies fatigue costs and optional game-time duration for future actions; a
positive-cost activity suspends passive recovery for that duration. An action
that would reach 100 fails and triggers collapse. Invalid costs and durations
are rejected. Existing saves migrate their tiredness plus exertion to total
fatigue without discarding progress.

Parked Car 2's trunk contains one canned coffee as a test consumable. Carry it,
select it in Inventory, and use **Drink coffee** to reduce tiredness by 10 without
resetting the 15-minute awake schedule. It is consumed once and costs no time.
No item or key adds invisible carrying capacity.

## Game calendar

Creation offers the 2026 Northern Hemisphere spring equinox (Friday March 20),
summer solstice (Sunday June 21), autumn equinox (Wednesday September 23), and
winter solstice (Monday December 21). These are fixed Gregorian game dates, with
08:00:00 as the starting time. The sidebar shows the weekday, full date, and clock
including seconds. UTC is the neutral game timezone, independent of the browser's
locale, daylight-saving changes, or real-world elapsed time. Calendar rollover and
weekdays use the Gregorian calendar rather than a hardcoded weekday counter.

Each successful cardinal movement step advances five seconds, including held-key,
button and adjacent-map-click movement. Failed moves advance nothing. Other
interactions are free of time costs: doors, map entrance/exit, NPCs, renting,
inventory transfers and sheets. Sleep, naps and passing out deliberately advance time. Real-time waiting and reloads advance nothing.
Legacy turn-based saves convert each stored turn into five seconds once; turn
counts are removed. Old monthly leases retain their payment and get a weekly due
date seven in-game days after migration, without a charge on load.

`setup.playerState.changeMoney(integer)` applies safe currency changes;
`changeHealth(integer)` applies damage/healing, clamped to 0–100. Both commit a
save moment and refresh the sidebar. No hunger or thirst systems are present.
Canned coffee currently reduces tiredness. Other food/drink and stat bonuses
remain open for later definition, without a hunger/thirst dependency.

## Block inventories and cars

Cars park nose-in toward each bay's closed end: north along the top edge and below
the median, south along the bottom edge and above the median. Headlights point
into the bay; red taillights and trunks face the driving aisle. On either side, E
offers Look through window and Open door. Behind a car, E offers Open trunk. Its
front and diagonal tiles have no car interactions. Rendering and access share one
orientation model, including door-open markings. Doors offer Knock/Open. Nearby prompts update every
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
and do not rotate. Transfers and interactions do not advance game time.
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
cardinal step advances five seconds. Holding repeats every 200 ms. Multiple held
directions alternate at that shared pace; releasing one leaves the others active.
Direction aliases share a slot. Blocked attempts cost nothing and keep inputs
active. Dialogs, blur, hidden tabs, and navigation clear held inputs. Movement and
elapsed game seconds persist through reloads, Continue, and disk saves.

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
- `character-data.js`: version-8 serializable schema, defaults and migrations.
- `character-rules.js`, `character-creation-build.js`: traits, XP and allocation UI.
- `character-ui.js`, `character-display.js`: creator controls/shared preview lifecycle.
- `character-female.js`, `character-body.js`, `character-preview.js`, `clothing.js`:
  fixed female/male bases, independent equipment art, head/hair and capacity definitions.
- `inventory.js`, `inventory-ui.js`, `inventory-drag.js`: packing, access, transfers,
  pointer dragging, cancellation/cleanup and block windows.
- `world-map-data.js`, `interior-maps.js`, `world-map-art.js`, `world-map-ui.js`:
  outdoor/interior geometry, rotated floors, furnishings, rendering and camera.
- `world-movement.js`, `world-travel.js`: held-input movement and door transitions.
- `calendar-data.js`: seasonal starts, Gregorian clock, formatting and legacy time conversion.
- `player-state.js`, `housing.js`: money/health, six listings, physical keys and weekly billing.
- `room-sense.js`, `rest.js`: room visibility/sounds, tiredness/fatigue, beds and collapse.
- `vehicle-geometry.js`: shared vehicle headings and front/rear/side geometry.
- `world-interactions.js`, `world-interaction-ui.js`: reach, directional actions,
  prompts and object windows. Definitions can supply custom action text/handlers.
- `world-ui.js`, `world.css`, `interface.css`, `settings.js`: sheets, responsive
  presentation and preferences.
- `scripts/project.py`: setup/build/watching preview. `.tools/` and `dist/` are ignored.

`$character` stores appearance, equipped item IDs in five categories, traits and skill XP.
Old character saves migrate to Medium with shirt/pants/shoes and no backpack;
other valid selections, traits and XP remain. Removed height/composition fields
are discarded. Invalid traits are filtered; imported XP is rounded down and capped
to 250 in skill order. `$world` stores only map ID, position and elapsed seconds (v2). `$openedObjects`
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
SugarCube browser runtime. Coverage includes two fixed body models,
proportional heads and visible faces, independent clothing layers, old-save normalization,
all visual choices, long-hair face/curtain regressions, creator migration,
traits/XP, responsive layouts, read-only sheets, map geometry/collision,
movement/held-direction pacing, interaction reach/actions, nose-in parking/headlight orientation, directional car access, oriented six-unit interiors and portal returns,
rental transactions/access/desk reach, weekly due-time and arrears handling, seasonal
weekdays, calendar rollover and time-free interactions, persistent money/health, garment-only layer bounds,
block packing/failed transfers, separate single-block pockets, dropdown categories,
pointer tracking/drop/cancel behavior, legacy item migration, crisp sprite edges,
no invisible storage, empty-trunk persistence,
reloads, and portable save round trips. CI runs the same suite before Pages deploys.

For review: enter each apartment building with E → Open → Enter, then return
through its exit. Visit the Housing Office beside Apartment 3, approach the desk,
and use Talk → Rent apartment. Check the $600 first-week charge, enter that unit,
collect the key into worn storage, and verify the lease, key and balance after
reload or disk save/load. Approach the unit door, open it, enter, and use E beside
the bed to try Sit, Nap and Sleep. Check that other rooms remain hidden. Check
Inventory and the separate pockets as before. Stop here for feedback before
adding another feature.
