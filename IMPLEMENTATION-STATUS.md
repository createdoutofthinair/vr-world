# Implementation status

Updated: 11 October 2026. Product plan: v1.4. Scene release: 0.2.0.

## Current scope

This release responds to the mismatch between the plan's coordinated world themes and the foundation's material-only palettes. It advances sections 56–59 and the static portions of E1–E3 alongside M4/M5. None of the full environment/native milestones is declared complete.

| Area | Implemented | Evidence |
| --- | --- | --- |
| Theme contract | Architecture and biome are separate, saved controls; theme kits combine them; uploads and dimensions survive theme changes | Independence and preservation fixtures |
| Architecture | Jungle raised veranda, supported steps, rain canopy and shades; desert parapets, courtyard paving and pergola; fantasy timber framing and steep gables/chimney; sci-fi service frames/modules; temperate retail awnings | Five kit landmarks; 15 theme/archetype entrance routes |
| Interior/house slice | Furnished living/sleeping zones, bedroom partition with real passage for suitable dimensions, furniture legs/cushions/backs, stocked shop shelving | Geometry generation and circulation fixtures; upper storeys remain pending |
| Plant foundation | Tapered swept trunks, connected branching tubes, root flare/buttresses, folded two-sided mesh leaves, species-specific fronds and bodies | Nondegenerate geometry, deterministic generation, skeleton references, bounded per-plant triangles |
| Starter families | Broadleaf, canopy, acacia-like, ancient, conifer, palm, fern, broadleaf herb, agave, columnar cactus, alien fan tree, grass, fungi | 13 distinct generator outputs; software scene images |
| Distribution | Independent seed streams, reusable variants, density controls, entrance/building exclusion zones, root adaptation, arid recipe choices | Density changes preserve existing tree variants/positions; route fixtures |
| Owned terrain | Bounded heightfield mesh, flattened building and entry zone, path, rock outcrops; no native AW terrain dependency | Walking samples emitted triangles through a spatial index; exported route parity |
| Materials | Five bundled CC0 ambientCG color maps, derived diffuse PNGs, generated leaves/patterns; uploads for all 15 semantic slots | Local file/hash/provenance checks, actual PNG dimensions, archive dependency tests |
| Editor | Themes & Landscape / Plant Studio panes, independent biome selector, density/growth/relief controls, foliage inspection, scene/building framing, optional grid, default complete roof view | TypeScript/production build; browser interaction inspection pending |
| Export | All scene geometry, terrain, plants, materials and walking metadata in the existing `c3-` package | Archive reconstructed from serialized RWX/PNG/actions; no authoring geometry shortcut |
| Website | Theme cards show generated scene previews and current feature descriptions | Static production build; software-generated preview images inspected |

## Verification

- `npm test`: 24 fixtures, including 72 base-shell boundary configurations, 13 plant families, and 15 theme/archetype walking routes.
- `npm run build`: strict TypeScript and GitHub Pages production output.
- Software scene renders inspected for temperate, desert, jungle, fantasy and sci-fi. These are generated from the actual scene meshes and material colors/maps using a separate software rasterizer. They are **not WebGL or native VP screenshots**.
- Representative scene sizes: temperate 54,264 triangles / 166 pieces; desert 17,456 / 203; jungle 80,602 / 250; fantasy 57,728 / 184; sci-fi 13,848 / 186. These are counts, not FPS measurements.
- Fixed the new mixed-case foliage texture role producing an invalid RWX filename; all exported texture basenames are lowercase and prefixed.
- Browser/GPU interaction, resize, accessibility and resource tests: **not performed**. The supported browser-control skill is unavailable in this managed environment.
- Native VP comparison: **not performed**. Scale/winding, glass, collision and PNG behavior remain provisional.

## Persistence and provenance

Version 1 documents migrate to schema/generator 2/0.2.0 with `migratedFrom: 0.1.0`, preserving existing building settings and uploads. The old local-storage document remains under its original key; version 2 saves separately. Dock layouts use a new version key so the new panes are initially visible.

AmbientCG Bark012, Ground037, Rock035, WoodSiding006 and Bricks060 are bundled with source URLs, original/derived hashes, CC0 license links and modification records. The supplied images are flat tiling-preview color maps obtained from the provider's own public pages. They are resized for web delivery; the app derives 512 px neutral-luminance PNGs. Export retains the images actually used and their notices. Procedural-only surfaces remain selectable.

## Remaining work in the detailed plan

1. Native scale/winding/texture/solid reference package and a verified target profile; AWG serialization/import remains absent.
2. M4 upper storey, real stairwell/landing/floor void, wall ownership, and continuous accessible circulation.
3. M6–M8 reusable facades, apartments, meaningful multi-wing villas and mixed use; Kennedy reference still unresolved.
4. Plant pruning, editable skeleton/attraction controls, growth stages, individual locked overrides, expanded desert species, biome masks and district-level resolution. Current placement is a compact parcel algorithm, not a complete ecosystem simulation.
5. Terrain sculpting/material splats, retaining walls, road networks, intersections, bridges/viaducts, creeks and waterfalls.
6. VP-first move/rotate runtime, animation fixtures and moving collision; no browser-only effects are advertised as exportable.
7. Browser performance measurements, shared geometry/instancing/LOD budgets, long-session recovery, and native comparison. Material/geometry caching exists; performance gates are still open.

## Next development task

Complete the M4 two-storey building reference with proper circulation and structural joins, while checking this scene release in the browser and resolving native VP fixtures. Continue the detailed plan from measured evidence. UI-only polish is no longer the main next step; geometry, architectural variety and target validation remain the priority.

## Remote delivery

Release 0.2 is deployed at https://createdoutofthinair.github.io/vr-world/ (editor: https://createdoutofthinair.github.io/vr-world/#editor).

- Application commit: `d126c6d9dacd6fbeb343dc2f6f5de873f88407c4`.
- GitHub Actions run [38165844439](https://github.com/createdoutofthinair/vr-world/actions/runs/38165844439): build, all 24 tests, and Pages deployment succeeded.
- Public HTTP verification: the homepage references the current application bundle; the current JavaScript/CSS and all published scene/texture/provenance files (16 files) returned HTTP 200 and matched local release bytes by SHA-256.
- This confirms artifact delivery, not browser/GPU or native VP visual validation. Those checks remain open above.
