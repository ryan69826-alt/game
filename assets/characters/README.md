# Character artwork

`adult-placeholder.png` is an original AI-generated, transparent PNG placeholder.
It depicts one fully clothed adult, head to boots, in a three-quarter front view
facing right. Chunky pixels and restrained shading keep the silhouette simple.
Transparent space on both sides is reserved for future interaction visuals.
This earlier standalone sprite is retained as a visual style reference.

Reference it in Twee with `asset:characters/adult-placeholder.png`.
The Python build embeds PNG asset references as data URLs in the compiled HTML;
the preview watches artwork changes as well as source changes. Keep the original
PNG here so the placeholder can be replaced without changing story markup.

The customization renderer uses original AI-generated transparent atlases:

- `body-atlas.png`: 4 columns × 4 rows. Rows are Skinny/Petite/Average/Fat;
  columns are Skinny/Toned/Athletic/Muscular. The first cell now supplies the
  single canonical adult head. The remaining full-body cells are retained as
  source reference, not selected as final bodies. Skin and eyes recolor at runtime.
- `male-bodies.png`: 4 × 4 male body parts, from neck to soles, without heads.
- `female-small.png`, `female-medium.png`, `female-large.png`: 4 × 4 female
  body parts per breast size, fully clothed, without heads. Each sheet preserves
  all 16 independent fat/muscle combinations in the same ordering as above.
- `hair-atlas.png`: 4 columns × 2 rows. First seven cells are Shaved/Ear/Neck/
  Chest/Waist/Knee/Floor; last cell is unused. Magenta is a mask color, not the
  final hair color. Runtime isolates those pixels and applies the selected palette.

The head is extracted once into its own object. Its neck anchor is fixed for
every body choice; only height changes head geometry. Body neck anchors are
detected from the skin pixels at the top of each body part. A short overlapping
skin bridge joins each neck to the common head. Head, body, and hair each have
their own canvas layer, then are composited into the visible character canvas.

Eye locations align the hair to the fixed head. The renderer detects the transparent
gutter between hair rows because the generated artwork has uneven outside padding.
Replacement atlases must preserve the cell ordering, blue eye alignment anchors,
tan skin source palette, and magenta hair mask. See `src/character-preview.js`.
