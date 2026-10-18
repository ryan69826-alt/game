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
  Small is the exact previously published Medium artwork. Medium is a new
  intermediate chest size with a small additional increase for this revision; Large retains its original artwork.
- `hair-atlas.png`: 4 columns × 2 rows. First seven cells are Shaved/Ear/Neck/
  Chest/Waist/Knee/Floor; only the first three are used by the current renderer.
  Magenta is a mask color, not the
  final hair color. Runtime isolates those pixels and applies the selected palette.
- `hair-layers.png`: 2 × 2 complete head/hair templates, Chest/Waist on the top
  row and Knee/Floor on the bottom. No clothing or arms are present in this art,
  so their silhouettes cannot leave baked-in gaps in the long hair.

The head is extracted once into its own object. Its neck anchor is fixed for
every body choice; only height changes head geometry. Its scale is 84% of the
first prototype's shared head, between the oversized first version and the
undersized 72% revision, for a balanced stylized adult figure.
Body neck anchors are
detected from the skin pixels at the top of each body part. A short overlapping
skin bridge joins each neck to the common head. Redundant upper-neck pixels are
trimmed so the head and body necks do not add up to an overlong neck.
Head, body, and hair each have
their own canvas layer, then are composited into the visible character canvas.

Eye locations align the hair to the fixed head. The renderer detects the transparent
gutter between hair rows because the generated artwork has uneven outside padding.
Hair width fits the head using skin beside the eyes. For long styles, only hair
below the neck stretches to the chest/waist/knee/floor endpoint; head-sized caps
remain unchanged. Both draw sections use one shared integer row to prevent a
one-pixel seam. Complete curtain outlines are preserved without rectangular cuts.
One-pixel irises remain visible when shrinking the head would skip source eye pixels.
The actual rendered head silhouette also protects the front face below the brow:
hair pixels are removed where they would cover that face. This preserves eyes,
nose, mouth, and jaw even when template faces have different outlines. Fringe
above the brow and hair at the rear temple remain visible.
Replacement atlases must preserve the cell ordering, blue eye alignment anchors,
tan skin source palette, and magenta hair mask. See `src/character-preview.js`.
