

# **Technical Specification and Conversion Methodology for Legacy X-Engine Geometry Assets**

## **Executive Summary**

The digital preservation and modification of legacy three-dimensional assets from the late 1990s era of space simulation—specifically the *X-Universe* series developed by Egosoft—presents a complex array of challenges rooted in proprietary file specifications, non-standard coordinate systems, and evolving graphics engine architectures. The user query necessitates the development of a robust methodology to extract, parse, and convert geometry files from *X: Beyond the Frontier* (X:BTF), the seminal 1999 title, into the industry-standard Wavefront OBJ format.

This report provides an exhaustive technical analysis of the Egosoft Body (BOD) file format, the compiled Binary Object (BOB) format, and the compressed Packed Body (PBD) archive. It deconstructs the syntax of the X-Engine’s geometry definitions, including the integer-based vertex scaling logic, bitwise material flagging, and the hierarchical management of Levels of Detail (LOD). Furthermore, it outlines a comprehensive algorithmic strategy for procedural conversion, addressing critical issues such as coordinate swizzling, manifold integrity for 3D printing, and the reconstruction of material libraries from legacy shader definitions.

The research synthesizes data from two decades of community reverse-engineering efforts, analyzing tools such as DBOX2, x2bc, and custom C++ parsers to establish a unified theory of the X-Engine's asset pipeline. The findings indicate that while the BOD format is ostensibly human-readable ASCII, it relies on a strict, context-sensitive state machine for parsing, where geometric data is often intertwined with engine-specific render states that must be translated or discarded to produce a compatible OBJ file.

---

## **1\. Historical and Technical Context of the X-Engine Asset Pipeline**

To engineer a functional conversion tool for *X: Beyond the Frontier*, one must first understand the technological constraints and design philosophies of the era in which it was created. Released in 1999, X:BTF operated on a custom engine optimized for DirectX 6, a period in 3D graphics characterized by fixed-function pipelines rather than the programmable shaders of the modern era.1 This historical context is not merely anecdotal; it directly influences the data types, coordinate precision, and material definitions found within the source files.

The management of assets in the X-Universe is governed by a Virtual File System (VFS) that packs thousands of individual assets into catalog files (.cat and .dat). Within this VFS, three specific file extensions govern 3D geometry. A converter must be capable of identifying and handling each of these states to ensure a seamless extraction process.

### **1.1 The Egosoft Geometry Ecosystem: PBD, BOB, and BOD**

The Egosoft pipeline utilizes a triad of formats to balance disk usage, load times, and modifiability. The user's query explicitly references a "bod from xbtf," but in practice, files extracted from the game's archives typically appear in one of three states.

#### **1.1.1 The PBD Archive (Packed Body)**

In the resource-constrained environment of 1999, disk space was at a premium. Consequently, Egosoft utilized compression extensively. The .pbd format is the rawest form of storage on the distribution media. Research confirms that .pbd files are essentially standard Gzip-compressed archives containing either a .bod or .bob file.

The implications for a conversion utility are significant. A parser designed to read ASCII text will fail catastrophically if fed a .pbd file. The ingestion logic must essentially "sniff" the file signature (Magic Numbers: 0x1F 0x8B) before processing. If these bytes are present, the stream must be inflated using the DEFLATE algorithm. This is a crucial preprocessing step often overlooked in rudimentary scripts, leading to "invalid file format" errors.

#### **1.1.2 The BOB File (Binary Object Body)**

The .bob file represents the binary serialization of the geometry. While .bod files are text-based, parsing text is computationally expensive—requiring string splitting, tokenization, and type conversion (string to float). To optimize load times during gameplay, the X-Engine compiles text definitions into a binary struct memory dump, the .bob file.3

Community tools like the *X2 BOD Compiler* (x2bc) were developed specifically to reverse this compilation, "decompiling" the binary byte stream back into the human-readable BOD format.5 It is critical to note that older converters designed for *X2: The Threat* or *X3: Reunion* may struggle with X:BTF binaries due to subtle version differences in the header structure. However, the fundamental vertex packing strategy remains largely consistent across the early trilogy.

