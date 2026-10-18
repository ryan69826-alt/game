# Character artwork

Five independent 288×416 canvases compose the full-body preview: backpack, body,
clothing, head, and hair. The same component is used in creation and the world sidebar.
The head has one fixed neck anchor across all six fits. Native preview resolution,
hard alpha, palette steps, and disabled smoothing keep pixels crisp.

`paper-dolls.png` is an original AI-generated transparent atlas, using the older
male/female atlases as a style reference. It has six columns (male small/medium/
large, then female small/medium/large) and two rows: opaque underwear base bodies,
then matching dressed figures. It restores shaded anatomy, hands, fabric folds,
seams, pockets, boots and laces. Original output is retained in generated_images.
The game has no image-service dependency at runtime.

`src/character-body.js` extracts each cell, removes soft edge alpha/fringes,
quantizes its palette and attaches the selected body to the common head/feet.
Color masks extract independent shirt, pants and shoe layers from the dressed
row. A small neck trim avoids doubling up the head and body's neck. The breast
selector adjusts upper-body rows while leaving the neck/head fixed. A separate
pixel backpack sits behind the body, with its straps in front. Underwear is part of the base body,
so deselecting outer garments does not reveal explicit anatomy.

The approved older head/hair references remain active:

- `body-atlas.png`: its first cell supplies the canonical adult head. Other
  full-body cells are historical references. Skin and eyes recolor at runtime.
- `hair-atlas.png`: first three cells supply Shaved, Ear, and Neck hair.
- `hair-layers.png`: complete Chest/Waist/Knee/Floor templates. Hair aligns by
  eye/face anchors; only its lower curtain stretches. Face masking preserves
  eyes, nose, mouth and jaw. Magenta masks and blue eye anchors stay in sources.

`adult-placeholder.png`, `male-bodies.png`, `female-small/medium/large.png` remain
historical references. The active game does not load those body models. No image,
canvas, geometry or DOM objects enter save data.

The Python build embeds `asset:characters/*.png` references as data URLs, including
the paper-doll atlas, for self-contained offline play. The preview watches source
and assets. Replacement atlases must preserve documented cell ordering, poses,
neck anchor points, skin palette, and clothing mask colors.
