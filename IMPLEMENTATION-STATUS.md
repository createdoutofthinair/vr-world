# Implementation status

Updated: 12 October 2026. Product plan: v1.4. Implementation checkpoint: 0.3.0.

The complete plan is **not complete**. The 36 milestones and 117 acceptance items are tracked in `docs/PLAN-COVERAGE.json` and `docs/PLAN-EXECUTION.md`. This checkpoint implements substantial previously missing systems; automated evidence does not satisfy browser/GPU or native Virtual Paradise acceptance.

## Implemented scope and evidence

| Area | Implementation | Automated evidence |
| --- | --- | --- |
| Structure/circulation | Five configurable building templates; 1–6 storeys; straight/U stairs, real slab voids, thin treads, landings and head collision; static door poses and temporary E-key inspection interaction | Five-theme two-storey routes, return routes, slab head collision, dimensional constraints, three-storey apartment circulation |
| Apartments/mixed use | Two units per residential level, common circulation, bedrooms, bathrooms, kitchens and furnishing; mixed-use separate retail/residential entrances | Unit/bedroom/bathroom/stair reachability fixtures |
| Villas | Connected L/U/courtyard orthogonal wings, perimeter openings, joined floor slabs, true recesses/courtyards, supported flat/hip roofs | Empty courtyard, actual entrance, connected wings and upper-floor stair route fixtures |
| Modules | Linked window/wall/door/floor/column/beam definitions; placements, right socket attachment, dimension overrides, locks/detach | Definition changes, locked dimensions, socket propagation/cycle rejection, actual custom-door aperture |
| Signage/materials | Five sign mount types; rasterized text/artwork with crop/fit/colors; 19 material roles with own uploads, physical tiling, tint/PBR maps and normal convention | PNG validation and package dependency checks; browser rasterization and PBR appearance uninspected |
| Neighborhoods | Stable road graph, crossings/kerbs/pavements/lamps, parks, varied seeded building plots, locks, entrance routes, reserved river corridor | Deterministic layout, locks, finite unique meshes, junction joins and pavement-to-shop walk route |
| Owned terrain | Shared canonical 1 m regional field, chunked mesh/edge skirts/undersides, hills/ridges/basins/terraces, bounded erosion and final drainage, foundation/road grades, raise/lower/flatten/paint operations | Shared edge samples, final flow, persistent painted weights, walk support |
| Terrain surfaces | Normalized grass/soil/rock/sand weights, procedural/licensed/user maps, linear-color per-chunk PNG baking with world-coordinate boundaries | Actual uploaded RGBA pixel bake and package reconstruction; PNG CRC/decompression/dimension rejection |
| Geology | Boulder, fractured, stratified, columnar, scree and river-rock mesh families with ground contact | Distinct finite bounded silhouettes |
| Vegetation | Thirteen families, roots/trunks/connected branches/mesh leaves, rules or bounded space attraction, sapling/mature/old, shape/lean/density controls, stable branch pruning, economy mesh | Family geometry/budgets, deterministic attraction/connected graph/pruning, economy keeps skeleton with fewer triangles |
| Waterways | Directed creek graph, carved channel, bank trail/planting, supported footbridge, city road bridge and parcel waterfall/foam geometry | Downhill graph, crossable footbridge, actual emitted waterfall actions at explicit timestamps |
| Actions | Typed bounded VP move subset, local/world axes, wait/loop/reset/sync, stable action replacement/name targets, inspection clock | Published explicit timing cases, named activation/replacement, emitted action parity; smooth curve approximation and rotate remain provisional |
| Groups/export | Dependency-complete c3 RWX/PNG/project package, rebased bounded deterministic groups, VPPTSV and experimental AWG3 ZIP probes; preview reopens actual files, including optional AWG-record reconstruction | Asymmetric RWX fixture, actual archive parsing/hash/missing dependencies, exact group coverage/rebase, independent AWG literal record, quantized AWG placement rebuild |
| Execution/performance | Cancellable scene worker with old-scene retention; cancellable export worker/progress; shape/material/chunk instancing; collision spatial grid; live metrics panel | Production worker bundles and geometry/runtime tests; no measured GPU/FPS or long-session result |
| Persistence/recovery | Schema 3 migrations preserving v1/v2 uploads; IndexedDB content-addressed PNG assets, current/previous atomic saves, 20 named checkpoints, explicit atomic garbage collection | Validation/migration fixtures; actual browser IndexedDB recovery/quota workflow uninspected |
| Inspection | Dockable added studio panes, per-level plan, scene-bound framing, clear supported walk spawn, generation movement pause, classic target material preview | Supported raised-floor spawn and empty-scene rejection; browser interaction uninspected |

## Verification

- Automated suite: **49 tests passing** at this checkpoint; rerun on each geometry/schema/export/runtime change.
- Strict TypeScript and Vite production build pass, including separate generation and export worker bundles. The editor bundle still triggers Vite's large-chunk warning; this is not a measured performance result.
- Existing public scene images are earlier 0.2 software renders, not current 0.3 screenshots. No current visual acceptance is claimed.
- Browser/GPU inspection, resizing, pointer lock, IndexedDB, worker cancellation and long-session resource tests: **not performed**. The supported browser-control skill is unavailable in this managed environment; no replacement browser automation was improvised.
- Native VP: **not performed**. RWX geometry units/winding and AWG/VP placement units are provisional, separately identified. Native glass, PNG, collision, group ZIP import and effects remain open.

## Important limits and remaining implementation

1. Free room graph editing, room locks, per-unit/per-facade overrides and arbitrary footprints remain unfinished. Current circulation templates and orthogonal wings are bounded implementations. Kennedy House remains reference-pending.
2. Curved streets, district styles/zoning, editable road graph, authored viaducts and large-world streaming are missing. Current city is a bounded regular neighborhood.
3. Per-species custom recipes, individual pinned plants/overrides, editable attraction envelopes, biome masks and ecological succession are unfinished. Current pruning controls are global woody-family controls.
4. Continuous sculpt brushes, smooth/erase operations, geological region editing, overhang meshes and surface-specific cliff bakes remain unfinished. Terrain is a heightfield with explicit boundary sides.
5. LOD/streaming, export scopes, configurable target budget gates, secondary GLB/plan outputs, complete accessibility/help and full usability acceptance remain unfinished. Economy plants are a saved recipe choice, not runtime LOD.
6. Hosted group anchors/nesting and editable arbitrary group imports are missing. Experimental AWG3 output is a probe, not a verified native adapter. No current hard group radius/count is claimed.
7. Candidate RPM rotate is disabled by default. Native rotation/pivot/defaults, animation grammar and moving-solid collision are unverified/unfinished. Generated motion is nonsolid; preview door interactions export only saved static poses.
8. The five bundled ambientCG CC0 color sources retain their URLs, source/derived hashes and modification notices. PBR uploads are preserved but classic RWX exports only the supported diffuse/profile subset. User uploads stay local until the user downloads or hosts a package.

## Delivery

Public routes remain https://createdoutofthinair.github.io/vr-world/ and https://createdoutofthinair.github.io/vr-world/#editor. This file records the 0.3 source checkpoint; deployment success must be recorded separately after CI. The previous deployed release was 0.2 (`d126c6d9dacd6fbeb343dc2f6f5de873f88407c4`, Pages run 38165844439).

## Next work

Continue the full execution ledger: structural local overrides and room authoring, city graph/district/viaduct tools, individual vegetation and biome masks, streaming/LOD/export scopes and secondary outputs, then current visual/browser and native target acceptance. Do not label this checkpoint the completed plan.
