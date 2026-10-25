# Neon Meridian

A modular browser RPG prototype built with Twine 2, SugarCube 2.37.3 and Tweego
2.1.1. For the click-to-play site, see [GitHub Pages deployment](DEPLOYMENT.md).
The protagonist is an adult woman (age 26). Apartments, B1 Warehouse / Storage, A1 Low Density Housing, D1 Transit & Shops, and E1 Nightlife are available;
no story, NPC schedules, or trait modifiers have been added. The game clock advances with movement only.

## Current character and equipment

The menu has Character Creation (Continue after starting), Options, and
Import/Export Saves. The creator is female-only, with an independent genital selection,
three eye colors, five hair colors, seven hair lengths, four skin tones, and four seasonal start dates.
Body size and breast size controls are removed. The protagonist uses one fixed female base;
old male saves migrate to it without losing other choices, equipment, traits or XP.
The female base is prepared from
user-provided pixel art, retaining its original bodysuit, head and proportions.

Clothing dropdowns follow Appearance: Top, Bottoms, Shoes, Wearable Storage, and
Handheld. Current choices are None or a generic shirt/pants/shoes/backpack; Handheld
has None until handheld equipment is added. The female shirt, pants and shoes are
independent garment-only assets, aligned directly to the base rather than extracted
from a dressed character. Deselecting garments leaves the bodysuit visible.
Hair remains a separate layer. All layers use hard alpha
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
The sidebar lists Inventory **[i]**, Quests/Jobs **[j]**, Character **[c]**, then Stats.
Press **I** for Inventory, **J** for Quests/Jobs or **C** for the read-only character sheet; shortcuts
ignore typing, held-key repeats and browser modifiers, and pause
held movement when opening a window. Press the matching key again to close its
window; another screen’s key does not replace the open window. Quests/Jobs has empty quest and job sections.
The character sheet begins with a compact identity/appearance grid, omits clothing
and labels its trait section **Traits**. The sidebar map counts **discovered** areas.
Character and Stats are read-only windows over the map; Inventory is also a
window. Escape, close button, or backdrop closes them. Character creation cannot
be reopened after starting. Use a private browser window to review a fresh creator
without changing an existing playthrough; disk export preserves saves across origins.

## Apartments, housing, money and health

The four buildings each contain one floor with four furnished studio apartments in one row.
Each floor plan (including furniture and unit doors) rotates to match the outdoor
building's entrance toward the park. Open an entrance with E, then choose Enter;
inside, Open and Exit returns through the corresponding outdoor door. The
world map sits above the sidebar character and is an area atlas: Apartments is one icon, selected while outdoors or
inside any building in that area. District names live in `district-data.js`;
the atlas never renders local tiles, cars, or camera bounds. The sidebar shows
a close view centered on the current district, with separated nodes and lines
only to registered, playable exits. Known areas without a direct route appear
muted. A2 is not accessible from A1; B2 is not accessible from B1. Discovery
and the full map overlay retain all previously found districts. The right-side local
map uses the freed height and adjusts its outdoor camera rows to fit the panel.

Unit numbers run 1–4 from the entry end of one shared corridor. The complete
plan rotates with the building. Each studio has its own bed, kitchenette,
dining table and enclosed bathroom. Two-tile sidewalks and open gaps connect
all four buildings around the park.

The north-facing Housing Office stands immediately right of Apartment 3, linked
by sidewalk. The office is 8×8 outside and 12×12 inside, with a rental desk
and a separately enclosed storeroom. Its receptionist is behind a blocking desk; approach the service
positions on the front side and press E. The first screen has Talk and Attack.
Talk → Rent apartment lists six physical units: Apartment 1 units 2 and 3,
Apartment 2 unit 3, Apartment 3 units 1 and 4, and Apartment 4 unit 4. Attack is an explicit
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
instead and cannot use endurance again until usage falls strictly below 80% of
maximum (below 20 at the base 25). This recovery state survives saves/reloads;
holding Sprint resumes running once the threshold is crossed.
Endurance use recovers by **2% of its current used amount per five non-sprinting game
seconds**: 10 becomes 9.8, then 9.604. Multiple ticks compound (`used × 0.98^ticks`).
Fractional usage is preserved; values below 0.005 settle to zero to match the
meter’s two-decimal display. This includes
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
own grid; an unequipped item grants no storage. Initial equipment is selected in creation; clothing can also be removed and worn during play through Inventory. Trunks contain placeholder
water (1×2), tools (2×2), and cloth (1×1) to test packing/transfers. Each trunk is
independent, initialized only once, and never restocks when emptied. Contents and
placements persist through movement, reload, menu/Continue and disk saves.

