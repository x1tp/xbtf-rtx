param(
  [string]$OutPath = "assets/cloud_alpha.png",
  [int]$Size = 1024,
  [int]$Octaves = 6,
  [double]$Scale = 3.0,
  [double]$Warp = 0.75,
  [double]$Persistence = 0.5,
  [double]$Lacunarity = 2.0,
  [double]$Coverage = 0.5,
  [double]$Contrast = 1.5,
  [double]$Edge = 0.85,
  [double]$CenterBoost = 0.3,
  [double]$CenterFeather = 0.8,
  [int]$Value = 180,
    [switch]$Grayscale,
    [switch]$Install,
    [int]$Seed = 0
)

if ($Seed -eq 0) { $Seed = [int](Get-Random) }

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public class CloudGen {
    int[] perm;
    Random rng;
    public CloudGen(int seed) {
        rng = new Random(seed);
        perm = new int[512];
        int[] p = new int[256];
        for (int i=0;i<256;i++) p[i]=i;
        for (int i=255;i>=0;i--) { int j=rng.Next(i+1); int t=p[i]; p[i]=p[j]; p[j]=t; }
        for (int i=0;i<512;i++) perm[i]=p[i&255];
    }
    double fade(double t){ return t*t*t*(t*(t*6-15)+10); }
    double lerp(double a,double b,double t){ return a + t*(b-a); }
    double grad(int h,double x,double y){ switch(h&3){ case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } }
    double perlin(double x,double y){
        int xi = (int)Math.Floor(x) & 255;
        int yi = (int)Math.Floor(y) & 255;
        double xf = x - Math.Floor(x);
        double yf = y - Math.Floor(y);
        int aa = perm[perm[xi] + yi];
        int ab = perm[perm[xi] + yi + 1];
        int ba = perm[perm[xi + 1] + yi];
        int bb = perm[perm[xi + 1] + yi + 1];
        double u = fade(xf);
        double v = fade(yf);
        double x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
        double x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
        return lerp(x1, x2, v);
    }
    double fbm(double x,double y,int octaves,double scale,double persistence,double lacunarity){
        double amp=1.0;
        double freq=1.0;
        double sum=0.0;
        double max=0.0;
        for(int i=0;i<octaves;i++){
            sum += amp * perlin(x*freq*scale, y*freq*scale);
            max += amp;
            amp *= persistence;
            freq *= lacunarity;
        }
        return sum/max*0.5+0.5;
    }
    double warp(double x,double y,double warpAmt,int octaves,double scale,double persistence,double lacunarity){
        double w1 = perlin(x*scale*0.5, y*scale*0.5);
        double w2 = perlin((x+5.2)*scale*0.5, (y+1.3)*scale*0.5);
        return fbm(x + warpAmt*w1, y + warpAmt*w2, octaves, scale, persistence, lacunarity);
    }
    public Bitmap Generate(int size,int octaves,double scale,double warpAmt,double persistence,double lacunarity,double coverage,double contrast,double edge,double centerBoost,double centerFeather,int value,bool grayscale){
        Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        for(int y=0;y<size;y++){
            for(int x=0;x<size;x++){
                double nx = (double)x/size;
                double ny = (double)y/size;
                double n = warp(nx, ny, warpAmt, octaves, scale, persistence, lacunarity);
                double a = Math.Max(0.0, n - coverage);
                a = Math.Pow(a*contrast, edge);
                double dx = nx - 0.5; double dy = ny - 0.5; double r = Math.Sqrt(dx*dx + dy*dy) * 2.0; if (r>1.0) r=1.0; double centerW = Math.Pow(1.0 - r, centerFeather);
                a = Math.Min(1.0, a + centerBoost * centerW);
                if (a>1.0) a=1.0;
                int alpha = (int)(a*255.0);
                int v = (int)(value * (alpha/255.0));
                if (v<0) v=0; if (v>255) v=255;
                bmp.SetPixel(x,y, grayscale ? Color.FromArgb(alpha, v, v, v) : Color.FromArgb(alpha, 0,0,0));
            }
        }
        return bmp;
    }
}
"@

$gen = New-Object CloudGen $Seed
$bmp = $gen.Generate($Size,$Octaves,$Scale,$Warp,$Persistence,$Lacunarity,$Coverage,$Contrast,$Edge,$CenterBoost,$CenterFeather,$Value,$Grayscale.IsPresent)
$dir = Split-Path $OutPath -Parent
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Generated: $OutPath"

if ($Install) {
    $targets = @(
        "public/materials/planet_earth/cloudsAlpha.png",
        "public/materials/planet_seizewell/cloudsAlpha.png"
    )
    foreach ($t in $targets) {
        $dest = Join-Path (Split-Path $OutPath -Parent | Split-Path -Parent) $t
        if (Test-Path (Split-Path $dest -Parent)) {
            Copy-Item -Path $OutPath -Destination $dest -Force
            Write-Host "Installed to: $dest"
        }
    }
}


