# Workspace recovery checkpoint — 0.5 in progress

The executor disconnected with `409 environment_offline: Environment is not connected`. Two connection attempts failed. The local 0.5 changes passed **71 tests and the production build** before the disconnect, but were not committed or deployed.

## Durable deployed checkpoint

- Commit: `7272e56bb743694f6c727617543ff4f32d9862da`.
- Pages run: https://github.com/createdoutofthinair/vr-world/actions/runs/38197643541 — build, 67 tests and deployment succeeded.
- Website: https://createdoutofthinair.github.io/vr-world/
- Editor: https://createdoutofthinair.github.io/vr-world/#editor
- Prior 0.4 artifact delivery was independently checked by matching the homepage, seven application/worker/style/logo files and eight scene WebP files against local SHA-256.
- Browser/GPU inspection and native VP checks remain unperformed.

## Resume without losing uncommitted work

First inspect the working tree at `/workspace/scratch/6d7bb16a78f9/vr-world` if that environment returns. Do not use a hard reset, clean, or replace the checkout before preserving its changes. The 0.5 edits below may still exist there. If the environment was discarded, reconstruct them from this record and the implementation tool-call history against the deployed 0.4 checkpoint.

## Unpublished implementation

1. **Schema/generator 5 / 0.5.0:** migrations preserve v1–v4 documents. Add `EffectSettings.viaduct=false`, `WorldSettings.viaductHeight=3` (2.5–5 m), and the `metal` material role. Metal defaults: panels, gray `#69767c`, roughness .55, metalness .6. Update package versions and legacy project-key lookup. The new feature is versioned to avoid silently changing the meaning of older generator recipes.
2. **src/core/viaduct.ts:** a separate elevated route over the existing ground street network. It requires a three-block neighborhood. Spacing is block frontage + road width + two pavements. X endpoints are ±1.5 spacing; Z is −.5 spacing. Deck height is .015 + requested height × clamp(min((x−x0)/spacing,(x1−x)/spacing),0,1). The central span is flat; the outer spans are approaches. Reject an approach grade over the **application** budget of 12%, without claiming a native limit. Road/pavement ribbons are rebased into ≤4 m pieces, with .06 m undersides, raised pavements, metal guards, lane markings, rock footings/piers and metal cross-caps. Supports occur every 8 m, omit low supports, avoid the creek and required entrance path envelopes, and use actual ground heights.
3. **src/core/terrain.ts:** use the viaduct support plan once per field; grade support pads with a flat radius 1 m and transition to 3 m. Normal pocket park lawns are graded flat at −.02 m; grass tile tops are .03 m. Riparian parks must keep their natural/carved surface and have no grass board over the creek.
4. **src/core/geometry.ts:** append generated viaduct pieces. Surface meshes must be checked for head collision when their sampled top is above the avatar's feet and below its head, so a low ramp is not walk-through overhead geometry. Standing on the same sampled surface remains allowed.
5. **src/core/city.ts / landscape.ts:** export and reuse the bounded plant variant cache. Park count is round(density × 6), with three stable variants per family using seedFor(0, family + park-variant + ((plot.seed+k)%3)). Preserve site RNG and locked plot seeds. Tropical parks mix canopy/palm, arid selects acacia or oasis palms, alien mixes fan/spiral, woodland uses ancient/drooping. Hide leaves/tips when foliage is disabled. Keep roots and crowns clear of entrance paths, creek/trail corridors and the viaduct; do not place a flat lawn across the creek. Remove generated street lamps that intersect the elevated corridor. Bank planting in effects.ts also honors the foliage control.
6. **src/core/texture-alpha.ts:** classify actual normalized PNG pixels as opaque, binary mask (0/255) or fractional blend. Cache by immutable asset reference/data URI and a bounded 32-image cache. The viewport uses alphaTest .5 for masks and .01 for fractional blending, enables transparency for fractional alpha or material opacity, and disables depth writes/instancing for blended materials. This is browser implementation; native PNG/mask behavior is still unverified.
7. **Viewport:** normalize the fly strafe vector and remove the requested-project dependency from geometry rebuilding. Keep rendering the committed scene during worker generation.
8. **UI:** a viaduct checkbox in Waterways & Effects enables the 3-block world and disables parcel waterfall mode; World Studio controls deck height. Version label is 0.5.
9. **Calibration kit:** add a nonsolid moving cube `create solid off, move 0 2 0 time=2 loop` and a nonsolid rotating bar `create solid off, rotate 0 10 0`. The rotation is a deliberate candidate, not an asserted VP specification; record native period, direction and pivot. VP's public rotate page has incomplete defaults/units, and its changelog describes later pivot fixes. Do not claim native compatibility.
10. **Example/rendering work:** add `viaduct-city` to reference examples: mixed-use base, 3 blocks, park ratio .4, density .3, viaduct on, economy plants. scripts/export-review.ts accepts a third argument selecting one example. Four website cards use a two-column grid. **The new viaduct WebP is not published**: finish the render, inspect it, and upload it before publishing the new card; also refresh the city-temperate image because park scatter changed. Update review evidence with per-scene generator versions/hashes.

## Last completed checks

- 71 tests passing, including new viaduct traversal/underpass/grade/group-budget/migration fixtures, park density/foliage/riparian-lawn checks and normalized PNG alpha classification/cache checks.
- Production TypeScript/Vite build passing, with generation and export workers. The large editor chunk warning remains.
- Earlier local viaduct scene was 7,259 pieces / 251,194 triangles after economy quality; later sharing/density fixes need refreshed counts and software renders.
- The executor went offline while attempting those updated renders. This is not evidence of browser or native rendering.

## Remaining full-plan work

Continue the authoritative 36-milestone / 117-item ledger rather than calling any checkpoint the complete plan. Curved streets/districts, broader road authoring, large-world streaming/LOD, per-unit/facade detachment, polygonal room topology, richer vegetation/biome masks/terrain editing, remaining secondary outputs, browser/GPU acceptance and native VP calibration are still open. Kennedy House remains reference-pending. All source and recovery work belongs in this GitHub repository.
