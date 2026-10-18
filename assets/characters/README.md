# Character artwork

The active renderer combines four independent canvases: body, clothing, head,
and hair. Each is composited into the same 144×208 full-body preview in creation
and the world sidebar. Body and clothing are pixel geometry rendered at half
resolution and enlarged without smoothing; there are no baked-in clothes on the
body. Opaque underwear stays on when shirt/pants are deselected.

`src/clothing.js` defines six explicit fits: Male/Female × Small/Medium/Large.
`src/character-body.js` uses the selected fit to generate the corresponding body
and independent shirt, pants, shoes, and backpack models. Shoulders, waist, hips,
arms and legs share attachment coordinates, so a clothing model always fits its
body. Shoes use a similar design with minor fit adjustments. The female breast
selector adjusts both chest and shirt silhouette within the selected fit.

The head and hair use the approved original AI-generated transparent PNGs:

- `body-atlas.png`: first cell supplies the canonical adult head. Remaining
  full-body cells are source references only. Skin and eyes recolor at runtime.
- `hair-atlas.png`: 4 columns × 2 rows. The first three cells supply Shaved,
  Ear, and Neck hair. Magenta is the extraction mask; blue eyes align the layer.
- `hair-layers.png`: 2 × 2 complete hair templates: Chest/Waist, then Knee/Floor.
  The complete curtains have no baked-in clothing or arm holes.

The shared head has fixed position and scale for all six fits. An overlapping
skin bridge joins the neck. Hair fits the head using eye and face-width anchors;
only its lower curtain stretches toward the selected length. Face masking keeps
eyes, nose, mouth and jaw visible. No canvas objects or image data enter saves.

`adult-placeholder.png`, `male-bodies.png`, and `female-small/medium/large.png`
are retained historical references; the active game does not load their bodies.
Replacement head/hair atlases must preserve cell ordering, blue eye anchors,
tan skin palette and magenta hair mask. See `src/character-preview.js`.

The Python build embeds `asset:characters/*.png` references as data URLs for
self-contained offline play. The preview watches both artwork and source changes.
