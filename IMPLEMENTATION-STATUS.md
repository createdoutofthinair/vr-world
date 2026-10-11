# Implementation status

Updated: 11 October 2026. Product plan: v1.4. Foundation build: 0.1.0.

## Delivered in this change

| Area | Implemented | Evidence |
| --- | --- | --- |
| Public website | c3 brand/logo, original city graphics, shrinking sticky header, features, palette selector, roadmap, Editor navigation | Production build; browser visual inspection pending |
| M0 contracts | Semantic project, neutral geometry, provisional VP classic scale/winding, emitted RWX subset, dependency hashes | Independent asymmetric fixture, parser errors, package integrity fixtures |
| M1 shell | Dockview panels, persistent layouts, project state, bounded history, local autosave, import/download, command palette | TypeScript/build; interactive pane persistence pending browser inspection |
| M2 geometry | Single-room shells, walls, true openings, frames/glass, floor/ceiling, flat/gable roofs, basic furniture | Boundary configurations and deterministic geometry fixtures |
| M3 partial slice | Shop recipe, sign surface, orbit/cutaway, flat-ground walking collision, custom textures, ZIP export | Doorway, adjacent wall, narrow footprint, and entrance-step collision fixtures |
| M5 partial export | RWX writer/reader, PNG packaging, `c3-` names, actual archive reconstruction, `create solid` evaluation | Round trip, missing-asset rejection, changed-image rejection, unsupported-action rejection |
| Themes initial slice | Five material palettes and seeded pattern variations | Saved semantic data; these are not complete biome/environment packs |
| GitHub Pages delivery | Static Vite build and test/build/deploy workflow | Local production build; remote outcome recorded below after push |

## Verification performed

- `npm test`: 15 meaningful fixtures passed, including 72 preset/boundary combinations.
- `npm run build`: TypeScript passed and Vite production output generated for `/vr-world/`.
- Fixed an entrance-step collision defect found by the walking fixtures.
- Native VP client tests: **not performed**.
- Browser/GPU visual and interactive tests: **not performed**. The available managed environment has no supported browser-control skill; no substitute browser test is claimed.

No milestone requiring native or visual evidence is marked complete merely because the source builds.

## Limits to resolve

1. Provisional profile assumes 10 meters per RWX unit and clockwise target faces; confirm in a named VP build/renderer.
2. AWG writer/group importer is not implemented. Placement JSON is a canonical project format, not a native interchange claim.
3. Walking uses bounded circle/AABB collision on flat surfaces with a small step. Slopes, stairs, gravity, flying, and moving colliders need the later controller track.
4. House/villa are foundation one-storey shells. Rooms, wings, floor voids, apartments, and Kennedy reference remain pending.
5. Texture import normalizes images and embeds them. Full PBR ingestion, licensing-aware curated asset packs, advanced UV controls, and provider acquisition are pending.
6. Native transparency/masks/material behavior and all move/rotate/frame animation remain pending. The only emitted/evaluated creation action is `solid`.
7. The public graphics are illustrative concepts and are labeled accordingly. They do not advertise an implemented city generator.
8. Browser accessibility, docking resize, context recovery, and long-session resource behavior need interactive checks.

## Model handoff

**A bounded switch to GPT-6.1 Sol Medium is now reasonable** for website refinements, help/onboarding, preset browser organization, panel copy, keyboard hints, conventional property controls, and material-library presentation. Preserve the established schema and neutral/export contracts.

Keep High for M4 circulation/stairs, reusable topology, native export corrections, AWG encoding/placement, VP motion semantics, terrain, procedural vegetation, and performance/collision defects. Native target uncertainties remain open and are not solved by switching models.

### Concrete next Medium task

Improve the preset browser and in-app help without changing geometry/export contracts: searchable/category-filtered recipes, clear descriptions, a keyboard-controls/help panel, project-download reminders after quota failure, and contextual links to the current compatibility report. Complete browser inspection and record evidence when the supported browser environment is available.

### Concrete next High task

Start M4 with a connected two-room/two-storey reference: wall ownership, stair/landing, true upper-floor void, ceiling separation, and accessible route. Add topology/collision fixtures, then validate the exported scene. In parallel with the target owner, resolve the small native VP scale/winding/texture/solid fixtures before enabling AWG or motion presets.

## Remote delivery

Pending initial repository push and Pages workflow result.
