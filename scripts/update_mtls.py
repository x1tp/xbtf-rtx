import os
import glob

def update_mtl_files(models_dir):
    mtl_files = glob.glob(os.path.join(models_dir, '**/*.mtl'), recursive=True)
    print(f"Found {len(mtl_files)} .mtl files.")

    updated_count = 0
    
    for mtl_path in mtl_files:
        try:
            with open(mtl_path, 'r') as f:
                lines = f.readlines()
            
            new_lines = []
            modified = False
            current_material = None
            
            # Store material lines to check if map_bump already exists for the current material
            # We will process the file line by line.
            
            # However, a simpler approach is:
            # When we see 'map_Kd', we check if there's a corresponding normal map file.
            # If there is, we insert 'map_bump' or 'bump' if it's not already there in the current material block.
            
            # We need to be careful about where we insert it. Usually after map_Kd is fine.
            # But we need to know if the *current material* already has a bump map.
            
            # Let's parse the file into material blocks first
            materials = []
            current_mat_lines = []
            
            for line in lines:
                if line.strip().startswith('newmtl '):
                    if current_mat_lines:
                        materials.append(current_mat_lines)
                    current_mat_lines = [line]
                else:
                    current_mat_lines.append(line)
            if current_mat_lines:
                materials.append(current_mat_lines)
                
            # Now process each material block
            final_lines = []
            file_modified = False
            
            for mat_lines in materials:
                has_bump = any(l.strip().startswith(('map_bump', 'bump')) for l in mat_lines)
                has_diffuse = False
                diffuse_line_idx = -1
                diffuse_filename = None
                
                for i, line in enumerate(mat_lines):
                    if line.strip().startswith('map_Kd '):
                        has_diffuse = True
                        diffuse_line_idx = i
                        parts = line.strip().split()
                        if len(parts) > 1:
                            diffuse_filename = parts[1]
                        break
                
                if has_diffuse and not has_bump and diffuse_filename:
                    # Check if normal map exists for this texture
                    # The diffuse_filename is relative to the .mtl file location or absolute? 
                    # Usually relative.
                    
                    mtl_dir = os.path.dirname(mtl_path)
                    # Handle potential path separators in mtl file
                    diffuse_filename_os = diffuse_filename.replace('/', os.sep).replace('\\', os.sep)
                    
                    diffuse_abs_path = os.path.join(mtl_dir, diffuse_filename_os)
                    
                    # Check for normal map variations
                    base, ext = os.path.splitext(diffuse_abs_path)
                    normal_candidates = [
                        base + '_normal.png',
                        base + '_normal.jpg',
                        base + '_normal_soft.png'
                    ]
                    
                    found_normal = None
                    for candidate in normal_candidates:
                        if os.path.exists(candidate):
                            # Calculate relative path to put in mtl
                            # We want to keep the same directory structure as map_Kd
                            # if map_Kd was "true/23.jpg", normal should be "true/23_normal.png"
                            
                            # Get the directory part of the original map_Kd value
                            diffuse_dir = os.path.dirname(diffuse_filename)
                            candidate_filename = os.path.basename(candidate)
                            
                            if diffuse_dir:
                                found_normal = diffuse_dir + '/' + candidate_filename
                            else:
                                found_normal = candidate_filename
                                
                            # Ensure forward slashes for .mtl compatibility
                            found_normal = found_normal.replace('\\', '/')
                            break
                    
                    if found_normal:
                        # Insert map_bump after map_Kd
                        mat_lines.insert(diffuse_line_idx + 1, f"map_bump {found_normal}\n")
                        file_modified = True
                
                final_lines.extend(mat_lines)
            
            if file_modified:
                with open(mtl_path, 'w') as f:
                    f.writelines(final_lines)
                updated_count += 1
                # print(f"Updated {mtl_path}")

        except Exception as e:
            print(f"Error processing {mtl_path}: {e}")

    print(f"Finished. Updated {updated_count} .mtl files.")

if __name__ == '__main__':
    base_dir = os.path.join('public', 'models')
    update_mtl_files(base_dir)
