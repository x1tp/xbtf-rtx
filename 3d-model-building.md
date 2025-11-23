Yes. This is exactly the kind of thing people are already building around 3D-GPT / SceneCraft / BlenderLM etc., so you’re not being an idiot at all. 
GitHub
+3
arXiv
+3
chuny1.github.io
+3

You can think of it as:

LLM agent ⇄ “3D tool” API ⇄ Blender / TRELLIS / your own generator

Below is a concrete way to design that tool so the agent can both build the model and check its progress.

1. Architecture

Use an external 3D engine as the “muscle” and expose it as a small set of tools:

Backend options:

Blender in headless mode driven by Python. 
GitHub
+1

A text/image-to-3D model (e.g. Microsoft TRELLIS, NVIDIA AI Blueprint) that outputs meshes/fields. 
NVIDIA Blog
+2
GitHub
+2

A procedural engine you write (OpenSCAD-style / parametric CAD).

The LLM never touches geometry directly; it only:

Decides what high-level changes to make (“extrude this, bevel that, duplicate these”).

Calls tools to apply operations.

Calls tools to inspect state and previews.

Frameworks like 3D-GPT and SceneCraft show this anecdotally works: they use an LLM planner + modeling agent, and communicate with Blender/procedural tools through a constrained command API, with iterative feedback. 
ResearchGate
+3
arXiv
+3
chuny1.github.io
+3

2. Tool API design (what the agent sees)

For an MCP/tool-using agent, you’d expose a set of functions something like this (conceptual):

start_modeling_session(spec) -> session_id

Creates a new Blender file / TRELLIS asset / scene.

spec is a structured version of the user prompt: style, poly budget, size, unit, etc.

apply_operation(session_id, operation) -> op_result

operation is a small JSON command, e.g.:

{"type": "add_primitive", "kind": "cube", "size": [1,1,1], "name": "base_block"}

{"type": "extrude_face", "object": "base_block", "face_id": 3, "distance": 0.5}

The backend translates that into Blender Python (or equivalent) and applies it.

Returns:

Success/fail

Any error messages

Updated metrics (poly count, bounding box, etc.)

get_model_state(session_id) -> state

Returns:

List of objects and hierarchy

Poly/vertex counts per object

Bounding boxes, volumes, transforms

Materials assigned

This is what the LLM uses to “inspect” progress numerically.

render_preview(session_id, camera_spec) -> image

Renders a quick viewport-style preview (low res, Eevee/real-time).

Returns an image (URL or base64).

Vision-enabled agents can then self-critique by looking at the render – exactly what “iterative 3D modeling with LLM agents + vision” papers do. 
frederikstihler.me
+1

check_constraints(session_id, constraints) -> report

Example constraints:

“Total faces ≤ 5,000”

“Object height between 1.9m and 2.1m”

“No non-manifold edges”

Backend runs mesh checks and returns pass/fail + details.

SceneCraft uses a similar dual-loop approach: it generates Blender code, runs it, then uses feedback to tighten layout constraints. 
arXiv
+1

export_model(session_id, format) -> file_uri

Exports GLB/FBX/OBJ/STL once the agent is happy.

You can add more specialized tools later (UV unwrapping, baking, decimation, LODs).

3. How the agent “checks progress”

A sensible loop for the agent:

Plan / decompose

Parse user prompt → internal plan (base shape, details, materials).

3D-GPT style: separate conceptualization (describe object in detail) from modeling (turn into operations). 
arXiv
+2
AI Advances
+2

Build in small steps

Call apply_operation for each logical step instead of dumping huge scripts.

After each step, call get_model_state to see:

Did poly count blow up?

Is bounding box still within spec?

Are required parts present?

Visual inspection

Every N steps, call render_preview.

Use the same or a second model with vision to compare:

Prompt vs. render (“does it actually look like a low-poly coffee van?”).

Before/after render to detect regressions.

Constraint checking

Periodically call check_constraints using a machine-readable constraint list the agent builds from the prompt (“mobile-game asset: ≤ 2k tris, single material, no overlapping UVs”, etc.).

Refinement / repair

If something is wrong (constraints fail, image doesn’t match spec), agent:

Adjusts operations (e.g., “reduce bevel segments”, “delete high-poly detail”).

Or backs up (you can support undo or “restore checkpoint”).

This is essentially what current research prototypes do (multi-agent, iterative, vision-in-the-loop), just wrapped in a tool interface that your orchestrator understands. 
frederikstihler.me
+2
arXiv
+2

4. Practical constraints and gotchas

Sandboxing is critical
Arbitrary Blender Python is powerful and dangerous. Projects like BlenderLM and real-world “execute_blender_code” setups emphasize sandboxing/timeouts because the LLM will happily write slow or crashing scripts. 
GitHub
+1

Keep your tool API high-level (add cube, extrude, boolean) instead of “run any Python.”

Set time and memory limits on each call.

Granularity vs. token cost

If operations are too fine-grained (“move this vertex”), you get tons of tool calls.

For now it’s better to keep to object-/component-level commands plus occasional script snippets for repetitive patterns.

Evaluation is fuzzy

Numeric checks are easy; judging “does this look good?” is subjective.

Vision-based self-critique works, but results can diverge from human taste. 
arXiv
+1

3D generator vs. 3D editor
You can combine:

A dedicated text/image→3D generator (e.g. TRELLIS) to get a starting mesh. 
GitHub
+2
Medium
+2

Then use your Blender tool API for clean-up, optimization, and progress-checked editing.