## World and movement

Apartments is a 90×74 grid: four buildings face a park, a parking lot has edge and
median bays, and two five-square-wide roads meet at the south edge. Cars occupy
2×2 squares. A continuous sidewalk surrounds the park and connects each entrance.
The courtyard uses patchy grass, irregular low shrubs, mature tree canopies and
two worn benches, with bare patches around the seating. This is inexpensive
landscaping for low-end housing; the surrounding sidewalks remain clear.
Scenery lives in `courtyard-park.js`, separately from movement geometry.
Doors are walkable thresholds; buildings, cars, trees, and medians block movement.
The buildings and landscaped courtyard sit ten squares closer to the southern
road. A compact marked lot sits southwest beside the road with two rows of bays,
a clear driving aisle, a road entrance and a sidewalk to the apartments.
Overflow parking remains on the east side, connected by a short driveway; the
housing office fronts the courtyard, with a grass buffer before the southern
sidewalk and road. Apartment 2 sits slightly north to leave room for the office. Vertical sidewalks stop at
the intersection instead of continuing through the empty southwest corner.
Version-5 saves move office-entrance positions and ground items with the office,
without changing interiors, leases or vehicle contents. Version-4 saves relocate parked players, seated vehicle anchors and ground piles
together, preserving items, keys, leases and elapsed time.

The description takes 60% of the main area and maps take 40%, beside the character
sidebar. The scrolling local map occupies the right-side panel; the world atlas
of area icons sits above the character in the left sidebar.
Both maps fit desktop viewport heights; narrow screens stack them below the text.
The sidebar starts with the map, followed by the portrait; redundant branding,
character headings, gender/model text and age captions are omitted.
Endurance sits directly beneath health; shorter desktop viewports reduce the
full-body portrait height so both meters remain visible without sidebar scrolling.
The compact movement panel above the location title is the only exact-location
readout. Player coordinates are displayed starting at 1.

Use arrows, WASD, direction buttons, or click an adjacent square. Every successful
cardinal step advances five seconds. Holding repeats every 200 ms. Multiple held
directions alternate at that shared pace; releasing one leaves the others active.
Direction aliases share a slot. Blocked attempts cost nothing and keep inputs
active. Dialogs, blur, hidden tabs, and navigation clear held inputs. Movement and
elapsed game seconds persist through reloads, Continue, and disk saves.

## Removable clothing and ground items

On desktop, Inventory has four columns: nearby storage and ground items on the
left, a larger full-body character view, carried pockets/bags, then equipment on
the right. The Drop on ground button sits below the character (Drop to cabin
floor while seated) and fills the remaining portrait-panel space as a large
drop target. The portrait
updates after clothing changes and uses the same crisp artwork as the sidebar.
Narrow screens stack the panels without horizontal scrolling.

The right panel groups fifteen slots in body order: Hat, Face Wear, Over Top,
Top, Under Top, Waist, Wrists, Hands, Bottom, Under Bottom, Ankles, Feet, Shoes,
Back and Handheld. Empty future slots provide no inventory capacity. Existing
shirt, pants, shoes and backpack remain usable; creation retains its five current
clothing dropdowns. New characters and old saves normalize the extra slots to empty.

Augmentations sit below clothing in four separate positions. The leftmost starts
with a **Basic ID chip**, which cannot be dragged, transferred or removed by player
actions. Augmentations provide no item storage. `augmentations.js` keeps installed
records separately from clothing; explicit empty slots remain empty so a later
story event can remove an implant without it being automatically reinstalled.
Corporate parking clearance now requires the installed ID chip as well as its
authorization record. Granting clearance alone cannot replace a removed chip.

