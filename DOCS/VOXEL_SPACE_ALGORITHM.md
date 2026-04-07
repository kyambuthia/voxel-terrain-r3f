# Voxel Space Algorithm Documentation

## Overview

The Voxel Space algorithm is a 2.5D terrain rendering technique developed by NovaLogic for the 1992 game Comanche. It's a height-map based rendering engine that creates 3D terrain from 2D images.

## Core Concepts

### Data Structure

The algorithm uses two maps:
1. **Height Map (Altitude)** - Grayscale image where pixel brightness = terrain height (0-255)
2. **Color Map** - RGB image containing pre-baked colors, textures, shading, and shadows

Both maps are typically 1024x1024 pixels and wrap around (periodic).

### Camera Parameters

```javascript
{
  x: 512,        // X position on map
  y: 800,        // Y position on map
  height: 78,    // Camera height above terrain
  angle: 0,      // View direction (radians)
  horizon: 100,  // Screen Y position of horizon
  distance: 800  // Render distance
}
```

## Rendering Algorithm

### Step 1: Back-to-Front (Painter's Algorithm)
- Iterate from farthest to nearest (z = distance to 1)
- Guarantees occlusion - distant objects drawn first, closer ones overwrite

### Step 2: Project View Ray
For each z-distance, calculate the line on the map:
```
plx = -cos(angle)*z - sin(angle)*z + camera.x
ply =  sin(angle)*z - cos(angle)*z + camera.y
prx =  cos(angle)*z - sin(angle)*z + camera.x
pry = -sin(angle)*z - cos(angle)*z + camera.y
```

### Step 3: Rasterize Column
Divide the line into screen-width segments:
```
dx = (prx - plx) / screenWidth
dy = (pry - ply) / screenWidth
```

### Step 4: Calculate Screen Height
```
heightOnScreen = (camera.height - terrainHeight) * (scale / z) + horizon
```

### Step 5: Draw Vertical Line
Draw a vertical line from `heightOnScreen` to `hiddeny[i]` (previous visible height).

## Optimizations

### Front-to-Back Rendering with Y-Buffer
1. Initialize y-buffer with screen height
2. Draw from front to back
3. Only draw pixels above the y-buffer height
4. Update y-buffer when new geometry is closer

### Level of Detail (LOD)
- Increase z-step as distance grows: `deltaz += 0.005`
- Renders more detail in front, less in back

### Performance Notes
- Uses integer math and bitwise operations
- Pre-calculates trigonometric values (sin/cos of angle)
- Wraps coordinates using bitmask (map width must be power of 2)

## R3F Implementation Guide

### Required Data
1. Load height map as grayscale texture (R channel = height)
2. Load color map as RGB texture
3. Convert to TypedArrays (Uint8Array for height, Uint32Array for color)

### Shader Approach
For React Three Fiber, implement as:
1. **Vertex Shader**: Project terrain vertices based on height map
2. **Fragment Shader**: Sample color map for terrain texture
3. **Camera Controls**: WASD movement + mouse look

### Key Implementation Steps
1. Create plane geometry matching map resolution (1024x1024)
2. Displace vertices based on height map texture
3. Apply color map as vertex colors or texture
4. Implement camera with proper projection math

### Coordinate Transformation
```
World Position = Camera Position + Rotation Matrix * (x, y, z)
Screen Y = (CameraHeight - TerrainHeight) * ScaleFactor / Z + Horizon
```

## AI Image Generation Prompts

Use these prompts to generate height maps and color maps for the Voxel Space algorithm. These prompts are optimized for AI image generators like nano-banana.

### Height Map Prompts (Grayscale)

Generate height maps using ONLY grayscale values - white = high peaks, black = valleys/depressions.

**Mountain Terrain**
```
Height map terrain visualization, orthographic top-down view, dramatic mountain range with sharp jagged peaks and deep valleys, fractal Perlin noise terrain, dramatic elevation changes, high contrast peaks, pure grayscale gradient from black (low valleys) to white (high peaks), 1024x1024, digital terrain model, no textures no colors
```

**Rolling Hills**
```
Grayscale height map, orthographic bird's eye view, gentle rolling hills with smooth undulating terrain, low contrast elevation, fractal brownian motion, soft rolling curves, pure grayscale only, 1024x1024, topographic contour style
```

