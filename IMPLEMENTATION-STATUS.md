# Implementation status

Updated: 12 October 2026. Product plan: v1.4. Implementation checkpoint: 0.4.0.

The complete plan is **not complete**. The 36 milestones and 117 acceptance items are tracked in `docs/PLAN-COVERAGE.json` and `docs/PLAN-EXECUTION.md`. This checkpoint implements substantial previously missing systems; automated evidence does not satisfy browser/GPU or native Virtual Paradise acceptance.

## Implemented scope and evidence

| Area | Implementation | Automated evidence |
| --- | --- | --- |
| Structure/circulation | Five configurable building templates; 1–6 storeys; straight/U stairs, real slab voids, thin treads, landings and head collision; static door poses and temporary E-key inspection interaction | Five-theme two-storey routes, return routes, slab head collision, dimensional constraints, three-storey apartment circulation |
| Apartments/mixed use | Two units per residential level, common circulation, bedrooms, bathrooms, kitchens and furnishing; mixed-use separate retail/residential entrances | Unit/bedroom/bathroom/stair reachability fixtures |
| Villas | Connected L/U/courtyard orthogonal wings, perimeter openings, joined floor slabs, true recesses/courtyards, supported flat/hip roofs | Empty courtyard, actual entrance, connected wings and upper-floor stair route fixtures |
| Authored interiors | Rectangular room boundaries, names/types/levels, doorway widths/offsets, shared wall ownership, furnishing/finish controls, locked-layout regeneration, linked plan/3D selection and floor isolation | Five-theme furnished two-storey layouts, physical doorway traversal, shared-wall count, conflict and unreachable-room rejection; room-scoped emitted package |
| Modules | Linked window/wall/door/floor/column/beam definitions; placements, right socket attachment, dimension overrides, locks/detach | Definition changes, locked dimensions, socket propagation/cycle rejection, actual custom-door aperture |
| Signage/materials | Five sign mount types; rasterized text/artwork with crop/fit/colors; 19 material roles with own uploads, physical tiling, tint/PBR maps and normal convention | PNG validation and package dependency checks; browser rasterization and PBR appearance uninspected |
| Neighborhoods | Stable road graph, crossings/kerbs/pavements/lamps, parks, varied seeded building plots, locks, entrance routes, reserved river corridor | Deterministic layout, locks, finite unique meshes, junction joins and pavement-to-shop walk route |
| Owned terrain | Shared canonical 1 m regional field, chunked mesh/edge skirts/undersides, hills/ridges/basins/terraces, bounded erosion and final drainage, foundation/road grades, raise/lower/flatten/paint operations | Shared edge samples, final flow, persistent painted weights, walk support |
| Terrain surfaces | Normalized grass/soil/rock/sand weights, procedural/licensed/user maps, linear-color per-chunk PNG baking with world-coordinate boundaries | Actual uploaded RGBA pixel bake and package reconstruction; PNG CRC/decompression/dimension rejection |
| Geology | Boulder, fractured, stratified, columnar, scree and river-rock mesh families with ground contact | Distinct finite bounded silhouettes |
| Vegetation | Twenty families, roots/trunks/connected branches/mesh leaves, rules or bounded space attraction, sapling/mature/old, shape/lean/density controls, stable branch pruning, economy mesh and individual variant pins with locked growth snapshots | Family geometry/budgets, deterministic attraction/connected graph/pruning, economy keeps skeleton with fewer triangles; acyclic parent graphs, pins retain geometry across seed/growth changes and conflicts are explicit |
| Waterways | Directed creek graph, carved channel, bank trail/planting, supported footbridge, city road bridge and parcel waterfall/foam geometry | Downhill graph, crossable footbridge, actual emitted waterfall actions at explicit timestamps; waterways are rebased into bounded mesh chunks |
| Actions | Typed bounded VP move subset, local/world axes, wait/loop/reset/sync, stable action replacement/name targets, inspection clock | Published explicit timing cases, named activation/replacement, emitted action parity; smooth curve approximation and rotate remain provisional |
| Native probes | Independent downloadable 1 m/10 m, XYZ, placement, winding/UV, opacity and solidity test kit with actual RWX/PNG/TSV/AWG dependencies | File/coordinate/dependency fixture; native measurements still required |
| Groups/export | Dependency-complete c3 RWX/PNG/project package, rebased bounded deterministic groups, VPPTSV and experimental AWG3 ZIP probes; preview reopens actual files, including optional AWG-record reconstruction; scene/building/environment/selected scopes, configurable group budgets, per-level SVG plans and CSV inventory | Asymmetric RWX fixture, actual archive parsing/hash/missing dependencies, exact group coverage/rebase, independent AWG literal record, quantized AWG placement rebuild, selected scope, strict budget rejection and model hash/manifest validation |
| Execution/performance | Cancellable scene worker with old-scene retention; cancellable export worker/progress; shape/material/chunk instancing; collision spatial grid; live metrics panel | Production worker bundles and geometry/runtime tests; no measured GPU/FPS or long-session result |
| Persistence/recovery | Schema 4 migrations preserving v1/v2/v3 uploads and authored settings; IndexedDB content-addressed PNG assets, current/previous atomic saves, 20 named checkpoints, explicit atomic garbage collection | Validation/migration fixtures; pure asset-deduplication/reconstruction and portable ZIP restore fixtures; browser IndexedDB recovery/quota workflow uninspected |
| Inspection | Dockable added studio panes, per-level plan, scene-bound framing, clear supported walk spawn, slope limit, fly inspection, touch controls, camera snapshot retention and generation movement pause, classic target material preview | Supported raised-floor spawn and empty-scene rejection; browser interaction uninspected |

