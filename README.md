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
world map sits above the sidebar character and is an area atlas: Apartments is one icon, selected while outdoors or
inside any building in that area. New areas can be added in `world-atlas.js`;
the atlas never renders local tiles, cars, or camera bounds. The right-side local
map uses the freed height and adjusts its outdoor camera rows to fit the panel.

Unit numbers start at the nearest room on the left when entering, then the
opposite room, continuing 1–6 down the hall. Rotating the building preserves
that entry-relative order. Stable save IDs stay attached to physical rooms, so
leases, keys, beds, and saved room activity keep their existing associations.
Rental labels, map numbers, room descriptions and key tooltips use the displayed numbers.

The north-facing Housing Office stands immediately right of Apartment 3, linked
by sidewalk. Its receptionist is behind a blocking desk; approach the service
positions on the front side and press E. The first screen has Talk and Attack.
Talk → Rent apartment lists six physical units: Apartment 1 units 1 and 6,
Apartment 2 unit 3, Apartment 3 units 4 and 5, and Apartment 4 unit 2. Attack is an explicit
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
remotely. A carried matching key enables **Unlock** at the apartment door.
Unlock first, then choose **Open**. Closing leaves the door unlocked until
**Lock** is selected. Open doors remain passable if the key is subsequently put
down; a person inside can use the latch to unlock and leave. Existing leases are
preserved, with one key waiting at reception rather than silently entering a bag.
No key respawns after collection, storage transfers, or reloads.

Closed-room interiors, furniture, and interior objects are concealed. A room is
visible while inside or at its open doorway; moving away conceals it again.
Bathrooms have their own doors and visibility. Door numbers remain visible from
the hall. The world atlas shows only area icons.

The Sounds description follows the current environment and the player's actions.
Outdoor leaf sounds occur only within eight tiles of park trees; elsewhere the
grounds have quiet breeze ambience. Halls and studios have ventilation, bathrooms
an extractor fan, and the office a faint ceiling-light hum. No default traffic,
footsteps, typing, paper rustling, voices or other unmodeled human activity plays.
Sitting on a bed produces its creak, and waking there produces bedding rustles.

`setup.rooms.setActivity(mapId, roomId, activity, sourceId)` supports quiet,
music, conversation, plumbing and work for future scene events. A non-quiet
activity needs a present interactable in that room whose `soundActivities`
includes the requested activity; `active: false`, a removed/moved source, or a
legacy source-free activity silences it. Activity state persists without costing
time, but never substitutes for a missing source.

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

## Personal actions and locks

Press **T** or click **Actions [T]** in the movement panel to open an overlay.
It pauses held movement, like the interaction window. **Pass Time** advances
15 game minutes; **Rest** waits one awake minute. Both update tiredness, fatigue,
endurance, the calendar and rent without moving or resetting awake tiredness. Ordinary
interactions continue to cost no time.

**Lay down to sleep** offers 1–10 hours anywhere. At a bed within reach (the same
reach check used by bed interactions), sleep restores 1 tiredness per 5 minutes.
Without a comfortable object, recovery is 1.5 times slower: 1 per 450 seconds,
or 8 per hour. Fatigue still recovers by 1 per minute above its tiredness floor.
Comfort is checked again when confirming sleep. Existing bed nap/sleep and
unconsciousness retain their normal 5-minute tiredness recovery rate.

**Open** is replaced by **Close** while a door is open. Locked doors show
**Unlock** and **Lockpick**; unlocked doors show **Lock**. The Lockpick label
includes the lock level before the chance. Apartments start locked;
common entrances and bathrooms start unlocked. Apartment keys must be carried
in worn storage. Interior latches permit locking/unlocking from inside without
a key. A closed, unlocked door can be locked again with its key or inside latch.
Building entrances share both open/closed and lock state across their two sides.
Old saves preserve already-open doors as unlocked. Lock states persist in saves.

Lock levels are integers 1–5: common entrances and bathrooms use level 1;
all apartment units use level 2. Car doors normally use level 3 and trunks level 2. Each door shows
its difficulty, your Lockpicking level, and your chance before an attempt. For
skill/lock ratio `r`, chance is `clamp((r - 0.5) × 100, 0, 50)` below equal level,
and `clamp(50 + (r - 1) × 50, 50, 100)` at or above equal level. This gives 0%
at half level, 50% at equal level, and 100% at double level. Each attempt rolls
independently; success unlocks without opening, and failure leaves the lock
intact. No tools, XP rewards, damage or extra time costs are introduced.

