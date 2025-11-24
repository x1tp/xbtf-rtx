import os
import numpy as np
from PIL import Image
from scipy.ndimage import sobel, gaussian_filter

def generate_soft_normal(input_path, output_path, strength=4.0):
    img = Image.open(input_path).convert('RGB')
    arr = np.array(img) / 255.0
    height = np.mean(arr, axis=2)
    hp = height - gaussian_filter(height, sigma=1.5)
    dx = sobel(hp, axis=0) * strength
    dy = sobel(hp, axis=1) * strength
    dz = np.ones_like(height)
    magnitude = np.sqrt(dx**2 + dy**2 + dz**2)
    normal = np.dstack((-dy, -dx, dz)) / magnitude[..., None]
    normal = (normal * 0.5 + 0.5) * 255
    Image.fromarray(normal.astype(np.uint8)).save(output_path)

def main():
    base_dir = os.path.join('public', 'models')
    pairs = [
        ('tex/23.jpg', 'tex/23_normal_soft.png'),
        ('tex/33.jpg', 'tex/33_normal_soft.png'),
        ('tex/39.jpg', 'tex/39_normal_soft.png'),
        ('tex/40.jpg', 'tex/40_normal_soft.png'),
        ('tex/176.jpg', 'tex/176_normal_soft.png'),
        ('tex/43.jpg', 'tex/43_normal_soft.png'),
        ('true/28.jpg', 'true/28_normal_soft.png'),
        ('true/37.jpg', 'true/37_normal_soft.png'),
        ('true/24.jpg', 'true/24_normal_soft.png'),
    ]
    for inp, out in pairs:
        in_path = os.path.join(base_dir, inp)
        out_path = os.path.join(base_dir, out)
        if not os.path.exists(in_path):
            continue
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        generate_soft_normal(in_path, out_path)

if __name__ == '__main__':
    main()