## Verification

- Automated suite: **67 tests passing** at this checkpoint; rerun on each geometry/schema/export/runtime change.
- Strict TypeScript and Vite production build pass, including separate generation and export worker bundles. The editor bundle still triggers Vite's large-chunk warning; this is not a measured performance result.
- Current 0.3 software geometry renders were inspected for five themes, a seeded neighborhood, a two-storey courtyard villa and a jungle creek/bridge/waterfall. Public scene evidence includes hashes and reproducible scripts. These are neither WebGL nor native screenshots; full human-scale visual acceptance remains open.
- Browser/GPU inspection, resizing, pointer lock, IndexedDB, worker cancellation and long-session resource tests: **not performed**. The supported browser-control skill is unavailable in this managed environment; no replacement browser automation was improvised.
- Native VP: **not performed**. RWX geometry units/winding and AWG/VP placement units are provisional, separately identified. Native glass, PNG, collision, group ZIP import and effects remain open.

## Important limits and remaining implementation

1. General polygonal room graphs, per-unit/per-facade overrides and arbitrary footprints remain unfinished. Rectangular authored boundaries now derive shared walls and connections from one source; a physical grid checks routes from entrances/stair landings with openable leaves excluded. Autogenerated room layouts are limited to rectangular buildings; room-by-room manual layouts can be validated against connected wings. Kennedy House remains reference-pending.
2. Curved streets, district styles/zoning, editable road graph, authored viaducts and large-world streaming are missing. Current city is a bounded regular neighborhood.
3. Per-species custom recipes, editable attraction envelopes, biome masks and ecological succession are unfinished. Pruning controls are global woody-family controls with per-pin recipe snapshots. Pins currently edit position, seed, scale and growth locking; crown/trunk guide editing remains unfinished.
4. Continuous sculpt brushes, smooth/erase operations, geological region editing, overhang meshes and surface-specific cliff bakes remain unfinished. Terrain is a heightfield with explicit boundary sides.
5. LOD/streaming, secondary GLB outputs, rich dimensioned plan annotation, verified target budget gates, complete accessibility/help and full usability acceptance remain unfinished. Economy plants are a saved recipe choice, not runtime LOD.
6. Hosted group anchors/nesting and editable arbitrary group imports are missing. Experimental AWG3 output is a probe, not a verified native adapter. No current hard group radius/count is claimed.
7. Candidate RPM rotate is disabled by default. Native rotation/pivot/defaults, animation grammar and moving-solid collision are unverified/unfinished. Generated motion is nonsolid; preview door interactions export only saved static poses.
8. The five bundled ambientCG CC0 color sources retain their URLs, source/derived hashes and modification notices. PBR uploads are preserved but classic RWX exports only the supported diffuse/profile subset. User uploads stay local until the user downloads or hosts a package.

## Delivery

Public routes remain https://createdoutofthinair.github.io/vr-world/ and https://createdoutofthinair.github.io/vr-world/#editor. This file records the 0.4 source checkpoint; deployment success must be recorded separately after CI. The first 0.3 application checkpoint `f187d41c223a26d883ba4d7833cd5d4a83955100` passed GitHub Pages run [38192025854](https://github.com/createdoutofthinair/vr-world/actions/runs/38192025854). The expanded 0.3 checkpoint `96966efabdc33905119d13bf961405c1e8b0c327` passed Pages run [38194237895](https://github.com/createdoutofthinair/vr-world/actions/runs/38194237895). Public homepage/bundle requests succeeded and all eight current WebP scene files matched local SHA-256 hashes. Version 0.4 commit `9c3d9be51c7865df48be3e94346dc0d70bc601f7` passed [Pages run 38196977977](https://github.com/createdoutofthinair/vr-world/actions/runs/38196977977), including all 65 tests. Public HTTP checks matched the homepage, seven current application/worker/style/logo files and eight scene WebP files against local SHA-256. The subsequent named-action regression fix has 67 local passing tests and awaits its own CI check.

## Next work

Continue the full execution ledger: per-unit/facade overrides and richer room topology, city graph/district/viaduct tools, biome masks and custom vegetation recipes, streaming/LOD and remaining secondary outputs, then current visual/browser and native target acceptance. Do not label this checkpoint the completed plan.