Unequipped clothing shows its destination slot directly below its name in all
storage and ground grids; the label also stays visible on its drag preview.
Inventory shows draggable equipment slots. Drag a garment to reachable storage,
another garment's bag, or **Drop on ground**; select then choose a block/drop
button as a keyboard/touch alternative. Drag a stored garment onto an empty
matching slot, drop it onto the center character to use its matching empty
slot automatically, or select **Wear**. Remove the existing garment in that slot first.
Removing/equipping items takes no game time and refreshes the sidebar sprite.

Shirts and pants occupy 2×2 blocks folded, shoes 2×1, and backpacks 2×3. Each
removed garment embeds its pocket arrays on the item itself. Pocket contents,
including garments nested in a backpack, travel with that item; wearing it again
restores its active pocket layout. Unworn pockets do not grant player carrying
space and are accessed again by wearing the garment. Own-pocket placement,
blocked/overflow drops, stale external access and occupied equip slots reject
without detaching or deleting items. Initial wardrobe saves need no inventory
reset: garment identities are assigned when first removed and retained on rewear.

Ordinary items can also be dropped on the current tile. Ground piles use local
8×8 grids in `$inventory.containers['ground:MAP:X:Y']`; no empty pile is created
merely by opening Inventory. A small parcel marker shows nonempty visible piles;
E → View items opens a reachable pile. Piles and garment contents survive travel,
reload and disk saves. Hidden rooms conceal their piles. Dropping while seated
uses the actual cabin grid, rather than putting an item outside the car.

`equipment.js` owns garment transactions, saved `garmentSerial` and
`wornGarmentIds`. `ground-items.js` owns tile-bound pile definitions and access.
The existing inventory/drag modules handle packing, pointer cancellation and
reachable storage consistently. Drops outside storage/drop zones are cancelled;
dragging onto the visible local map drops at the player's feet.

## Building proportions and developer tools

Every accessible building uses an interior grid 1.5 times its exterior width
and height, rounded up. `interior-sizing.js` expands floor space and wall layout
while keeping furniture, people and door thresholds at their normal tile sizes.
Large interiors scroll around the player. The nightclub is 42×21 inside its
28×14 footprint; each 12×12 house is 18×18 inside. Apartment buildings are
32×10 or 10×32 outside and 48×15 or 15×48 inside. Each contains four studios
in one row. The district widens to 90 tiles, restoring both sides of the
five-tile intersection at the southwest corner (vertical road x=4–8).

World save version 6 migrates previous player positions, seated positions and
ground containers once, using frozen v3 geometry in `layout-history.js` and
version-4 district relocation offsets.
`layout-migration.js` maps retired unit IDs 5 and 6 to 3 and 4 in the same
building; old physical keys retain their identities and work for the replacement
unit. Leases retain due dates and arrears. Ground piles that converge on one
location receive separate nearby tiles, preserving their contents. Money and
elapsed time remain unchanged.
New building definitions should supply an exterior footprint and register before
`setup.interiorSizing.apply()` in `world-map-data.js`.

Press **P** while playing to open Developer tools over the world. **Max out all
stats** sets all 18 skills to level 10, restores health, clears tiredness/fatigue
and endurance usage, and gives at least $999,999,999. Endurance capacity becomes
300 through its existing skill rule. Creator XP allocations remain intact;
these changes persist in saves and cost no game time. The separate **Grant /
Revoke corporate parking clearance** button changes authorization on the ID
implant for testing F1. Maxing stats does not grant access. Escape closes the window.

## Low Density Housing (A1)

Walk west beyond B1 to enter A1 and east to return. The 100×90 local map shares
road rows 44–48 with B1 (aligned with C1 rows 64–68). Five modest houses stand north of the road and four
south, with entrances facing the street. The road retains five driving squares
and adds two-square curb parking strips on each side, plus sidewalks. Its western
end is a turning cul-de-sac with a surrounding sidewalk, rather than a road off
the map. Parking starts beyond the bulb, and the center line ends before it.
Car identities and contents survive relocation of the former westernmost bay. Long bays
and east/west-facing cars represent parallel parking; existing vehicle locks,
side/rear interactions, separate inventories and cabin behavior still apply.

