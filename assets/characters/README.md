# Character artwork

Five independent 288×416 canvases compose the full-body preview: backpack, body,
clothing, head, and hair. Creation and the sidebar share the renderer. Hard alpha
and nearest-neighbor sampling keep edges crisp. No artwork objects enter save data.

## Fixed female base

`female-base-layers.png` is a transparent four-cell horizontal sheet prepared from
the user's reference with its white bodysuit intact. Cell 0 contains the whole adult
character, including the original proportional head. Cells 1–3 contain only a teal
shirt, navy pants, and dark shoes. No garment contains another garment's pixels.
The original image-generation output is retained in `/workspace/generated_images`.

`src/character-female.js` cleans matte fringes, recolors skin/eyes and draws each
cell at its own documented base-coordinate anchor. Every garment fits the same
fixed silhouette regardless of other equipment. The base's head/body split uses
the same transform to preserve the neck. There is no breast or body distortion.
Deselecting all equipment still shows the opaque bodysuit. A separate backpack
renders behind the body with its strap in front.

## Unchanged male art and shared hair

`paper-dolls.png` retains its historical six-column/two-row layout. Only column 1
(the original Medium male body/outfit) is active. `src/character-body.js` preserves
its existing color-mask garment extraction and common head attachment.
`body-atlas.png` supplies the existing male head. `hair-atlas.png` supplies short
hair and `hair-layers.png` supplies Chest/Waist/Knee/Floor hair. Hair aligns by
face anchors, stretches only below the neck, and is masked to preserve the face.
The female base uses its own head and face anchors rather than the old male head.

Other body atlases remain historical references, including `female-dolls.png`.
The build embeds active PNG assets into the standalone HTML; no image service is
needed at runtime. Body-size and breast-size fields remain normalized to Medium
only for save compatibility; neither has a creator control or alters the base.
