import os
import argparse
import numpy as np
from PIL import Image
from scipy.ndimage import sobel, gaussian_filter

def generate_normal_map(input_path, output_path, strength=10.0, sigma=2.0):
    try:
        img = Image.open(input_path).convert('RGB')
        arr = np.array(img) / 255.0
        height = np.mean(arr, axis=2)
        hp = height - gaussian_filter(height, sigma=sigma)
        dx = sobel(hp, axis=0) * strength
        dy = sobel(hp, axis=1) * strength
        dz = np.ones_like(height)
        magnitude = np.sqrt(dx**2 + dy**2 + dz**2)
        normal = np.dstack((-dy, -dx, dz)) / magnitude[..., None]
        normal = (normal * 0.5 + 0.5) * 255
        Image.fromarray(normal.astype(np.uint8)).save(output_path)
        print(f"Generated: {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description='Generate normal maps for textures.')
    parser.add_argument('--soft', action='store_true', help='Generate soft normals (lower strength/sigma)')
    parser.add_argument('--force', action='store_true', help='Overwrite existing normal maps')
    args = parser.parse_args()

    strength = 4.0 if args.soft else 10.0
    sigma = 1.5 if args.soft else 2.0
    suffix = '_normal_soft.png' if args.soft else '_normal.png'

    base_dir = os.path.join('public', 'models')
    
    # Extensions to look for
    valid_exts = {'.jpg', '.jpeg', '.png'}
    # Suffixes to ignore (files that are already maps of some sort)
    ignore_suffixes = {'_normal', '_metallic', '_roughness', '_specular', '_emissive', '_light', '_ao', '_height'}

    count = 0
    print(f"Scanning {base_dir} for textures...")
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            name, ext = os.path.splitext(file)
            if ext.lower() not in valid_exts:
                continue
            
            # Check ignores
            if any(name.endswith(s) for s in ignore_suffixes):
                continue
            
            # Check if it already looks like a generated file (sometimes people use different naming)
            if 'normal' in name.lower():
                continue

            input_path = os.path.join(root, file)
            output_path = os.path.join(root, name + suffix)

            if os.path.exists(output_path) and not args.force:
                # print(f"Skipping existing: {output_path}")
                continue
            
            generate_normal_map(input_path, output_path, strength, sigma)
            count += 1
            
    print(f"Finished. Generated {count} normal maps.")

if __name__ == '__main__':
    main()