All nine 12×12 houses have enterable 18×18 floor plans, larger than the
apartment studios: a bedroom, side room, combined living/dining room and
bathroom. North-facing houses rotate the complete plan and bed artwork by 180°.
Bedroom, side-room and bathroom doors hide their room until the player enters or
stands beside its open door. Room descriptions, sounds, sleeping and dropped-item
visibility use the actual room. No occupants, footsteps or traffic are simulated.
Front doors start unlocked to allow layout review; house purchases/rentals and
ownership are not implemented. Existing apartment listings are unchanged.

`neighborhood-district.js` defines A1 and registers its edge connection;
`house-interiors.js` shares one floor plan across the nine homes. House rooms use
`map.rooms`, separate from apartment `map.units`, and their `worldArea` remains
`a1` while indoors, so the atlas does not discover unrelated districts.

## Warehouse / Storage (B1)

Walking west beyond any open tile on the Apartments west edge enters B1;
walking east beyond B1 returns. Crossing counts as one ordinary walking/sprint
step (5/2 game seconds), including endurance and billing, with no interaction
menu. The connection uses a 20-row offset: C1 rows 64–68 align with B1 rows
44–48. B1 is 70×90, extending south of the road; Apartments is 90×74.
The warehouses and mechanic stand south of the road. B1 rows beyond the
Apartments boundary have no eastward exit; they cannot warp back into C1.
Other map connections may use explicit coordinate offsets or proportional alignment.

The self-storage compound has ten reinforced units, fenced across the back and
sides with an open southern frontage. Its automated front-office kiosk rents
only units 2, 6 and 9 for **$200 per week each**. The first week is charged now;
later payments use the apartment billing convention: automatic weekly collection,
with unpaid charges kept as arrears, without eviction or destruction of items.
Inspect a rented unit for its due date and outstanding balance. The kiosk
dispenses a physical 1×1 key onto its three-slot tray; use Collect storage keys
and move the matching key into a worn pocket or bag. Full pockets leave it on
the tray. Rental ownership alone does not grant access. Keys in removed clothing
or distant storage do not unlock the unit, and lost keys are not reissued.
Existing leases receive their key at the kiosk once, preserving dates, balances
and stored items; nested garment keys are detected to prevent duplicate issuance. Other units cannot be rented or
lockpicked, and the future breaching tool is not implemented.

Approach your rented shutter and use E → Open storage to access an initially
empty 8×6 block inventory beside worn pockets/bags. Drag or select/place existing
items using the same packing rules as car storage. Units keep separate contents
through travel, reload and disk saves. Every transfer checks ownership and reach;
there is no remote access or invisible carrying capacity. The warehouse loading
doors remain inaccessible; the mechanic service terminal only describes future
vehicle repair. No repair action, fee, NPC activity or new tool is added.

`storage-district.js` registers geometry through `world-map-data.js`;
`self-storage.js` owns lease/access rules in `$selfStorage` and persistent unit
containers use `$inventory.containers['storage:b1:UNIT']`. The western street and
sidewalks flare to meet A1's wider curb lanes without an abrupt boundary offset.
Region-edge connections live in each map's `exits` metadata and are resolved by `world-travel.js`.

## Transit & Shops (D1)

Walk east off Apartments to enter D1; walking west returns along the aligned road.
Continuing east off D1 enters E1 Nightlife.
A shopping center and compact parking lot sit immediately north of the roadside
sidewalk, with no grass gap. A central driveway extends just one row (y=43) from the road to the lot;
no road cuts through the lot to its northern edge. Two-tile sidewalks flank the lot and run along the connected shop frontage.
The discount store anchors the west side, with its door facing east into the lot;
the other four shops form an adjoining row along the north side.
The shops are a discount store, food stall, laundry, barbershop and electronic
repair store. Four shops have
explorable interiors; the food stall is an outdoor counter. Shop services remain
placeholders for later development.

South of the road, two small 20×8 parking lots flank the pedestrian approach
to the train platform. Each has edge bays, an open aisle and a road entrance. Approach the
stationary train and use E → Board train to see destinations. B6, H4 and F3 are
listed as unavailable future stops; no remote platforms are playable yet. The
tracks lead into tunnel mouths at both ends. Train travel has no schedule, fare
or time cost, and becomes available as destination stations are built. A station
must have a registered, walkable arrival point, and boarding rechecks proximity.

