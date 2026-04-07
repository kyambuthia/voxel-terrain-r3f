import React, { useRef, useMemo } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Classic Voxel Space Renderer (Comanche-style)
 * 
 * The algorithm works column-by-column:
 *   For each screen column, cast a ray from camera into the world.
 *   March along the ray from near to far, sampling the heightmap.
 *   Project each terrain height onto the screen.
 *   Only draw pixels that are ABOVE the highest pixel drawn so far in that column.
 * 
 * In a fragment shader we can't do column-tracking, so we use a per-pixel approach:
 *   For each pixel, march a ray and find the FIRST terrain sample whose projected
 *   screen-Y is above the pixel's Y coordinate.
 * 
 * Key to avoiding GPU crash: use moderate iteration count with aggressive step growth.
 */

const VoxelShader = {
  uniforms: {
    uHeightMap: { value: null },
    uColorMap: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uPosition: { value: new THREE.Vector2(512, 512) },
    uAngle: { value: 0 },
    uHeight: { value: 150.0 },
    uHorizon: { value: 120.0 },
    uDistance: { value: 800.0 },
    uScaleHeight: { value: 240.0 },
    uWorldSize: { value: 1024.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision mediump float;

    uniform sampler2D uHeightMap;
    uniform sampler2D uColorMap;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uPosition;
    uniform float uAngle;
    uniform float uHeight;
    uniform float uHorizon;    // pixel offset from bottom for horizon
    uniform float uDistance;
    uniform float uScaleHeight;
    uniform float uWorldSize;

    varying vec2 vUv;

    void main() {
      // Screen pixel coordinates
      float screenX = vUv.x * uResolution.x;
      float screenY = (1.0 - vUv.y) * uResolution.y; // flip Y: 0=top, resY=bottom

      // Sky gradient (for pixels above horizon)
      vec3 skyColorLow  = vec3(0.55, 0.75, 1.0);
      vec3 skyColorHigh = vec3(0.10, 0.15, 0.45);
      vec3 fogColor     = vec3(0.60, 0.78, 0.95);

      // Camera direction vectors
      float sinphi = sin(uAngle);
      float cosphi = cos(uAngle);

      // Ray direction for this column
      // Map screen X to a horizontal offset: [-1, 1] range
      float dx = (screenX / uResolution.x - 0.5);

      // Rotated ray direction
      float ray_dx = cosphi * dx - sinphi;
      float ray_dy = sinphi * dx + cosphi;

      // March from near to far
      float dz = 1.0;
      float z  = 1.0;

      // Track the highest drawn point for this column (in screen space)
      // Start from the bottom of the screen
      float maxScreenY = uResolution.y;

      vec3 resultColor = vec3(0.0);
      bool hitTerrain = false;

      for (int i = 0; i < 200; i++) {
        // World position on the map
        vec2 worldPos = uPosition + vec2(ray_dx * z, ray_dy * z);

        // Wrap to map bounds
        vec2 mapUV = fract(worldPos / uWorldSize);

        // Sample height and color
        float terrainH = texture2D(uHeightMap, mapUV).r * 255.0;
        
        // Project terrain height to screen Y
        // Higher terrain -> lower screenY (closer to top)
        float projectedY = (uHeight - terrainH) * (uScaleHeight / z) + uHorizon;

        // If this terrain point projects above the current pixel's Y
        if (projectedY <= screenY && projectedY < maxScreenY) {
          // This pixel is covered by terrain at this distance
          if (screenY < maxScreenY) {
            resultColor = texture2D(uColorMap, mapUV).rgb;

            // Simple slope shading
            vec2 offset = vec2(1.0 / uWorldSize, 0.0);
            float hR = texture2D(uHeightMap, mapUV + offset).r * 255.0;
            float hU = texture2D(uHeightMap, mapUV + offset.yx).r * 255.0;
            float shade = 0.85 + clamp((terrainH - hR + terrainH - hU) * 0.04, -0.15, 0.25);
            resultColor *= shade;

            // Distance fog
            float fogFactor = smoothstep(uDistance * 0.3, uDistance, z);
            resultColor = mix(resultColor, fogColor, fogFactor);

            hitTerrain = true;
            break; // Found the terrain for this pixel
          }
        }

        // Update the occlusion tracker
        if (projectedY < maxScreenY) {
          maxScreenY = projectedY;
        }

        // Adaptive step: small near camera, grows with distance
        z += dz;
        dz += 0.015 * z;

        if (z > uDistance) break;
      }

      if (!hitTerrain) {
        // Sky
        float skyT = clamp((uHorizon - screenY) / uResolution.y * 2.0, 0.0, 1.0);
        resultColor = mix(fogColor, skyColorHigh, skyT);
      }

      gl_FragColor = vec4(resultColor, 1.0);
    }
  `
};

const VoxelTerrain = () => {
  const meshRef = useRef();
  const { size } = useThree();
  const [, getKeys] = useKeyboardControls();

  const state = useRef({
    pos: new THREE.Vector2(512, 512),
    angle: 0,
    height: 180.0,
    speed: 0,
    rotSpeed: 0,
  });

  const [colorMap, heightMap] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const c = loader.load('/assets/colormap.png');
    const h = loader.load('/assets/heightmap.png');

    for (const tex of [c, h]) {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
    return [c, h];
  }, []);

  useFrame((stateObj, delta) => {
    if (!meshRef.current) return;

    const keys = getKeys();
    const dt = Math.min(delta, 0.05); // clamp delta to avoid spiral

    // Movement
    const targetSpeed = (keys.forward ? 300 : 0) + (keys.backward ? -120 : 0);
    const targetRot = (keys.left ? 1.5 : 0) + (keys.right ? -1.5 : 0);

    state.current.speed = THREE.MathUtils.lerp(state.current.speed, targetSpeed, 0.08);
    state.current.rotSpeed = THREE.MathUtils.lerp(state.current.rotSpeed, targetRot, 0.12);

    // Altitude
    if (keys.up) state.current.height += 100 * dt;
    if (keys.down) state.current.height -= 100 * dt;
    state.current.height = Math.max(40, Math.min(600, state.current.height));

    // Update position
    state.current.angle += state.current.rotSpeed * dt;
    state.current.pos.x += Math.sin(state.current.angle) * state.current.speed * dt;
    state.current.pos.y += Math.cos(state.current.angle) * state.current.speed * dt;

    // Push to shader
    const u = meshRef.current.material.uniforms;
    u.uTime.value = stateObj.clock.elapsedTime;
    u.uAngle.value = state.current.angle;
    u.uPosition.value.copy(state.current.pos);
    u.uHeight.value = state.current.height;
    u.uResolution.value.set(size.width, size.height);
    u.uHorizon.value = size.height * 0.4; // Horizon at 40% from top
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        {...VoxelShader}
        uniforms-uColorMap-value={colorMap}
        uniforms-uHeightMap-value={heightMap}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default VoxelTerrain;