Unowned cars start with locked doors and trunks, independently. An explicit
`locked: false` / `trunkLocked: false` map definition or a saved unlocked state
can override the default. Ownership uses `$ownedVehicles` entries such as
`apartments:parked-car-1` (or a map object's `ownedByPlayer: true`); owned cars
have key access. A carried `vehicleKey` with ID `vehicle-key:apartments:parked-car-1`
also unlocks that vehicle. Doors can open and close from the sides; trunks can
open and close from the rear. Opening an unlocked trunk shows inventory; an
already-open trunk offers **View trunk inventory**. Locked, closed, or remote
trunks reject inventory access and transfers. Unlocking a car door does not
unlock its trunk. Existing opened doors remain open/unlocked when migrating.

## Entering parked vehicles

After opening a side door, **Get in car** seats the player. **E** now targets that
vehicle and offers its door controls, **Cabin inventory**, any visible cash,
**Hotwire** (disabled placeholder), and **Get out of car**. Entry, exit and cash
collection take no time. Walking/sprinting is blocked while seated; no driving,
engine-starting, ownership changes or hotwiring mechanics are implemented.
Getting out uses the original clear side tile, opening/unlatching the door from
inside if necessary, so closing or locking it does not trap the player.

Sidebar **Inventory** automatically includes a separate 4×3 cabin storage grid
while seated, alongside worn storage. It starts empty and uses the same block
packing and drag/click transfers as other storage. Cabin cash has its own take
control, consistent with the existing money stat. Cabin items and seating persist
in browser/disk saves. On exit, cabin access ends; cabin and trunk storage never
share containers or contents. Other cars' cabins and all trunks are inaccessible
while seated. The map marker moves onto the car, and the position/description
identify the cabin. Cabin sounds describe the stopped engine and open/closed
door, with no invented occupants or running engine. Sleeping there uses the
existing slower recovery for an uncomfortable place.

## Sprinting and endurance

Hold **Shift** with movement keys, or toggle **Sprint [Shift]** for keyboard,
pointer buttons and map clicks. Sprint steps repeat every 100 ms instead of
200 ms, cost 2 game seconds instead of 5, and increase endurance used by 1.
Blocked steps cost no time, endurance, or XP. At the limit the player walks
instead, recovering breath; holding Sprint can resume running as breath allows.
Endurance use recovers by 1 per five non-sprinting game seconds, including
walking, waiting, sleep and unconsciousness. Partial recovery seconds survive
saves. Starting a sprint resets the partial recovery interval.

The sidebar meter shows endurance **used / maximum**. Base maximum is 25.
Endurance level `L` adds `5 × L × (L + 1) / 2`, giving 30, 40, 55 at levels 1–3
and 300 at level 10. Every 25 successful sprint steps awards 1 Endurance XP;
the counter survives rest and saves. `$skillXp` stores earned XP independently
of the creator's 250-XP allocation, and Stats uses both. Level-ups immediately
increase capacity. `$endurance` stores used breath, the sprint-step remainder
and recovery seconds; UI input state is never saved.

Looking through a car window rolls a 15% chance of visible cabin money. A hit
chooses a whole-dollar amount uniformly from $1 through $120. Both a miss and
the rolled amount persist per car in `$vehicleContents`, including across reloads;
repeated inspection does not reroll. Inspection describes visible contents without taking them, consuming time, or
unlocking the vehicle. Once seated, **Take $amount** collects exactly that amount
into the money stat and clears the cabin cash in the same saved transaction.
It can be taken from either the vehicle action menu or cabin inventory. Empty or
already-collected cash never rerolls; remote/stale targets cannot award money.
Trunk loot stays separate.
Repeated Shift keydown events do not restart the held-movement timer. Exhaustion
uses the existing walking fallback rather than stopping held movement.

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
sidebar. The scrolling local map occupies the right-side panel; the world atlas
of area icons sits above the character in the left sidebar.
Both maps fit desktop viewport heights; narrow screens stack them below the text.
The compact movement panel above the location title is the only exact-location
readout. Player coordinates are displayed starting at 1.

Use arrows, WASD, direction buttons, or click an adjacent square. Every successful
cardinal step advances five seconds. Holding repeats every 200 ms. Multiple held
directions alternate at that shared pace; releasing one leaves the others active.
Direction aliases share a slot. Blocked attempts cost nothing and keep inputs
active. Dialogs, blur, hidden tabs, and navigation clear held inputs. Movement and
elapsed game seconds persist through reloads, Continue, and disk saves.

## District plan and discovery

`src/district-data.js` records the supplied spreadsheet as columns A–H, rows 1–7
(north increases upward). Apartments is C1; E7 and H5 are unassigned. These are
relative district coordinates, not dimensions of walkable maps. Repeated labels
such as Highway or Scrapyard remain separate cells. Distant destinations are not
placed until their travel connections are defined.

The world atlas initially reveals Apartments and its cardinal neighbors: B1
Warehouse/Storage, C2 Marketplace, and D1 Transit Area w/ Shops. Entering a district
reveals that district and its north, south, east and west neighbors, without
recursively revealing neighbors of neighbors. `$worldDiscovery` stores discovered
and visited district IDs for saves/reloads; interiors stay within their parent
`worldArea`. Existing saves initialize discovery from their current district.

Use **Expand world map** for readable district names and a highlighted current
cell. Unknown cells show no names, and discovered cells remain visible after
leaving. Planned districts are markers only, with no travel action. To develop a
future district, give its local map a `worldArea` matching the registry ID; local
width, height, terrain and connections are independent of the atlas. Implement
and review one playable district at a time.

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
- `world-atlas.js`: region-level location icons, separate from walkable maps.
- `world-movement.js`, `world-travel.js`: held-input movement and door transitions.
- `endurance.js`, `skill-progress.js`: sprint breath, recovery, XP rewards and earned skill progress.
- `calendar-data.js`: seasonal starts, Gregorian clock, formatting and legacy time conversion.
- `player-state.js`, `housing.js`: money/health, six listings, physical keys and weekly billing.
- `room-sense.js`, `rest.js`: room visibility/sounds, tiredness/fatigue, beds and collapse.
- `vehicle-cabin.js`, `vehicle-contents.js`: seating/access, saved observations and one-time cash claims.
- `vehicle-geometry.js`, `door-locks.js`: vehicle orientation, ownership/key checks, independent locks and chance calculations.
- `world-action-ui.js`: personal waiting, rest and sleep overlay.
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
stores open/closed flags; `$doorLocks` stores shared lock states, `$endurance`
stores breath/counters, `$vehicleSeat` stores the seated car and exit anchor,
`$vehicleContents` stores cabin cash, and `$skillXp` stores earned XP independently of character creation.
`$inventory` version 2 stores container IDs and item placements. Version-4 equipment
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