`transit-district.js` owns D1 geometry and shop interiors; `transit.js` owns the
station registry, destination availability and boarding window. The train sound
is limited to the platform area, with no unmodeled crowds or traffic.

## Nightlife (E1)

Walk east off D1 Transit & Shops to enter E1; walking west returns. The 100×70
local grid has its main road at rows 60–64; an explicit 16-row offset aligns
it with D1 rows 44–48. Two four-tile alleys run north
from the street, and a four-tile back alley connects their northern ends. Three
strips of attached buildings enclose the alleys: bar and clothing store to the
west, hotel/casino/nightclub in the middle, and small club/tattoo parlor to the
east. Colored sign borders and entrance strips identify each venue. Street
sidewalks continue across district boundaries. The east edge reaches F1 Executive Offices.

The nightclub has its street entrance plus a door on each alley. The hotel and
casino also have entrances on both alleys, with open asphalt approaches. Each
pairs with an interior exit and shares its own lock/open state with that exit.
The casino is 28×26 outside (2.6 times its former area), with a 42×39 interior.
The tattoo parlor is reduced to 12×10 outside and 18×15 inside.

All seven venues have explorable, simply furnished interiors. The front doors
start unlocked, use the existing Open/Close and Enter/Exit interactions, and
share their state with the corresponding interior door. Entrances and interior
exits face the same direction. Bars, counters, racks, tables, seating and a tattoo
chair block walking; the open floors and all entrances remain connected.
The hotel currently contains its reception lobby, with guest rooms and booking
left for later. Venue purchases, gambling, tattoos, staff and events are not
implemented in this layout pass.

Inside the small club, approach the stairs and use E → Go downstairs to enter
the underground club. Its stairs offer Go upstairs and return to the small club.
These transitions use no time or money, and underground saves retain the correct
map and E1 atlas location. Stage and lounge furniture provide the initial basement
layout. Sounds describe ventilation, sign electronics and air in the back alley;
there are no invented crowds, music, footsteps or traffic.

`nightlife-district.js` registers the outdoor block, venue interiors and both
stairway directions. All belong to `worldArea: 'e1'`, so entering buildings does
not reveal unrelated districts. Entering E1 reveals its adjacent E2 and F1
markers. F1 is playable; E2 remains unavailable.

## Executive Offices (F1)

Walk east off E1 to enter the 120×100 corporate campus; the boulevard remains
at rows 60–64. Pale stone promenades, clipped trees and glass-fronted towers
separate this area visually from Nightlife. Meridian and Apex Towers each have
12 floors; Crown Tower has 16. Their lobbies, Skyline Restaurant, Corporate
Clinic and Security Office can be entered through E → Open → Enter.

Every tower floor is a real, saved map with an elevator. Approach it and use E
to choose any floor; the lobby permits return outdoors. Upper levels contain
leadership offices, boardrooms and executive suites with placeholder furniture.
Floor changes cost no time. Jobs, staff, dining and medical services come later.
All floors share their tower's exterior footprint and the 1.5× sizing rule.

The parking lot south of the boulevard has a continuous fence and a five-tile
barrier. E → **Scan ID implant** denies entry without Executive Parking
clearance. It cannot be lockpicked. Use the P developer menu to grant/revoke
clearance for review; an accepted scan opens the barrier, and E → Close gate
closes it again once the player is clear. Clearance, gate state and floor
position persist through saves/reloads. Parked vehicles retain the usual
independent door/trunk locks and inventories. There is no default corporate
clearance, and maximum skills do not bypass the scanner.

`executive-district.js` defines the campus and floors; `executive-access.js`
owns the small, serialized ID-clearance record. This is the initial access hook
for later implant issuance and corporate progression.

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
to 250 in skill order. `$world` stores only map ID, position and elapsed seconds (v6). `$openedObjects`
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
movement/held-direction pacing, interaction reach/actions, nose-in parking/headlight orientation, directional car access, oriented four-unit interiors and portal returns,
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


## Seasonal temperature and attribute sensations

Temperature is the first environmental input for character attributes. **How you
feel**, below Sounds, describes cold, comfort or heat. The current outdoor
temperature is displayed beside the sidebar date in Fahrenheit to one decimal
place, updating with game time and retaining the same forecast on reload. Equipped clothing now determines insulation, as
described below. Body-heat accumulation, health damage and other attribute
penalties are not part of this step.

