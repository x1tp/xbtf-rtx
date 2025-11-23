1. What’s realistically automatable for texturing

Today there are three useful layers you can wire an LLM agent into:

UV unwrapping & mesh prep

Blender, Houdini, etc. already have auto-unwrap, smart UV project, texel density tools, and non-overlap checking.

Research systems like 3D-GPT / SceneCraft mention using high-level commands for modeling and layout, and then letting DCC tools handle a lot of the “mechanical” prep like UVs.

Texture / material generation

Dedicated text→material tools and research:

NVIDIA’s material/texture pipelines, and SD-based tools like “text-to-PBR” (e.g. Diffusion models that output albedo/roughness/normal).

Commercial stuff like Substance 3D Sampler, Poly/Houdini Labs, Meshy’s material generation, etc., all take a prompt or reference and output tileable PBR sets.

These can all be called as black-box APIs: input = prompt + guides, output = PBR textures.

Validation and refinement

You can check:

UV overlaps, island density, aspect ratio.

Whether all required channels exist (baseColor, roughness, metalness, normal).

Material complexity vs performance budgets (texture count, resolution, etc.).

You can render previews (spheres, planes, your mesh in a standard lighting rig) and let a vision model critique them.

So yes: texturing fits into the exact same agent-tool pattern, just with more emphasis on UVs and PBR channels.

2. Extend the tool API for texturing

On top of the modeling tools we discussed, add a small set of texturing-focused tools.

2.1 UV tools

auto_unwrap_uvs(session_id, options) -> report

options might include:

method: smart_project, angle_based, cube, lightmap

target_texel_density

island_margin

Backend runs Blender’s UV operators (or equivalent) and returns:

Number of islands

Average texel density

Overlap count/percentage.

check_uv_quality(session_id, constraints) -> issues

Constraints e.g.:

max_overlap_percent

texel_density_range

max_island_aspect_ratio

Returns a structured issue list for the LLM to act on:

“Object body: 12% overlapping UV area, islands too small for 2k texture”.

(Optional) normalize_texel_density(session_id, target_density) -> report

For game assets where consistent texel density matters.

The agent can then:

Call auto_unwrap_uvs.

Call check_uv_quality.

If issues > threshold, tweak options and retry.

2.2 Texture / material generation tools

Assume you have either:

A text→PBR API (could be your own Stable Diffusion-based service, a commercial API, or a research model like Text2Tex / Text2Material), or

A bridge into Substance/Blender procedural material libraries.

You wrap that as:

generate_pbr_material(prompt, constraints) -> material_id

prompt: “worn red painted metal with rust around edges, mid roughness, no logos”.

constraints:

resolution: 1024 / 2048

channels: ["baseColor","roughness","metallic","normal"]

tiling: true/false

Returns:

material_id

URIs or paths to texture maps.

assign_material_to_objects(session_id, material_id, object_list) -> result

Applies the generated material to specific objects or material slots.

bake_textures(session_id, bake_spec) -> baked_maps

For workflow like:

High-poly → low-poly normal/ao/curvature

Or converting procedural materials into texture maps.

bake_spec includes:

source/target objects

maps to bake

resolution, padding.

get_material_state(session_id) -> materials

Returns:

list of materials

which objects/slots they’re assigned to

which texture maps are present, their resolutions, and file sizes.

2.3 Visual inspection tools

render_material_preview(material_id, preset) -> image

Renders the material on a standard primitive:

preset: sphere, plane, cloth, car_paint, etc.

Returns an image for a vision model to judge:

Is it tileable?

Any obvious seams?

Does it match the textual spec?

render_shaded_preview(session_id, camera_spec, mode) -> image

Same as the modeling preview but with:

mode: albedo, normal, roughness, metallic, lit.

Lets the agent see if, e.g., the roughness map is doing anything or if it’s basically flat.

3. How the agent uses this to “check progress” on texturing

A reasonable loop:

Parse prompt → constraints

From “low-poly stylized grocery van, hand-painted look, 1024×1024 max, one atlas” derive structured rules:

max_texture_resolution = 1024

max_materials_per_asset = 1

style = "stylized_handpainted"

UV phase

Call auto_unwrap_uvs with a chosen method.

Call check_uv_quality and see:

“Overlaps > 5%” → adjust seam angle or margin, retry.

“Texel density too low” → rescale islands.

Material generation phase

For each logical material region (metal body, rubber tires, glass windows), either:

Generate one multi-use PBR material per category with generate_pbr_material.

Or pick from a procedural library if the prompt matches (“rubber tire”, “glass”, “painted metal”).

After creation, call render_material_preview and have the LLM+vision judge:

Match to description.

Art style consistency across materials (all stylized vs one photorealistic).

Assignment + baking

Use assign_material_to_objects to apply to mesh.

If using high/low poly:

Call bake_textures to generate normal/ao from HP → LP.

Call get_material_state to verify:

All objects have a material.

All required channels exist.

Texture resolution and count obey constraints.

Final validation

Call render_shaded_preview in standard lighting (HDRI environment) to:

Spot obviously wrong maps (e.g. metallic map all white).

Check that rough vs smooth areas look right.

The LLM with vision can then do something like:

“The van’s glass looks metallic; reduce metallic value or use proper dielectric material.”

“Rust looks too uniform; re-generate material with stronger variation.”

Performance pass

Use get_material_state and maybe a special check_material_budget(constraints) that:

Counts textures, resolutions, and total VRAM footprint.

Suggests reduction (e.g. bake multiple materials into an atlas, downscale from 4K to 2K).

4. Design choices / pitfalls

Keep operations high-level

Instead of exposing “set pixel (x,y)” style APIs, you expose:

“Generate PBR material from style prompt.”

“Bake HP→LP normal map.”

“Downscale textures to target resolution.”

This keeps tool calls reasonable and less error-prone.

Separation of concerns

Modeling agent: deals with geometry and UVs.

Texturing agent: deals with materials, maps, and style.

A coordinator agent ensures style consistency and budgets.

Ground truth vs aesthetic judgment

UV overlaps, map presence, resolution are objective, easy to check.

“Does this look like stylized painted metal?” is fuzzy; you’ll rely on a vision model for that.

Versioning

You likely want material versions:

material_id includes revision (v1, v2, etc.).

The agent can fall back to a prior version if a new one is worse.

5. How this would plug into your setup

If you’re doing this with something like:

LLM (Gemini / GPT / Kimi) as the orchestrator.

Blender headless on your box.

A text→PBR microservice (e.g. SDXL or SD Turbo variant trained on materials).

Your existing agent/tool framework (MCP, Roo, custom).

Then the implementation tasks are roughly:

Wrap Blender UV + baking functions into the UV/bake tools above.

Stand up a small HTTP service for PBR generation and wrap it as generate_pbr_material.

Add preview rendering endpoints that spit back PNGs for the vision model.

Define JSON schemas for:

constraints

material_spec

uv_report

material_state