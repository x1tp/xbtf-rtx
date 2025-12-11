# Copilot instructions

## High-level picture
- `src/App.tsx` wires the entire experience: query params turn the React tree into a `Scene` canvas, an admin editor, or the lightweight viewer, and it keeps the `FleetSimulator` update loop alive via `useEffect`. Keep that entry point in mind when touching rendering, routing, or input handling.
- `Scene.tsx` renders a R3F + Drei world fed by the `getSectorLayoutById` helper (see `config/sector.ts` + `config/universe_xbtf.ts`) and the dynamic economy/fleet lists in `src/store/gameStore.ts`. Use the existing spacing logic (`place(p: [number, number, number])` with `spacing = 30`) whenever you place stations/gates/ships so you stay in sync with the visual grid.
- Visual state, HUD, navigation indicators, and economy data all read from `useGameStore`; mutations go through its setters + fetch-to-backend hooks (see `/__universe/init`, `/__universe/state`, `/__universe/fleets`, `/__universe/time-scale`, `/__universe/tick`, and `/__universe/ship-report` in that file), so prefer using the store rather than duplicating fetch logic.

## Simulation & AI patterns
- `FleetSimulator.ts` keeps per-fleet runtime state, limits nav builds/pathfinding per frame, and reports selected `ShipReportType` events back through `useGameStore.reportShipAction`. Follow that pattern when adding new behaviors: keep logic/state inside the simulator and mutate the store only through its helper methods so the UI stays smooth.
- `src/ai/navigation.ts`, `src/ai/useAiNavigation.ts`, and `src/ai/universePathfinding.ts` build cached nav graphs, compute obstacles from the scene, and expose `findPath`/`findNextHop`. Extend nav obstacles only via these helpers to keep `Station` and `Gate` collisions 1:1 with the runtime graph.
- Physics runs in `src/physics/PhysicsStepper.tsx` / `src/physics/RapierWorld.ts`. Station colliders (see `src/components/Station.tsx`) register with Rapier right after the model loads; do not duplicate collider setup elsewhere—add new physics bodies through the same `ensureRapier` / `getWorld` helpers.

## Admin & persistence conventions
- `/admin` routes in `App.tsx` render the different editors; `PlanetEditor` loads/saves `sector:config` from `localStorage` and only mutates the size/position that `Scene` later consumes, while `PlumeEditor` uses `custom_plume_presets` to store stage settings (see `src/admin/PlanetEditor.tsx` and `src/admin/PlumeEditor.tsx`). Respect these keys when you add editor UI.
- The `persist` service (`src/services/persist.ts`) handles `/__persist/load` and `/__persist/save` for user metadata (categories, names, plumes, cockpits, weapons). Use it (and its listeners) whenever you introduce new per-model preferences so the backend consistently stores them.

## Developer workflows
- `package.json` scripts are the authoritative commands: `npm run dev` launches Vite dev server, `npm run build` runs `tsc -b && vite build`, `npm run preview` serves the built output, and `npm run lint` runs ESLint (see `eslint.config.js`).
- Specialized runners live under `scripts/`: `models:convert` (`scripts/convert-all-bods.mjs`), `model:generate`/`model:watch` (`scripts/generate-model.mjs`), `material:generate` (`scripts/generate-pbr.mjs`), and `textures:upscale` (`scripts/upscale-textures.mjs`). When regenerating assets, use `model:watch` for live updates and the other scripts to keep `public/models.json` and `/public/materials` in sync with the baked assets.

## Project-specific cues
- `Scene` + `FleetSimulator` expect the economy store to keep both static layout stations and dynamically generated trader stations; rely on the `insert` logic in `Scene` (and the matching `setNavObjects` call in `App.tsx`) so new stations immediately appear on the mini-maps and HUD overlays.
- Stations/gates/ships log their nav radius via `userData.navRadius`; the nav graph builder respects those when building obstacles (see `computeSceneObstacles` in `src/ai/navigation.ts`). Add new nav-affecting objects through the same userData pattern.
- Model loading paths live under `public/models/` plus `public/materials/`/`public/models/tex`. Station loaders check for `.bod`, `.obj`, and the default GLB—follow that pipeline when adding new models or textures.

## Docs & references
- Consult `docs/economy_concept.md`, `docs/sector-stations.md`, and the files under `docs/xtension` for lore that drives naming, ship roles, and economy behavior; new UI should map to those terms.
- `config/plumes.ts` lists built-in plume presets referenced by `PlumeEditor`/`NebulaPlume`. Keep new presets synchronized there if you want them available in both runtime and editor.

If any instruction is unclear or a new area needs more detail, please ask for clarification so I can iterate.