The prototype uses **Fahrenheit** and a temperate Northern Hemisphere climate:
the seasonal morning baseline averages 35°F in mid-January and 85°F in mid-July.
This curve is 10°F warmer throughout the year than the original climate; existing
playthroughs retain their weather seed and receive the same 10°F shift.
Each date's 7 AM baseline is randomly selected within a **25°F-wide seasonal
window** (±12.5°F), constrained to at most **5°F above or below the previous day**.
The yearly forecast also constrains December to meet the next January smoothly.
Leap years have 366 daily values. Seasonal values and units can be tuned in
`weather.js` without changing calendar or movement code.

From 7 AM to 7 PM, temperature rises linearly by **10°F** above that morning's
baseline. From 7 PM to the next 7 AM it falls linearly to the next day's morning
baseline. Midnight is part of that continuous nighttime transition; it does not
reset the temperature. Waiting, sleep, movement and calendar rollovers all use
the same in-game clock. Opening dialogs and real-world waiting do not change it.

A saved random seed fixes each playthrough's forecast; bounded runtime caches
hold derived annual arrays without bloating saves or movement history. Older saves
without a seed derive one from their existing character, so reloading before the
next saved action does not reroll the forecast. Forecasts
can be queried in any order without rerolling dates or breaking year boundaries.
`attribute-effects.js` translates temperatures into player-facing sensations and
updates on passage display, game-time changes and clothing changes. Raw values
remain in simulation.


## Weighted clothing warmth

`warmth.js` calculates the weighted average of **equipped** clothing insulation:

| Weight | Slots |
| --- | --- |
| 3 | Top, Bottom, Over Top |
| 2 | Under Top, Under Bottom, Feet, Hands, Shoes |
| 1 | Hat, Face Wear, Wrists, Ankles |

The denominator stays **23**. Empty weighted slots contribute **zero**, so taking
off a major garment lowers insulation rather than raising the remaining outfit's
average. Waist, Back, Handheld and augmentations do not contribute. Stored or
dropped clothes and their pocket contents do not contribute either.

Ordinary garment warmth values are 1–10. Simple Glasses and Cheap Watch each
contribute −1 warmth because they are metal; signed values are retained in the
weighted calculation. Values live beside the item in the clothing definitions. Initial
placeholder values are **shirt 4, pants 5, shoes 3**. A completely covered outfit
with all values 10 averages 10; an unclothed player averages zero. The current
shirt/pants/shoes outfit averages `(4×3 + 5×3 + 3×2) / 23`, including its empty slots.
Old saves automatically use the item definitions; no inventory reset is needed.

The world requirement scales linearly from **8 at 0°F** to **2 at 100°F**, capped
at those limits: `8 − 0.06 × temperatureF`. These endpoints live in
`setup.warmth.climate` and also supply the developer tool's displayed formula.
The hidden difference is `clothing average − world requirement`. Use the exact
difference without rounding to apply these feeling bands:

| Exact difference | Feeling |
| --- | --- |
| ≤ −4 | Freezing |
| Greater than −4, through −3 | Cold |
| Greater than −3, below −2 | Chilly |
| −2 through +2 (inclusive) | Comfortable |
| Greater than +2, below +3 | Warm |
| +3 through below +4 | Hot |
| ≥ +4 | Overheating |

**How you feel** shows a description, with numeric clothing warmth and the
comfort difference hidden. The ambient temperature is visible beside the date. Removing, wearing or changing clothing refreshes it
immediately without passing time. Movement, waiting and sleep refresh it through
the same game-time temperature system.


## Spreadsheet clothing catalog and developer selector

Press **P → Clothing selector**, choose a slot and an item, then **Equip clothing**.
Choose None to remove that slot. All 34 wearable items from the supplied sheet
are available here, including the Handheld Fishing Pole; the existing Basic ID
chip remains fixed in its augmentation slot. **Character creation still has its
original five dropdowns and original item choices.**

