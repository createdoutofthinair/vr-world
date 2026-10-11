# Working on c3 World Studio

Read `IMPLEMENTATION-STATUS.md` and the relevant numbered sections of `docs/Modular-Building-Creator-Plan.md` before implementing a milestone. The plan is a product specification; the status file records actual evidence.

## Contracts

- Keep semantic document, neutral generated geometry, authored view, and emitted-file reconstruction distinct.
- All exported model, texture, mask, frame, group, and archive filenames begin with `c3-`.
- Do not claim AWG/native VP compatibility until documented fixtures and native checks establish it.
- Export Preview must read serialized files and actions, not reuse authoring geometry or fill missing dependencies from its cache.
- Preserve true openings, collision, physical dimensions, material dependencies, undo, and saved versions.
- Target profile changes require independent geometry/action fixtures, not only a writer/reader round trip.
- Show planned features as planned on the public website; do not add decorative nonfunctional editor controls.
- Maintain `/vr-world/` asset paths and hash routing for GitHub Pages.
- Keep source and status in this repository; do not create a duplicate repository archive in ChatGPT Library.

## Verification

Run `npm test` and `npm run build` for changes to generated geometry, project data, exports, or runtime integration. Add meaningful regression fixtures for a bug; avoid tests that merely repeat an implementation expression.

Record automated checks, browser/GPU inspection, and native VP checks independently. Never mark a feature visually inspected because TypeScript or a build passed.

Update `IMPLEMENTATION-STATUS.md` with the actual scope, evidence, open limitations, and a concrete next task. Prefer a complete small milestone over expanding many unfinished systems.

## Reasoning level

High is appropriate for geometry/topology, coordinate and export semantics, action timing, collision, terrain, branching algorithms, and difficult performance defects. Medium is suitable for bounded panel work, preset browsing, website content, help, and conventional UI after contracts are established. Escalate based on an observed hard problem; the model setting does not replace verification.