**Canyon/Valley**
```
Grayscale height map, orthographic top-down, dramatic V-shaped canyon with deep river valley, steep cliff walls, central river channel, high contrast edges between cliffs and valley floor, pure grayscale, 1024x1024
```

**Desert Dunes**
```
Grayscale height map, orthographic bird's eye, flowing sand dunes with ripple patterns, wave-like parallel ridges, soft granular texture, low angle sun shadows, pure grayscale, 1024x1024, seamless terrain
```

**Alpine/Mountain Peaks**
```
Grayscale height map, orthographic top-down, dramatic alpine mountain range with sharp rocky ridges and peaks, snow line variation, cirques and valleys, high contrast dramatic terrain, pure grayscale, 1024x1024
```

**Volcanic Terrain**
```
Grayscale height map, orthographic view, volcanic mountain with central crater caldera, radial lava channels flowing downslope, rough rocky texture, high contrast terrain, pure grayscale, 1024x1024
```

**Frozen Tundra**
```
Grayscale height map, orthographic bird's eye, frozen tundra with polygonal permafrost patterns, subtle ice ridges, very flat with minimal elevation, pure grayscale, 1024x1024
```

**Coastal/Island**
```
Grayscale height map, orthographic top-down, island with central volcanic mountain slopes down to coastal beaches, shallow gradient from center to edge, pure grayscale, 1024x1024, seamless
```

### Color Map Prompts (RGB)

Generate color maps in full RGB - these contain the terrain colors, textures, shading, and shadows baked in.

**Summer/Verdant**
```
Satellite imagery orthographic view, lush green summer countryside, rolling hills covered in vibrant grass, dense vegetation, forest patches, bright sunny lighting with warm shadows, no clouds, photorealistic natural colors, 1024x1024
```

**Autumn Forest**
```
Satellite orthographic view, vibrant autumn forest, canopy of orange amber crimson yellow brown leaves, mixed deciduous trees, rolling terrain, golden hour lighting, photorealistic, 1024x1024
```

**Desert/Arid**
```
Satellite orthographic view, vast arid desert landscape, tan and ochre sand, red rust colored rock formations, scattered sparse vegetation, warm golden sunlight, dramatic shadows, photorealistic, 1024x1024
```

**Winter/Snow**
```
Satellite orthographic view, snowy winter mountain range, pure white snow cover, blue-tinged shadows, frozen lakes, bare trees, cold winter lighting, high contrast white against dark shadows, photorealistic, 1024x1024
```

**Mars-like/Alien**
```
Satellite orthographic view, alien planetary surface like Mars, rust red orange terrain, dark volcanic craters, rocky barren surface, no vegetation, dramatic lighting, photorealistic alien landscape, 1024x1024
```

**Tropical/Lush**
```
Satellite orthographic view, tropical lush landscape, deep emerald green vegetation, turquoise coastal water, white sandy beaches, contrast between land sea, bright sunny lighting, photorealistic, 1024x1024
```

**Mediterranean**
```
Satellite orthographic view, Mediterranean landscape, olive tree groves, terracotta and golden earth, rocky arid slopes, warm sunlight, coastal areas, photorealistic, 1024x1024
```

**Arctic/Ice**
```
Satellite orthographic view, arctic tundra and ice sheet, white and pale blue ice, frozen lakes, minimal vegetation, cold stark lighting, high contrast ice and shadows, photorealistic, 1024x1024
```

### Recommended Height + Color Map Pairings

Generate both height and color maps using these paired prompts for consistent terrain:

| Pair | Height Map | Color Map |
|------|------------|-----------|
| **1** | Alpine/Mountain Peaks | Winter/Snow |
| **2** | Desert Dunes | Desert/Arid |
| **3** | Canyon/Valley | Desert/Arid |
| **4** | Coastal/Island | Tropical/Lush |
| **5** | Rolling Hills | Summer/Verdant |
| **6** | Rolling Hills | Autumn Forest |
| **7** | Volcanic Terrain | Mars-like/Alien |
| **8** | Frozen Tundra | Arctic/Ice |
| **9** | Mountain Terrain | Winter/Snow |
| **10** | Mountain Terrain | Mediterranean |

