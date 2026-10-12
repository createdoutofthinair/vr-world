# c3 World Studio

A public website and browser-based modular building workshop, hosted together on GitHub Pages.

- [Website](https://createdoutofthinair.github.io/vr-world/)
- [Editor](https://createdoutofthinair.github.io/vr-world/#editor)

Release **0.4.0** advances the complete plan with multi-storey buildings, linked modules, seeded cities, terrain authoring, plant growth controls, waterways and editable interior room boundaries. See [implementation status](IMPLEMENTATION-STATUS.md) for exact scope and deployment evidence.

## World scene release

The public site includes the c3 cube identity, original vector city graphics, a sticky header that compacts on scroll, responsive navigation, feature descriptions, previews of generated scenes, and an honest roadmap.

The editor includes:

- Dockview panes: Explorer, Properties, Presets, Materials, Floor Plan, Export, Problems, Themes & Landscape, Plant Studio, and 3D workspace.
- Shop, house, villa, flats and mixed-use templates, up to six storeys, straight/U stairs with true slab voids, unit interiors, and connected L/U/courtyard wings.
- Authored rectangular rooms with shared walls, doorway connections, room-specific furnishing/finishes, locks, physical access diagnostics, floor isolation and linked plan selection.
- Generated wall thickness, true door/window openings, frames, glass, floor, ceiling, flat/gable roofs, supported furniture, bedroom partitions with open passages, and shop signage.
- Orbit, fly inspection, touch navigation, roof cutaway, linked selection, and pointer-lock walking with collision, sampled mesh terrain, and bounded stair risers.
- Five architectural kits and five independent biomes. Jungle verandas and canopy plants, desert shade structures and arid flora, timber fantasy buildings and woodland, modular sci-fi frames and alien fans, temperate shops and parkland.
- Twenty procedural plant families, seed-stable variant banks, root/branch/leaf geometry, density and growth controls, pruning, locked individual landmark recipes and foliage inspection.
- Seeded bounded street neighborhoods with parks, locked plots, crossings, pavements, lamps and entrances. Owned chunked terrain includes landforms, sculpt/paint edits, six rock families, baked texture splats, creeks, trails, supported bridges and waterfalls.
- Five bundled CC0 surface maps, procedural material detail, and normalized PNG/JPG/WebP uploads for building, bark, leaf, ground, and other material roles.
- Undo/redo, asset-deduplicated IndexedDB autosave, previous-save recovery, 20 named checkpoints, manual unused-asset cleanup, layout persistence, command palette and editable JSON project download/import.
- A ZIP export containing `c3-` RWX models, PNG textures, canonical placements, the project, provenance, installation notes, and a validation report.
- Export Preview rebuilt from actual generated ZIP files with RWX parsing, texture hashes and a VP move runtime. Bounded rebased groups include experimental AWG3 ZIPs and VPPTSV placement probes. Package builds run in a cancellable worker with progress, selectable scopes and group budgets. Packages include per-level SVG geometry plans and a placement inventory.

The native VP profile is **provisional**. The browser round trip does not certify native rendering, scale, winding, transparency, or collision. Experimental AWG syntax is implemented, but its native units/import are unverified. Rotation is an explicit candidate adapter disabled by default. General polygonal room layouts and per-unit overrides, curved streets/districts, viaduct authoring, custom plant recipes/biome masks, streaming/LOD, rich annotated plans, and complete release acceptance remain pending. The full plan is not complete.

## Development

Use Node 24 and npm.

```sh
npm ci
npm test
npm run build
npm run dev
```

Vite uses `/vr-world/` as its base. Hash navigation keeps both routes compatible with GitHub Pages without server rewrite rules. The editor bundle loads only when someone opens the editor.

## GitHub Pages

The `.github/workflows/pages.yml` workflow tests and builds pushes to `main`, uploads `dist`, and deploys to Pages. Pull requests run checks only.

For a new repository, choose **Settings → Pages → Build and deployment → Source: GitHub Actions** once. The workflow's default token cannot administratively enable a new Pages site. No personal token is stored in this project.

## Project structure

| Location | Responsibility |
| --- | --- |
| `src/core/project.ts` | Versioned semantic document, presets, validation, deterministic random streams, material roles |
| `src/core/geometry.ts` | Renderer-independent indexed geometry, apertures, bounds, indexed terrain/step movement |
| `src/core/mesh.ts`, `architecture.ts` | Shared geometry primitives and theme-specific construction details |
| `src/core/plants.ts`, `landscape.ts` | Deterministic plant anatomy, variant placement, terrain and route exclusions |
| `src/core/rwx.ts` | Provisional target profile, restricted RWX writer/reader, emitted action evaluator |
| `src/core/package.ts` | Dependency-complete ZIP, content hashes, placements, actual archive reconstruction |
| `src/core/textures.ts` | Seeded texture images, upload normalization, PNG bytes, hashes |
| `src/editor/` | Store/history, Dockview workspace, Three.js view, panels |
| `src/site/` | Public website and original SVG world graphics |
| `tests/` | Geometry, movement, parser, asset dependency, package and error fixtures |
| `docs/Modular-Building-Creator-Plan.md` | Full agreed product specification |
| `IMPLEMENTATION-STATUS.md` | Progress, evidence, unresolved checks, and next task |

## Manual inspection route

1. Check the public site at desktop/mobile widths. Scroll down and confirm that the header shrinks while keeping navigation available.
2. Open Editor, resize/dock tabs, then reload and check layout/project restoration.
3. In Themes, select each world family, then combine sci-fi architecture with tropical vegetation. In Plant Studio, change density and hide/show foliage.
4. Configure the smallest building with thick walls and a wide door; confirm real openings in 3D and floor plan.
5. Walk through the entry, collide with adjacent walls, and return outside. Switch roof cutaway on/off and inspect from above.
6. Upload a PNG/JPG/WebP wall texture. Save/reopen the project and inspect the restored surface.
7. Rebuild Export Preview, inspect the same building, download the ZIP, and check dependency/prefix reports.
8. Host a small RWX fixture in VP and check dimensions, orientation, textures, glass, and solid/nonsolid behavior before claiming compatibility.

GPU/browser and native VP checks must be recorded separately from automated checks. See the status file for checks actually performed.

## Assets and dependencies

The cube logo, city graphics, and seeded material patterns are original project assets. Uploaded images retain their uploader's rights and provenance. Five optimized ambientCG color maps are bundled under CC0. Sources, transformations, file hashes and license links are recorded in [c3-sources.json](public/textures/c3-sources.json) and [c3-LICENSE.md](public/textures/c3-LICENSE.md). Export includes the actual derived PNGs and their source notices. The website uses Google Fonts with system-font fallbacks; the editor works without those font downloads.

Third-party libraries retain their own licenses. No project-wide license has been chosen on the owner's behalf.

## Saved projects and geometry review

Version 1 projects migrate to the version 2 scene schema, retaining dimensions, building settings and uploaded textures. The browser stores the upgraded project under `c3-project-v2`; its old `c3-project-v1` entry remains intact. Version 2 dock layouts use a new key so the added panes are visible.

The images in `public/scenes/` are reproducible software renders of actual neutral generator output. Generate them with `node --import tsx scripts/export-review.ts /tmp/c3-scene-review` and `python3 scripts/render-review.py /tmp/c3-scene-review public/scenes` (Pillow and NumPy). These images review geometry, placement, and diffuse surfaces; they are not screenshots of the browser or native VP client.
