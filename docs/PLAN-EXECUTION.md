# Complete plan execution record

The complete specification remains authoritative. Partial implementation and automated checks do not complete native or visual gates. Every milestone and acceptance checklist item is recorded in `PLAN-COVERAGE.json`.

| Step | Deliverable | Starting state | Native/visual proof |
| --- | --- | --- | --- |
| M0 | Resolve risky contracts | partial | Pending |
| M1 | Application shell and document foundation | partial | Required where specified |
| M2 | Structural editing and a basic building | partial | Required where specified |
| M3 | First end-to-end shop slice | partial | Required where specified |
| M4 | House, stairs, and reliable walkthrough | missing | Required where specified |
| M5 | Materials and export hardening | partial | Pending |
| M6 | Reusable modules and facade systems | missing | Required where specified |
| M7 | Apartments and mixed-use buildings | missing | Required where specified |
| M8 | Villas and advanced exterior forms | missing | Required where specified |
| M9 | Complete retail and interior authoring | missing | Required where specified |
| M10 | Performance, LOD, and recovery | missing | Pending |
| M11 | Full v1 polish and release | missing | Pending |
| C0 | Virtual Paradise placement and group spike | missing | Pending |
| C1 | Modular road and pavement kit | missing | Required where specified |
| C2 | First seeded neighborhood | missing | Required where specified |
| C3 | Complete c3 package and AWG partitioning | missing | Pending |
| C4 | Terrain, bridges, and viaducts | missing | Required where specified |
| C5 | Districts, curved streets, and richer city forms | missing | Required where specified |
| C6 | Large-world rendering and export budgets | missing | Pending |
| C7 | World release and usability review | missing | Pending |
| T0 | Contract and export probe | partial | Pending |
| T1 | Landforms and editable ground | partial | Required where specified |
| T2 | Geology and rock geometry | partial | Required where specified |
| T3 | Surface generation and splatting | missing | Required where specified |
| T4 | Landscape/city interfaces | missing | Required where specified |
| T5 | Complete terrain export | partial | Pending |
| T6 | Budgets and streaming | missing | Pending |
| T7 | Visual acceptance and recovery | missing | Pending |
| E0 | Target effects proof | missing | Pending |
| E1 | Plant foundation | partial | Required where specified |
| E2 | Distinct plant families | partial | Required where specified |
| E3 | Themes and distribution | partial | Required where specified |
| E4 | Creeks and paths | missing | Required where specified |
| E5 | Waterfalls and effects | missing | Pending |
| E6 | Optimization and package | partial | Pending |
| E7 | Environment release | missing | Pending |

36 milestones and 117 acceptance checklist items audited. The 0.2 release is not the complete plan.

## Execution order

1. Structural floors, voids, stairs, room/door topology and target fixtures.
2. Linked facade modules, apartment/mixed-use templates, connected villa wings and sign authoring.
3. Road graph and pavement modules, seeded neighborhoods, world placements and group adapter.
4. Landforms/geology, editable surface masks and export baking; city interfaces.
5. Plant constraints/distribution, connected waterways, paths and waterfall/effect runtime.
6. Worker/streaming/LOD, persistence and recovery, browser and native reference measurements.
7. Release only when every applicable gate has evidence; Kennedy reference and native-client-only gates remain explicit until resolved.

## 0.3 execution checkpoint — 12 October 2026

Substantial implementations now exist for M4/M6–M10, C0–C4, T1–T5 and E1–E6. All remain partial where their full acceptance includes unfinished controls, visual review or native proof. The table above records the starting state; current states and evidence live in `PLAN-COVERAGE.json`. The detailed implementation and remaining work are recorded in `../IMPLEMENTATION-STATUS.md`. Automated tests: 59 passing; production build passing. No browser/GPU/native acceptance is inferred.

The subsequent checkpoint adds 20 plant families, locked individual plant recipes, per-plot template controls, scope/budget export controls, SVG geometry plans/inventory, portable deduplicated project ZIPs, archive/model validation, touch/fly navigation and view snapshots. Software renders are inspected separately from the still-pending GPU/native gates.

## 0.4 room authoring checkpoint

Rectangular authored room boundaries generate shared wall/door geometry, furnishing, connections, locked regeneration and selection metadata. Required room entry routes are checked against actual supporting floor pieces and collision. Tests cover five themes, real shared-wall traversal, lock preservation, overlaps/inaccessible layouts, v3 migration and selected-room archive reconstruction. Floor isolation remains an inspection view; walk mode uses the complete geometry. Automated suite: 67 passing. Polygonal planning, per-unit detachment and remaining city/environment/performance gates are still open.

The native calibration download contains actual metre cubes/beam, XYZ landmark, one-sided checker plane, opacity and solid/visible probes, plus candidate placements/groups and recording instructions. It is separate from the editable scene and is explicitly unverified in the native client.

Native/GPU gates remain open. A named-action regression was fixed: targeted creation flags preserve the source defaults, named objects receive individual runtime render bindings, and invisible objects are excluded from pointer selection. Two new fixtures verify source/target state and actual serialized package reconstruction.

## 0.5 interrupted-work recovery checkpoint

Recovered the unpublished viaduct, material transparency, calibration and secondary GLB changes into a separate checkout. Added independent GLB binary/material/scope fixtures and a physical walkthrough of the emitted RWX viaduct. Automated suite: 75 passing; production build passes. This completes a bounded checkpoint only: arbitrary infrastructure authoring, external GLB viewer checks, browser/GPU inspection and native target acceptance remain pending. Next implementation task: per-unit/facade overrides with persistence, generation, scope and circulation fixtures.