---

### Individual Prompt Copy-Paste

#### Pair 1: Alpine Winter
**Height:**
```
Grayscale height map, orthographic top-down, dramatic alpine mountain range with sharp rocky ridges and peaks, snow line variation, cirques and valleys, high contrast dramatic terrain, pure grayscale, 1024x1024
```
**Color:**
```
Satellite orthographic view, snowy winter mountain range, pure white snow cover, blue-tinged shadows, frozen lakes, bare trees, cold winter lighting, high contrast white against dark shadows, photorealistic, 1024x1024
```

#### Pair 2: Desert Dunes
**Height:**
```
Grayscale height map, orthographic bird's eye, flowing sand dunes with ripple patterns, wave-like parallel ridges, soft granular texture, low angle sun shadows, pure grayscale, 1024x1024, seamless terrain
```
**Color:**
```
Satellite orthographic view, vast arid desert landscape, tan and ochre sand, red rust colored rock formations, scattered sparse vegetation, warm golden sunlight, dramatic shadows, photorealistic, 1024x1024
```

#### Pair 3: Canyon Valley
**Height:**
```
Grayscale height map, orthographic top-down, dramatic V-shaped canyon with deep river valley, steep cliff walls, central river channel, high contrast edges between cliffs and valley floor, pure grayscale, 1024x1024
```
**Color:**
```
Satellite orthographic view, vast arid desert landscape, tan and ochre sand, red rust colored rock formations, scattered sparse vegetation, warm golden sunlight, dramatic shadows, photorealistic, 1024x1024
```

#### Pair 4: Tropical Island
**Height:**
```
Grayscale height map, orthographic top-down, island with central volcanic mountain slopes down to coastal beaches, shallow gradient from center to edge, pure grayscale, 1024x1024, seamless
```
**Color:**
```
Satellite orthographic view, tropical lush landscape, deep emerald green vegetation, turquoise coastal water, white sandy beaches, contrast between land sea, bright sunny lighting, photorealistic, 1024x1024
```

#### Pair 5: Green Hills
**Height:**
```
Grayscale height map, orthographic bird's eye view, gentle rolling hills with smooth undulating terrain, low contrast elevation, fractal brownian motion, soft rolling curves, pure grayscale only, 1024x1024, topographic contour style
```
**Color:**
```
Satellite imagery orthographic view, lush green summer countryside, rolling hills covered in vibrant grass, dense vegetation, forest patches, bright sunny lighting with warm shadows, no clouds, photorealistic natural colors, 1024x1024
```

#### Pair 6: Autumn Forest
**Height:**
```
Grayscale height map, orthographic bird's eye view, gentle rolling hills with smooth undulating terrain, low contrast elevation, fractal brownian motion, soft rolling curves, pure grayscale only, 1024x1024, topographic contour style
```
**Color:**
```
Satellite orthographic view, vibrant autumn forest, canopy of orange amber crimson yellow brown leaves, mixed deciduous trees, rolling terrain, golden hour lighting, photorealistic, 1024x1024
```

#### Pair 7: Volcanic Mars
**Height:**
```
Grayscale height map, orthographic view, volcanic mountain with central crater caldera, radial lava channels flowing downslope, rough rocky texture, high contrast terrain, pure grayscale, 1024x1024
```
**Color:**
```
Satellite orthographic view, alien planetary surface like Mars, rust red orange terrain, dark volcanic craters, rocky barren surface, no vegetation, dramatic lighting, photorealistic alien landscape, 1024x1024
```

#### Pair 8: Arctic Tundra
**Height:**
```
Grayscale height map, orthographic bird's eye, frozen tundra with polygonal permafrost patterns, subtle ice ridges, very flat with minimal elevation, pure grayscale, 1024x1024
```
**Color:**
```
Satellite orthographic view, arctic tundra and ice sheet, white and pale blue ice, frozen lakes, minimal vegetation, cold stark lighting, high contrast ice and shadows, photorealistic, 1024x1024
```

---

### Nano-Banana Combined Prompts (Height + Color in One)

Use these single prompts to generate both the height map (grayscale) and color map (RGB) for each terrain pair:

#### Alpine Winter
```
Generate 2 images side by side, 1024x1024 each, orthographic top-down view.
First image: grayscale height map terrain visualization, dramatic alpine mountain range with sharp rocky ridges and peaks, cirques and valleys, high contrast peaks white valleys black, pure grayscale digital terrain model, no colors.
Second image: same exact terrain as satellite view, snowy winter mountain range, pure white snow cover, blue-tinged shadows, frozen lakes, bare trees, cold winter lighting, photorealistic natural colors.
```
**Variations:** `--ar 1:1 --v 6`

#### Desert Dunes
```
Generate 2 images side by side, 1024x1024 each, orthographic bird's eye view.
First image: grayscale height map, flowing sand dunes with ripple patterns, wave-like parallel ridges, soft granular texture, low angle shadows, pure grayscale terrain, seamless.
Second image: same exact terrain as satellite view, vast arid desert landscape, tan and ochre sand, red rust colored rock formations, warm golden sunlight, dramatic shadows, photorealistic.
```
**Variations:** `--ar 1:1 --v 6`

#### Canyon Valley
```
Generate 2 images side by side, 1024x1024 each, orthographic top-down view.
First image: grayscale height map, dramatic V-shaped canyon with deep river valley, steep cliff walls, central river channel, high contrast edges between cliffs and valley floor, pure grayscale.
Second image: same exact terrain as satellite view, tan and ochre sand, red rust colored canyon walls, warm golden sunlight, dramatic shadows, photorealistic desert canyon.
```
**Variations:** `--ar 1:1 --v 6`

#### Tropical Island
```
Generate 2 images side by side, 1024x1024 each, orthographic top-down view.
First image: grayscale height map, island with central volcanic mountain slopes down to coastal beaches, shallow gradient from center to edge, pure grayscale terrain, seamless.
Second image: same exact terrain as satellite view, deep emerald green vegetation, turquoise coastal water, white sandy beaches, contrast between land and sea, bright sunny lighting, photorealistic.
```
**Variations:** `--ar 1:1 --v 6`

#### Green Hills
```
Generate 2 images side by side, 1024x1024 each, orthographic bird's eye view.
First image: grayscale height map, gentle rolling hills with smooth undulating terrain, low contrast elevation, soft rolling curves, pure grayscale, topographic contour style.
Second image: same exact terrain as satellite view, lush green summer countryside, rolling hills covered in vibrant grass, dense vegetation, forest patches, bright sunny lighting with warm shadows, photorealistic.
```
**Variations:** `--ar 1:1 --v 6`

#### Autumn Forest
```
Generate 2 images side by side, 1024x1024 each, orthographic bird's eye view.
First image: grayscale height map, gentle rolling hills with smooth undulating terrain, low contrast elevation, soft rolling curves, pure grayscale terrain.
Second image: same exact terrain as satellite view, vibrant autumn forest, canopy of orange amber crimson yellow brown leaves, mixed deciduous trees, golden hour lighting, photorealistic.
```
**Variations:** `--ar 1:1 --v 6`

#### Volcanic Mars
```
Generate 2 images side by side, 1024x1024 each, orthographic view.
First image: grayscale height map, volcanic mountain with central crater caldera, radial lava channels flowing downslope, rough rocky texture, high contrast terrain, pure grayscale.
Second image: same exact terrain as satellite view, alien planetary surface like Mars, rust red orange terrain, dark volcanic craters, rocky barren surface, no vegetation, dramatic lighting, photorealistic alien landscape.
```
**Variations:** `--ar 1:1 --v 6`

#### Arctic Tundra
```
Generate 2 images side by side, 1024x1024 each, orthographic bird's eye view.
First image: grayscale height map, frozen tundra with polygonal permafrost patterns, subtle ice ridges, very flat with minimal elevation, pure grayscale terrain.
Second image: same exact terrain as satellite view, arctic tundra and ice sheet, white and pale blue ice, frozen lakes, minimal vegetation, cold stark lighting, high contrast ice and shadows, photorealistic.
```
**Variations:** `--ar 1:1 --v 6`

## Reference Links

- Original implementation: `VoxelSpace/VoxelSpace.html`
- Maps directory: `VoxelSpace/maps/`
- Wikipedia: https://en.wikipedia.org/wiki/Voxel_Space