`clothing-catalog.js` contains names, slots, warmth, independent pocket rectangles,
provisional folded sizes and placeholder art styles. Generic Shoes belongs to
**Shoes**, following the correction to the sheet. Existing generic shirt, pants,
shoes and backpack IDs are retained for saves and marked “legacy” in the developer
selector. Plain Pants is a new catalog item with two 2×1 pockets; the old Generic
pants retain their original four 1×1 pockets. The new Basic Backpack has its own
4×4 compartment; carrying one in storage never grants its capacity.

The Hoodie has one 1×2 pocket. Plain Shirt, T-Shirt, Long Sleeve Shirt, Sports Bra
and Plain Bra each have one 1×1 pocket. Basic Belt has two 2×1 and two 1×1 pockets
(six blocks); Plain Pants and Shorts have two 2×1 pockets each; Skirt has two 1×1
pockets. All other catalog garments have no storage. Belt warmth is recorded as
2, but Waist stays unweighted under the current warmth rules, as do Back and
Handheld. Backpack and Fishing Pole have no warmth rating. Other unspecified
item statistics and tool actions have not been invented.

Replacing equipment through the developer tool places the old garment at the
player's feet (or on the cabin floor), retaining its identity and all nested
pocket contents. If it cannot fit, replacement fails without changing equipment
or deleting items; move to a clear tile to continue testing. A new garment starts
with empty pockets. The tool does not charge money, spend game time, grant access
rights or alter starting traits and skills. Equipped choices survive reloads and
portable saves through the normal clothing and inventory systems.

New garments use separate, temporary tinted garment templates and pixel overlays
in `clothing-art.js`. They do not redraw or reshape the approved body/head. Art
can be replaced item by item later; the fishing pole has only a placeholder
appearance and no fishing interaction yet.

Press **P → Warmth calculation** to inspect the current temperature, each weighted
slot's equipped item, warmth, weight and contribution, the fixed-denominator
clothing average, world requirement, difference and resulting comfort category.
Empty weighted slots and negative metal warmth are included. The view explains
unweighted slots and exact comfort thresholds; it does not change equipment or pass time.

### Clothing durability

Each catalog item now has the maximum durability from the supplied sheet.
The Basic ID chip has no durability. Existing generic shirt, pants, shoes and
backpack use 50, 75, 30 and 100 respectively, matching their catalog equivalents.
Old garments without a saved condition start intact; no inventory reset is needed.

Condition belongs to an individual garment: equipped condition lives in
`character.clothingDurability`, and removed items carry `durability` beside their
identity and pocket contents. Dropping, storage transfers, re-equipping, reloads
and portable saves preserve it. Same-type garments can have different condition.

At **75%, 50%, 25% and 0% remaining**, the isolated garment rendering gains another
stage of fading and pixel tears. These are percentages of its own maximum, not
25-point steps. Intact, Worn, Tattered, Ragged and Broken labels appear with the
current/maximum durability in inventory; unequipped items also show the numbers.
The underlying body/head and other garments remain independent.

At **0 durability**, warmth, protection, stealth and water-protection contributions
are zero. Above zero their values are unchanged. `clothingCondition.effectiveStat`
is the shared getter; warmth, protection, stealth and water protection use it. Negative metal
warmth also stops applying when broken. Broken clothes remain wearable and keep
their storage compartments and contents.

Use **P → Clothing durability** to select an equipped slot and set a value, or
click **100%, 75%, 50%, 25%, 0%** to test the stages. These controls spend no game
time and can restore condition for testing. `clothingCondition.damage(slot,amount)`
provides the hook for later actions; this update adds no automatic damage from
walking or other gameplay actions and no player repair mechanic.

### Stealth percentage

The player has **80 base stealth out of 100**. Each equipped item's signed
Stealth value from the sheet is added, then the result is capped at 0–100.
Positive values help and negative values hinder. Empty slots, carried/stored
clothes, augmentations and zero-durability gear contribute nothing. All clothing
slots contribute equally; warmth's slot weights do not apply to stealth.
Any condition above zero retains the item's full modifier, including penalties.

Legacy generic shirt, pants, shoes and backpack use 0, +5, −15 and −30,
respectively. Thus the original shirt/pants/shoes outfit starts at **70/100**
after modifiers; an unclothed player has **80/100**. Generic Shoes remains in
Shoes following the earlier correction to the sheet. No items are added to the
creator. `player.baseStealth` persists with a default of 80 for old saves;
the final score is calculated from current equipment rather than saved twice.

