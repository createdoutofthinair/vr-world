# c3 World Studio

A public website and browser-based modular building workshop, hosted together on GitHub Pages.

- Website: `https://createdoutofthinair.github.io/vr-world/`
- Editor: `https://createdoutofthinair.github.io/vr-world/#editor`

These are the intended URLs; see the deployment workflow for the current deployment result.

## Foundation release

The public site includes the c3 cube identity, original vector city graphics, a sticky header that compacts on scroll, responsive navigation, feature descriptions, interactive palette previews, and an honest roadmap.

The editor includes:

- Dockview panes: Explorer, Properties, Presets, Materials, Floor Plan, Export, Problems, and 3D workspace.
- Three configurable single-storey recipes: shop, house, and a larger studio villa shell.
- Generated wall thickness, true door/window openings, frames, glass, floor, ceiling, flat/gable roofs, basic furniture, and shop signage.
- Orbit, roof cutaway, linked selection, and pointer-lock walking with collision and a bounded entrance step.
- Five material palettes, deterministic procedural textures, normalized PNG/JPG/WebP uploads.
- Undo/redo, local autosave, layout persistence, command palette, editable JSON project download/import.
- A ZIP export containing `c3-` RWX models, PNG textures, canonical placements, the project, provenance, installation notes, and a validation report.
- Export Preview rebuilt by reopening the actual generated ZIP, parsing its RWX files, checking texture hashes, and interpreting the emitted `create solid` subset.

The native VP profile is **provisional**. The browser round trip does not certify native rendering, scale, winding, transparency, or collision. Canonical placement JSON is not an AWG file. The AWG adapter, multi-room/storey architecture, city generation, mesh terrain, full flora, and move/rotate effects are pending.

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
| `src/core/geometry.ts` | Renderer-independent indexed geometry, apertures, bounds, flat-ground movement |
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
3. Configure the smallest building with thick walls and a wide door; confirm real openings in 3D and floor plan.
4. Walk through the entry, collide with adjacent walls, and return outside. Switch roof cutaway on/off and inspect from above.
5. Upload a PNG/JPG/WebP wall texture. Save/reopen the project and inspect the restored surface.
6. Rebuild Export Preview, inspect the same building, download the ZIP, and check dependency/prefix reports.
7. Host a small RWX fixture in VP and check dimensions, orientation, textures, glass, and solid/nonsolid behavior before claiming compatibility.

GPU/browser and native VP checks must be recorded separately from automated checks. See the status file for checks actually performed.

## Assets and dependencies

The cube logo, city graphics, and seeded material patterns are original project assets. Uploaded images retain their uploader's rights and provenance. Curated third-party texture packs have not yet been downloaded or bundled. The website uses Google Fonts with system-font fallbacks; the editor works without those font downloads.

Third-party libraries retain their own licenses. No project-wide license has been chosen on the owner's behalf.
