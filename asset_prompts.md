# Voxel Space AI Asset Generation Guide

To power the Voxel Space engine, you need two matching textures: **Color** and **Height**.

## 1. The Color Map 🌎
This provides the landscape's visual appearance.

**Recommended Prompt:**
> "Satellite-view photograph of a rugged Alpine mountain landscape, deep forest valleys, crystal clear turquoise lakes, and snow-capped peaks. Top-down orthographic perspective. Photorealistic, intricate textures, high-quality topographical details. Lighting: Noon sun (minimize long shadows for consistent engine shading). Resolution: 1024x1024, seamless tiling."

---

## 2. The Height Map (Depth) 🏔️
This defines the 3D elevation. White is high (mountain), Black is low (valley/water).

**Recommended Prompt:**
> "Top-down topographic altitude map of a mountain range, matching the layout of a satellite landscape. Clean grayscale displacement map, high detail. Sharp white ridges, dark gray valleys, black basins for water levels. Smooth geometric transitions. 1024x1024, seamless tiling, high precision 8-bit or 16-bit grayscale."

---

### Pro-Tip for Seamless Worlds:
If you are using tools like Midjourney or Stable Diffusion, append `--tile` or use the "Tiling" checkbox to ensure the camera can scroll infinitely without seams.