`setup.stealth.calculate()` returns the base, clothing rows, total modifier,
score and complementary detection chance. Encounters can explicitly call
`setup.stealth.check()` to roll 0.01–100 in 0.01 increments: a roll at or below
the score means undetected; a higher roll means detected. At 0 stealth detection
is certain, and at 100 remaining undetected is certain. The helper reports the
outcome; the calling encounter owns consequences, time and any XP awards.
This update does not introduce NPC patrols or checks on walking/lockpicking.
The existing Stealth skill and its XP are separate; no level-based adjustment
has been invented.

**P → Stealth calculation** shows the exact hidden numbers and the per-slot
breakdown, including raw versus effective modifiers on broken gear. **Test stealth
check** uses the same check function without passing time, spending money,
awarding XP or setting NPC detection flags. Normal player-facing views continue
to hide exact attribute numbers.

### Protection and damage

Equipped clothing protection adds together: **one point reduces incoming damage
by 1%**, capped at **80% damage reduction**. There is no innate protection and no
slot weighting. Empty slots, stored items, augmentations and broken gear contribute
zero; positive durability keeps the full item value. The catalog uses the supplied
sheet. Legacy shirt, pants, shoes and backpack have 1, 2, 1 and 0 protection.
The original outfit therefore has 4% reduction. A coat (2), shirt (1), plain
pants (2) and boots (3) currently total 8%; stronger gear can use the same 80% cap.

`setup.protection.calculate()` exposes total points, capped reduction and rows.
`setup.protection.previewDamage(amount)` returns a read-only calculation:
`damage = incoming × (1 − reduction / 100)`. Amounts, final damage and health are
rounded to two decimal places, so a 1-damage hit against 4 protection deals 0.96.
Health remains bounded at 0–100 and decimals survive reloads.

Incoming hits use **`setup.playerState.takeDamage(amount)`**, which applies
protection once and commits the resulting health. The existing `changeHealth`
method remains a direct adjustment for healing and stat corrections; it does
not apply armor. Healing is unchanged by protection. Invalid negative/nonfinite
incoming damage is rejected. A hit does not automatically damage clothing, pass
time or award XP; those effects belong to the encounter when implemented.

**P → Protection calculation** shows raw/effective contributions and the cap.
Enter damage and use **Preview damage** to see the calculation without changing
health, or **Apply test damage** to use the real protected damage handler and
update sidebar health. The exact protection numbers stay in developer tools.

### Waterproof clothing and wetness

Water Protection uses the sheet's binary values: **0** means water can wet the
item, and **1** means it stays dry on exposure. **Jacket and Rain Coat are 1**;
the other clothing entries, including the legacy shirt/pants/shoes/backpack, are
0. Fishing Pole and the Basic ID chip are N/A. This updates only Water Protection;
other columns remain as previously supplied (and Generic Shoes remains in Shoes).

Wet, non-waterproof clothing supplies **half its normal warmth** before the slot
weight is applied. Repeated exposure does not halve it again. Drying restores its
normal warmth without restoring durability. Signed warmth is halved literally,
so the −1 glasses/watch warmth becomes −0.5 when wet. Protection and stealth are
unaffected by wetness. A broken item still supplies zero warmth; a broken jacket
or rain coat also loses waterproofing and can become wet.

Each garment saves its own wet flag alongside durability while equipped, then
carries it on its inventory placement when removed. Condition changes preserve
wetness unless waterproofing becomes active. Drop/storage/equip/reload preserve
the flag and pockets, same-type garments can differ, and old items default to
dry. New clothing injected by the developer selector starts dry.

`clothingWater.status(slot)` reports waterproofing, wetness and effective warmth;
`clothingWater.expose(slot)` applies water to that equipped garment, and
`clothingWater.dry(slot)` dries it. The shared warmth getter and calculation use
this saved state. **P → Water protection** exposes the same controls, and inventory
shows **Wet** on affected garments. **P → Warmth calculation** reflects the halved
values. These controls do not spend time, award XP or damage clothing.

This update adds no rain/swimming triggers, timed drying, protection for inner
layers or water spreading to pocket contents. Future events must expose the
appropriate individual garments explicitly.
