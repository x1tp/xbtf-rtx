# XBTF BOD → OBJ Conversion
This repository builds and ships a working BOD→OBJ pipeline, not a hypothetical research paper. The Node scripts under `scripts/` parse the legacy BOD text, generate accompanying `.mtl` files, and emit usable OBJ assets in `public/models`. The tooling is battle-tested with the XBTF bodies stored in `xbtf_models/v` and the extracted textures placed beside `public/models/true`.

---

## Command-line helpers

- `node scripts/convert-all-bods.mjs [pattern=...] [limit=...]` walks `xbtf_models/v`, filters `.bod` files by an optional case-insensitive `pattern`, and converts each target through `convertBodToObj`, writing both `.obj` and `.mtl` into `public/models`. Use `limit=N` to stop after `N` files during experiments.
- The lower-level entry point is `scripts/modeling.mjs --bod-to-obj <bodPath> <texDir> [name] [areaLimit] [partPattern] [flip=...?] [tess]` (and `--bod-to-obj-ex` for the `useEx` mode). These invocations expose the same implementation as the batch script plus knobs for area clipping, per-part filtering, winding control, and optional subdivision.

## What the converter actually does

1. **Parse the ASCII BOD.** `parseBOD` reads the file line-by-line, captures the `MATERIAL*` blocks, the vertex list (stopping at the `-1; -1; -1` terminator), and the face list. Part annotations appear as `/----- Part <num>: "name"` comments, and the first `-99` line whose flag column is zero marks the end of LOD 0 so the converter never mixes levels.
2. **Scale & orient.** Vertices are divided by 500 and the Z component is negated before being emitted as `v x y -z`, so our meshes match the modern OBJ coordinate system rather than the XBTF left-handed space.
3. **Build faces with UVs.** Faces emit per-triangle `vt` lines when the tokenized face line supplies them. The default `flipWinding` of `true` gives Blender-friendly ordering; pass `noflip` to keep the original winding. When `useEx` is enabled, the parser remaps face indices using the `/ex <n>` annotations that XBTF sometimes writes next to the vertex entries.
4. **Trim large triangles.** Setting `areaLimit=auto` causes the converter to compute the median triangle area and multiply it by eight, skipping any triangle that would blow past the threshold. A numeric `areaLimit` lets you clamp exports manually (handy when repairing placeholder geometry).
5. **Tessellate optionally.** Passing a `tess` level subdivides each triangle through `subdivideMesh`, smoothing domes or tubes before they hit the OBJ writer.
6. **Emit materials.** Each `MATERIAL` line becomes `newmtl mat_<id>` plus `Ka`, `Kd`, `Ks`, and — when available — `Ke`, `Ns`, and `d`. If a texture matching the material’s texture ID lives in `texDir` (defaults to `public/models/true` for the batch job), `map_Kd` is written using a relative path so OBJ viewers can locate the image next to the exported geometry.
7. **Group by part & material.** The OBJ output uses `g <partName>` and `usemtl mat_<id>` blocks so ships import with their hulls, turrets, and engines already separated. You can target a subset by passing `includePattern` (a regular expression) to export only parts whose names match.
8. **Texture discovery.** The converter looks for texture files whose basename equals the material’s texture ID, so drop the extracted `.jpg`/`.tga` files from the XBTF `.cat` archives into `public/models/true` before running the converter.

## Usage notes

- Every OBJ file is paired with a generated `.mtl`, and the converter writes `mtllib <name>.mtl` at the top of the OBJ so modern viewers grab the materials automatically.
- Use `tess=1` (or higher) to smooth curved sections, but expect the triangle count to grow rapidly; the batch script leaves tessellation off by default for speed.
- Override winding by passing `noflip` as the fifth argument to the CLI to match Blender or Maya’s native expectations when needed.
- `includePattern` lets you emit only a hull, turret, or another part named `engine` without rerunning the batch job for the entire ship. Parts without explicit names fall back to `part_<index>` grouping.
- When the BOD prints `/ex <n>` on vertex lines, enabling `useEx` ensures the exported triangles follow the engine’s intended ordering instead of the plain line order.

## Running a new build

1. Populate `xbtf_models/v` with the `.bod` bodies you want to convert.
2. Drop the extracted textures from the XBTF `.cat` files into `public/models/true` (names should match the texture IDs in the `.bod`).
3. Run `node scripts/convert-all-bods.mjs`; it prints `[index/total] <filename>` progress lines and writes both OBJ + MTL for every processed body.

If you need finer control, call `node scripts/modeling.mjs --bod-to-obj <bod> <texDir> shipname null null [tessLevel]` (or `--bod-to-obj-ex` for `useEx`) and inspect the console output for the paths it wrote.

---

By rewriting this document to match the implementation we already shipped, contributors can rely on the exact behavior defined in `scripts/modeling.mjs` instead of re-implementing a speculative parser. The codebase already works end-to-end; this doc now describes it.
