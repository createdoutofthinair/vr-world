# Authoritative multiplayer architecture

Status: proposal, not implemented or benchmarked.

Read the integrated documentation at https://createdoutofthinair.github.io/vr-world/#architecture.

Canonical website content: `src/site/serverArchitecture.json`. Diagrams are embedded SVG. The downloadable HTML companion is `public/docs/c3-server-architecture.html`.

## Integration contract

Keep semantic project data, neutral geometry, rendered view, emitted export reconstruction and future collision packages distinct. Existing browser walkthrough is not yet Rapier. Rust server hosting is separate from GitHub Pages.

## Chapters

1. Executive decision
2. Integration with c3 World Studio
3. Architecture overview
4. Physics engine decision
5. The server needs colliders, not artwork
6. Asset cooking and collision contracts
7. Memory model and streaming
8. What “same physics” actually means
9. Tick pipeline and time
10. Prediction and reconciliation
11. Remote interpolation and recovery
12. Physics authority and interactions
13. Animation synchronization
14. Protocol and browser transport
15. Interest management and large worlds
16. State restoration and determinism proof
17. Security and trust boundaries
18. Rust workspace and deployment
19. Operations and measurable budgets
20. Validation matrix and release gates
21. Implementation sequence
22. Decisions for review
23. Sources and evidence boundaries