#### **1.1.3 The BOD File (ASCII Body Definition)**

This is the target format for our analysis and the intermediate stage for conversion. The .bod file contains the geometry data in plain text. It was designed to be editable by hand—a feature that fostered the early modding community. However, as model complexity increased from simple cubes to 10,000-polygon capital ships, manual editing became impossible, necessitating tools like DBOX (Double Shadow's BOD Importer).7 The converter described in this report operates by parsing this ASCII text stream.

### **1.2 Evolution of the X-Engine Architecture (X:BTF to X3)**

While the file extensions remained consistent from 1999 (*X:BTF*) to 2008 (*X3: Terran Conflict*), the internal structure of the files evolved to support advancing graphics technologies. Understanding these differences is vital to avoid "version mismatch" errors where a parser expects an X3 feature that doesn't exist in an X:BTF file.

| Feature | X: Beyond the Frontier (1999) | X3: Terran Conflict (2008) | Implication for Converter |
| :---- | :---- | :---- | :---- |
| **Material Definitions** | Basic Diffuse/Specular. | Complex Shader flags (Bump, Normal, Environment). | Converter must handle missing flags gracefully.7 |
| **Scene Hierarchy** | Monolithic Bodies. Geometry and placement often merged. | Strict separation of \_scene (layout) and bodies (mesh). | X:BTF parsers must be ready to find multiple mesh parts in one file.9 |
| **LOD Implementation** | Rudimentary part separation (-99 flag). | Complex AQC (Automatic Quality Control) integration. | Parser must detect \-99 delimiters to avoid mesh overlapping.10 |
| **Texture References** | Simple filenames (tex01.jpg). | Path-based references (dds\\tex01.dds). | Texture search paths must be flexible. |

The research indicates that later tools like DBOX2 introduced compatibility layers to handle these discrepancies, but a dedicated script for X:BTF must be simplified to ignore the complex shader metadata that characterizes the later games, focusing instead on the core geometry definition.7

---

## **2\. Anatomical Deconstruction of the BOD Specification**

The development of a parser requires a granular understanding of the BOD syntax. The format is declarative, line-based, and delimited by semi-colons. It effectively dumps the engine's C++ structs into a text file.

### **2.1 The Material Definition Block**

The header of a BOD file typically establishes the visual properties of the object. This section, often labeled with MATERIAL6 or similar version identifiers, dictates how light interacts with the surface.

A representative material line from the research is as follows:  
MATERIAL6: 0; 0x2000000; 1; argon.fx; 57; diffcompression;SPTYPE\_BOOL;0;....7  
This line contains a wealth of data that must be mapped to the Wavefront MTL standard:

* **Material Index (0):** The identifier used later in the face list to assign this material to specific polygons.  
* **Bitmask Flags (0x2000000):** These hexadecimal values represent render states (e.g., "Self-Illuminated," "Transparent," "Metal"). In a basic OBJ conversion, these are difficult to map perfectly to the simple Phong shading model of .mtl files, but they serve as indicators for parameters like d (dissolve/opacity) or Ke (emissive color).  
* **Shader/Texture Reference (argon.fx):** This is the most critical field. It points to the texture file or shader script. The converter must extract this string to populate the map\_Kd (diffuse map) field in the output MTL file.7

Analysis of Bitwise Flags:  
The snippet 11 mentions "flags" associated with materials and faces. In the context of 1999 rendering, flags like 0x2000000 likely toggle specific DirectX pipeline states. For a visual conversion to modern PBR (Physically Based Rendering) workflows, these are largely obsolete, but for a 1:1 restoration, they would need to be interpreted into modern roughness/metallic maps—a scope likely beyond a standard OBJ converter but relevant for advanced archiving.

### **2.2 The Coordinate System and Vertex Scaling**

The single most frequent point of failure in converting Egosoft assets is the handling of vertex coordinates. The raw data in a BOD file does not represent metric units directly. Instead, it utilizes a fixed-point integer system.

#### **2.2.1 The Integer Anomaly**

Vertices in BOD files are stored as large integers, e.g., 4094; 7103; 3751;.11 If loaded directly into 3ds Max or Blender, these coordinates result in objects that are kilometers wide, far exceeding the standard viewport clipping planes. This phenomenon is corroborated by user reports of "Vertex coordinate too big" errors.12

The Scaling Divisor:  
Extensive community testing has identified the required scaling divisor to be 500\. This magic number converts the internal engine units into the units used by the game's scene graph (which roughly correspond to meters).

$$P\_{obj} \= \\frac{P\_{bod}}{500.0}$$

For example, a raw X coordinate of 4094 becomes 8.188 in the OBJ file. This operation must be applied to every single geometric vertex ($x, y, z$) in the file.

#### **2.2.2 Coordinate Swizzling (Axis Orientation)**

The X-Engine operates in a **Left-Handed** coordinate system where Y is Up and Z is Forward (into the screen). Most modern modeling suites (Blender, Maya) and the OBJ format typically default to a **Right-Handed** system (either Y-Up/Z-Back or Z-Up/Y-Back).

Direct export without transformation results in ships that fly "backwards" or "sideways." The standard transformation matrix to align an X:BTF model with a standard OBJ viewer involves inverting the Z-axis:

* $X\_{out} \= X\_{in}$  
* $Y\_{out} \= Y\_{in}$  
* $Z\_{out} \= \-Z\_{in}$

This "swizzling" ensures that the starboard side of the ship remains starboard and the engines remain at the rear.14

### **2.3 Topological Definitions: The Face List**

Following the vertex block, the BOD file defines the topology—the faces that connect the vertices. The syntax here is complex and variable-length, requiring a sophisticated parsing state machine.

A typical face line follows this schema:  
MatID; V1; V2; V3; Flags; Normal\_Info; UV\_Info;  
**Detailed Breakdown of the Schema:**

| Token Index | Data Type | Description | Converter Action |
| :---- | :---- | :---- | :---- |
| **0** | Integer | **Material ID**. Links the face to the header material list. | Write usemtl \[MaterialName\] to OBJ before this face. |
| **1, 2, 3** | Integers | **Vertex Indices**. References the vertex array. | Add 1 to each (OBJ is 1-based, BOD is 0-based). |
| **4** | Integer | **Face Flags**. E.g., \-25 (standard), \-9 (special). | Used to detect the format of subsequent data.11 |
| **5** | Integer | **Smoothing Group**. | Maps to OBJ s \[group\_id\]. |
| **6-7** | Floats | **Texture UVs** (u, v) for Vertex 1\. | Write to OBJ vt list. |
| **N: {}** | Block | **Normal Vector**. {x; y; z;} | Write to OBJ vn list. |

The "Split Vertex" Phenomenon:  
Research snippet 10 and 10 highlight a curiosity: simple shapes like pyramids often have far more vertices than expected (e.g., 16 vertices for a 6-face object). This is a result of Hard Shading. In 1999, to create a sharp edge (where light does not smooth across faces), the engine required the vertices at that edge to be duplicated—one for each face's normal vector.

* **Implication for Converter:** The converter should preserve these duplicate vertices if the goal is to maintain the original "sharp" look of the X:BTF ships. However, if the goal is 3D printing, the converter logic should ideally include a "Weld Vertices" post-process step to merge coincident points and create a watertight manifold.15

### **2.4 Level of Detail (LOD) Management Strategy**

One of the most critical structural elements of the BOD format is the embedding of multiple Levels of Detail (LOD) within a single file. The Egosoft engine uses an Automatic Quality Control (AQC) system to swap models based on distance from the camera to maintain frame rates.10

In the ASCII file, these LODs are separated by delimiters. The most common delimiter identified is \-99;.9

* **Structure:**  
  1. Header / Materials  
  2. BODY Start  
  3. LOD 0 Vertices / Faces (High Detail)  
  4. Delimiter \-99;  
  5. LOD 1 Vertices / Faces (Medium Detail)  
  6. Delimiter \-99;  
  7. ...  
  8. End of File

Parsing Risk: A naive parser that simply reads "all vertices" and "all faces" will effectively superimpose all LODs on top of each other. The result is a visual mess of z-fighting polygons.  
Mitigation: The conversion logic must implement a "LOD Selector." The safest default behavior is to parse the first body block (LOD 0\) and terminate parsing upon encountering the first \-99 delimiter. Advanced converters might export mesh\_LOD0.obj, mesh\_LOD1.obj, etc., as separate files.16

---

## **3\. Algorithmic Conversion Strategy**

Having deconstructed the format, we can now formulate the algorithmic logic required to "make a way" to convert these files. This section details the procedural flow for a Python-based tool, leveraging the language's strong string manipulation capabilities.17

### **3.1 The Parsing State Machine**

The parser must operate as a Finite State Machine (FSM) because the interpretation of a line of numbers depends entirely on which block of the file is currently being read.

**States:**

1. **INIT:** Check file signature. If Gzip (0x1F8B), decompress. If binary BOB, raise error or invoke x2bc.  
2. **HEADER\_SCAN:** Read line-by-line looking for MATERIAL keywords. Populate a material dictionary {index: texture\_name}.  
3. **BODY\_SEEK:** Look for the start of the vertex block. This is often implicit, following the header, or explicitly marked by a vertex count integer.  
4. **VERTEX\_READ:** Read N lines of coordinates. Apply $v/500.0$ scaling. Apply axis swizzle. Store in list V\_List.  
5. **FACE\_READ:** Read M lines of face definitions. For each face, extract Material Index, vertex indices, and UVs.  
6. **LOD\_CHECK:** After each face or block, check for \-99;. If found, trigger end-of-part logic (either break or start new group).

### **3.2 Handling Textures and the Material Library (MTL)**

A significant pain point for users is the "White Box" syndrome—geometry without textures.7 This occurs because the BOD file references textures inside the game's VFS (e.g., tex/metal\_plate.jpg), which do not exist as loose files on the user's OS.

The MTL Generation Logic:  
The converter must generate a standard .mtl file alongside the .obj.

1. **Extraction:** For every MATERIAL line in the BOD, create a newmtl material\_ID entry in the MTL file.  
2. **Mapping:** Parse the texture filename (e.g., argon\_hull.jpg). Write map\_Kd argon\_hull.jpg to the MTL.  
3. **User Guidance:** The report must explicitly state that the *converter cannot extract the images*. The user must use a separate tool (like X3 Editor 2\) to extract the .jpg or .tga files from the game's .cat files and place them in the same folder as the generated OBJ.19 Without this manual step, the MTL file points to non-existent images.

### **3.3 Python Implementation Logic**

The following logic outlines the robust handling of the data, incorporating error checking for the specific anomalies found in X:BTF files (like UnicodeDecodeError in legacy files 20).

Python

def parse\_bod\_line(line):  
    \# Strip comments (C-style // and Egosoft /\!...\!/)  
    if '//' in line:  
        line \= line.split('//')  
    \# Regex to remove block comments if necessary  
    \# Split by semicolon  
    tokens \= \[t.strip() for t in line.split(';') if t.strip()\]  
    return tokens

def process\_face\_line(tokens, current\_offset):  
    \# Token 0: Material ID  
    mat\_id \= int(tokens)  
      
    \# Token 1-3: Vertex Indices  
    \# CRITICAL: OBJ is 1-based. BOD is 0-based.  
    \# CRITICAL: If parsing multiple LODs in one file, indices might be relative   
    \# to the start of the part, or global. X-Engine usually uses global relative   
    \# to the body block.  
    v1 \= int(tokens) \+ 1  
    v2 \= int(tokens) \+ 1  
    v3 \= int(tokens) \+ 1  
      
    return (mat\_id, v1, v2, v3)

**Vertex Scaling Implementation:**

Python

SCALE\_FACTOR \= 500.0  
def process\_vertex(tokens):  
    x \= float(tokens) / SCALE\_FACTOR  
    y \= float(tokens) / SCALE\_FACTOR  
    z \= float(tokens) / SCALE\_FACTOR  
    return (x, y, \-z) \# Invert Z for OBJ

---

## **4\. Advanced Topics and Edge Cases**

### **4.1 The "Scene" vs. "Body" Trap**

Users frequently attempt to convert "Scene" files (e.g., argon\_m1\_scene.bod) and are confused by the lack of geometry.18

* **The Issue:** Scene files contain *references* to bodies (paths like objects\\ships\\argon\\argon\_m1\_body), not the vertices themselves.  
* **The Solution:** The converter should detect if a file is a scene (usually by looking for the keyword path or specific scene instructions). If it is a scene, it should alert the user: "This is a Scene file. Please convert the referenced Body files listed inside: \[List of paths\]."

### **4.2 Manifold Integrity for 3D Printing**

Snippet 15 and 16 mention the use of these models for 3D printing. The X:BTF models are "game-ready," meaning they are optimized for rendering, not physical manufacturing. They often consist of intersecting shells (e.g., a turret barrel simply sticking through a hull plate) rather than a unified boolean mesh.

* **Implication:** A direct conversion to OBJ is sufficient for rendering, but for printing, the mesh will likely require voxelization or boolean union in software like Microsoft 3D Builder or Meshmixer to create a single printable shell. The converter cannot easily automate this "healing" process.

### **4.3 Texture Path Resolution and The VFS**

In X:BTF, the texture paths are simple (e.g., tex01.jpg). In later games, they became complex (e.g., dds\\argon\_diff\_01.dds). A robust converter should strip directory prefixes from the texture definitions in the MTL file.

* *Input:* attributes\\maps\\texture.jpg  
* Output MTL: map\_Kd texture.jpg  
  This "flattening" of the directory structure simplifies the user's task of gathering textures into a single folder.

---

## **5\. Case Study: Porting Capital Class Assets**

Snippet 7 details a specific use case: porting the "Odysseus" battleship from X3 back to X4 or vice-versa. This highlights the practical application of this research.  
The Odysseus, being a capital ship, likely utilizes a complex Scene file referencing multiple parts (Hull, Bridge, Turrets, Engines).

* **Workflow:**  
  1. **Decompile** objects\\ships\\paranid\\paranid\_M2\_scene.bob to identify components.  
  2. **Extract** the referenced body files (e.g., paranid\_M2\_hull.bob).  
  3. **Convert** the hull body using the 1/500 scaling logic.  
  4. **Reassemble:** Import the hull OBJ into Blender. Import the bridge OBJ. Manually position them according to the coordinates found in the Scene file (which also need 1/500 scaling).

This hierarchical reconstruction confirms why a simple "one-click" converter is difficult to achieve for full ships; the data is distributed across multiple files.

---

## **6\. Existing Tooling Landscape and Recommendations**

The research identifies several tools that have historically attempted this task. A comparative analysis justifies the need for the custom methodology proposed here.

| Tool | Primary Function | Pros | Cons |
| :---- | :---- | :---- | :---- |
| **DBOX2** 7 | 3ds Max / GMax Import Script | Native support, highly accurate, handles scenes. | Requires legacy software (GMax/Max 2010). Hard to automate. |
| **x2bc** 6 | Compiler / Decompiler | Essential for BOB\<-\>BOD conversion. | Does not convert to OBJ. It only decompiles to text. |
| **bod2obj (nistur)** 16 | C++ Converter | Fast, standalone, supports batching. | "Hacky" code, lacks material support, ignores normals/UVs in some versions. |
| **Proposed Python Script** | Custom Converter | Portable, modifiable, supports MTL generation. | Requires user to run Python, requires manual texture extraction. |

Recommendation:  
For the user seeking to "make a way," writing a Python script based on the logic in Section 3 is the most viable modern solution. It avoids the dependency on obsolete 3ds Max versions and improves upon bod2obj by properly generating .mtl files for texture support.

---

## **7\. Conclusion**

The conversion of *X: Beyond the Frontier* assets is a solvable engineering problem that requires a specific sequence of operations: **Decompression** (from PBD), **Decompilation** (from BOB), **Parsing** (of BOD), **Scaling** (1/500), and **Remapping** (to OBJ/MTL).

The analysis confirms that the primary technical hurdles are the integer-based coordinate system and the decoupling of geometry (Bodies) from layout (Scenes). By adhering to the 1/500 scaling rule and correctly handling the 0-based to 1-based index conversion, a script can reliably reconstruct the geometry. However, the complete restoration of the visual asset requires manual intervention to extract textures from the game's catalog archives, a step that cannot be fully automated due to the proprietary nature of the VFS.

This methodology provides the blueprint for a tool that bridges the 25-year gap between the X-Engine's legacy DirectX 6 roots and modern 3D workflows, facilitating preservation and creative modification of this classic space simulation.

---

## **8\. Data Tables and Specifications**

### **Table 1: BOD Face Line Syntax Specification**

| Field | Type | Example Value | Notes |
| :---- | :---- | :---- | :---- |
| **MatID** | Int | 0 | Index into header Material list. |
| **Vert A** | Int | 126 | Index of first vertex. |
| **Vert B** | Int | 128 | Index of second vertex. |
| **Vert C** | Int | 127 | Index of third vertex. |
| **Flag** | Int | \-25 | Render state flag (Standard/Transp). |
| **Smooth** | Int | 1 | Smoothing group ID. |
| **UV A** | Float Pair | 0.32; 0.34; | Texture coordinates for Vert A. |
| **UV B** | Float Pair | 0.33; 0.35; | Texture coordinates for Vert B. |
| **UV C** | Float Pair | 0.32; 0.34; | Texture coordinates for Vert C. |
| **Normal** | Vector | /\! N: {x;y;z}\!/ | Optional; enclosed in block comments. |

### **Table 2: Coordinate Space Transformation Matrix**

| Axis | Input (BOD) | Output (OBJ) | Reason |
| :---- | :---- | :---- | :---- |
| **X** | $x$ | $x$ | Lateral axis is consistent. |
| **Y** | $y$ | $y$ | Vertical axis is consistent (Y-Up). |
| **Z** | $z$ | $-z$ | Invert depth to correct Left/Right Handedness. |
| **Scale** | $1$ | $0.002$ ($1/500$) | Convert fixed-point integer to meters. |

### **Table 3: Material Flag Interpretation (Hypothetical for Conversion)**

| Hex Flag | Potential Meaning | OBJ Parameter |
| :---- | :---- | :---- |
| 0x00 | Standard Diffuse | Kd 1.0 1.0 1.0 |
| 0x10 | Self-Illuminated | Ke 1.0 1.0 1.0 (Emissive) |
| 0x20 | Transparent/Glass | d 0.5 (Dissolve) |
| 0x40 | Metallic/Shiny | Ns 500 (Specular Hardness) |

*Note: The exact bitmask definitions for X:BTF are not fully documented in the public domain; these mappings are derived from community observation of render behavior.*

#### **Works cited**

1. X: Beyond the Frontier \- Episode 1 \- That Starboard engine... \- YouTube, accessed November 23, 2025, [https://www.youtube.com/watch?v=sq5koE-2YgM](https://www.youtube.com/watch?v=sq5koE-2YgM)  
2. X-BtF : mods \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=192243](https://forum.egosoft.com/viewtopic.php?t=192243)  
3. Binary Bod files \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=33308](https://forum.egosoft.com/viewtopic.php?t=33308)  
4. Guide :: Editing Terran Conflict \- The Very Basics \- Steam Community, accessed November 23, 2025, [https://steamcommunity.com/sharedfiles/filedetails/?id=135130516](https://steamcommunity.com/sharedfiles/filedetails/?id=135130516)  
5. doubleshadow's DBOX2 (1.11) \- Page 3 \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=113237\&start=40](https://forum.egosoft.com/viewtopic.php?t=113237&start=40)  
6. X2 BOD Compiler, accessed November 23, 2025, [http://x2bc.doubleshadow.wz.cz/](http://x2bc.doubleshadow.wz.cz/)  
7. BOD file specifications for use with conversion script \- Egosoft Forum, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=432234](https://forum.egosoft.com/viewtopic.php?t=432234)  
8. D-BOX Customer Support | Contact Us, accessed November 23, 2025, [https://www.d-box.com/en/customer-support/contact-us](https://www.d-box.com/en/customer-support/contact-us)  
9. Adding My New Ships \- .BOD File Format Question \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=225230](https://forum.egosoft.com/viewtopic.php?t=225230)  
10. A question about bod-Files \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=87586](https://forum.egosoft.com/viewtopic.php?t=87586)  
11. Question about .bod files \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=452280](https://forum.egosoft.com/viewtopic.php?t=452280)  
12. Exporting Help\! \- Polycount, accessed November 23, 2025, [https://polycount.com/discussion/93071/exporting-help](https://polycount.com/discussion/93071/exporting-help)  
13. Error Vertex coordinate too big adjust object scale \- Forums, Autodesk, accessed November 23, 2025, [https://forums.autodesk.com/t5/3ds-max-forum/error-vertex-coordinate-too-big-adjust-object-scale/td-p/8211257](https://forums.autodesk.com/t5/3ds-max-forum/error-vertex-coordinate-too-big-adjust-object-scale/td-p/8211257)  
14. Making custom ships \- EGOSOFT, accessed November 23, 2025, [https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Assets%20Modding/Community%20Guides/Making%20custom%20ships/](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Modding%20Support/Assets%20Modding/Community%20Guides/Making%20custom%20ships/)  
15. bod2obj \- my attempt at a model converter : r/X3TC \- Reddit, accessed November 23, 2025, [https://www.reddit.com/r/X3TC/comments/rsz23q/bod2obj\_my\_attempt\_at\_a\_model\_converter/](https://www.reddit.com/r/X3TC/comments/rsz23q/bod2obj_my_attempt_at_a_model_converter/)  
16. nistur/bod2obj: Converter for X3's .bod files to OBJs for 3D printing \- GitHub, accessed November 23, 2025, [https://github.com/nistur/bod2obj](https://github.com/nistur/bod2obj)  
17. Most efficient way to parse a file in Python \- Stack Overflow, accessed November 23, 2025, [https://stackoverflow.com/questions/10702551/most-efficient-way-to-parse-a-file-in-python](https://stackoverflow.com/questions/10702551/most-efficient-way-to-parse-a-file-in-python)  
18. .bod files and Gmax Importing/Export--Help Please \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=330475](https://forum.egosoft.com/viewtopic.php?t=330475)  
19. Looking for .obj ship and station files. \- egosoft.com, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=384790](https://forum.egosoft.com/viewtopic.php?t=384790)  
20. \[TOOL\] XPL (LuaJIT) files decompiler \- Page 2 \- Egosoft Forum, accessed November 23, 2025, [https://forum.egosoft.com/viewtopic.php?t=362114\&start=20](https://forum.egosoft.com/viewtopic.php?t=362114&start=20)