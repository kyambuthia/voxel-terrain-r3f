import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

/*
 * Classic Voxel Space (Comanche-style) fragment shader.
 *
 * Per-pixel algorithm: for each pixel at (screenX, screenY), march a ray
 * from near to far along the camera's view direction for that column.
 * The first terrain sample whose projected screen-Y is above (<=) the
 * pixel's screenY is the visible terrain.
 *
 * Key fix: forward direction = (sin(angle), cos(angle)) matches JS movement.
 */

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG = `
  precision highp float;

  uniform sampler2D uHeightMap;
  uniform sampler2D uColorMap;
  uniform vec2 uResolution;
  uniform vec2 uPosition;
  uniform float uAngle;
  uniform float uHeight;
  uniform float uHorizon;
  uniform float uDistance;
  uniform float uScaleHeight;
  uniform float uWorldSize;

  varying vec2 vUv;

  void main() {
    // Screen pixel coords: Y=0 at top, Y=resY at bottom
    float screenX = vUv.x * uResolution.x;
    float screenY = (1.0 - vUv.y) * uResolution.y;

    float sinA = sin(uAngle);
    float cosA = cos(uAngle);

    // Column offset: -1..1 across screen width (90 deg FOV)
    float s = (vUv.x - 0.5) * 2.0;

    // Forward = (sinA, cosA), Right = (cosA, -sinA)
    // Ray dir = forward + s * right
    //         = (sinA + cosA*s, cosA - sinA*s)

    vec3 resultColor = vec3(0.0);
    bool hit = false;

    float z = 10.0;
    float dz = 1.0;

    for (int i = 0; i < 180; i++) {
      if (z > uDistance) break;

      // World sample position
      float wx = uPosition.x + z * (sinA + cosA * s);
      float wy = uPosition.y + z * (cosA - sinA * s);

      vec2 mapUV = fract(vec2(wx, wy) / uWorldSize);
      float terrainH = texture2D(uHeightMap, mapUV).r * 255.0;

      // Project to screen Y (higher terrain → lower screenY → higher on screen)
      float projectedY = (uHeight - terrainH) / z * uScaleHeight + uHorizon;

      if (projectedY <= screenY) {
        resultColor = texture2D(uColorMap, mapUV).rgb;

        // Slope shading via neighbor height differences
        float hR = texture2D(uHeightMap, fract(vec2(wx + 1.0, wy) / uWorldSize)).r * 255.0;
        float hF = texture2D(uHeightMap, fract(vec2(wx, wy + 1.0) / uWorldSize)).r * 255.0;
        float shade = 0.85 + clamp((terrainH - hR + terrainH - hF) * 0.04, -0.15, 0.3);
        resultColor *= shade;

        // Distance fog
        float fogT = smoothstep(uDistance * 0.3, uDistance * 0.9, z);
        resultColor = mix(resultColor, vec3(0.6, 0.78, 0.95), fogT);

        hit = true;
        break;
      }

      z += dz;
      dz += 0.15;  // Linear step growth (reference algorithm)
    }

    if (!hit) {
      // Sky gradient
      float skyT = clamp((uHorizon - screenY) / (uResolution.y * 0.5), 0.0, 1.0);
      resultColor = mix(vec3(0.6, 0.78, 0.95), vec3(0.12, 0.2, 0.55), skyT);
    }

    gl_FragColor = vec4(resultColor, 1.0);
  }
`;

const VoxelTerrain = () => {
  const meshRef = useRef();
  const { size } = useThree();
  const [, getKeys] = useKeyboardControls();

  const state = useRef({
    pos: new THREE.Vector2(512, 512),
    angle: 0,
    height: 350.0,
    speed: 0,
    rotSpeed: 0,
  });

  const [colorMap, heightMap] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const c = loader.load('/assets/colormap.png');
    const h = loader.load('/assets/heightmap.png');

    // Colormap: keep sRGB for correct visual colors
    c.minFilter = THREE.LinearFilter;
    c.magFilter = THREE.LinearFilter;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;

    // Heightmap: MUST be linear (no sRGB gamma) for correct height values
    h.minFilter = THREE.LinearFilter;
    h.magFilter = THREE.LinearFilter;
    h.wrapS = h.wrapT = THREE.RepeatWrapping;
    h.colorSpace = THREE.NoColorSpace;

    return [c, h];
  }, []);

  useFrame((stateObj, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);
    const keys = getKeys();

    // Smooth movement
    const targetSpeed = (keys.forward ? 300 : 0) + (keys.backward ? -120 : 0);
    const targetRot = (keys.left ? 1.5 : 0) + (keys.right ? -1.5 : 0);

    state.current.speed = THREE.MathUtils.lerp(state.current.speed, targetSpeed, 0.08);
    state.current.rotSpeed = THREE.MathUtils.lerp(state.current.rotSpeed, targetRot, 0.12);

    // Altitude
    if (keys.up) state.current.height += 100 * dt;
    if (keys.down) state.current.height -= 100 * dt;
    state.current.height = Math.max(80, Math.min(800, state.current.height));

    // Position update: forward = (sin(angle), cos(angle))
    state.current.angle += state.current.rotSpeed * dt;
    state.current.pos.x += Math.sin(state.current.angle) * state.current.speed * dt;
    state.current.pos.y += Math.cos(state.current.angle) * state.current.speed * dt;

    // Update uniforms
    const u = meshRef.current.material.uniforms;
    u.uAngle.value = state.current.angle;
    u.uPosition.value.copy(state.current.pos);
    u.uHeight.value = state.current.height;
    u.uResolution.value.set(size.width, size.height);
    u.uHorizon.value = size.height * 0.4;
    u.uScaleHeight.value = size.height * 0.18;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uHeightMap: { value: heightMap },
          uColorMap: { value: colorMap },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uPosition: { value: new THREE.Vector2(512, 512) },
          uAngle: { value: 0 },
          uHeight: { value: 350.0 },
          uHorizon: { value: 260.0 },
          uDistance: { value: 800.0 },
          uScaleHeight: { value: 120.0 },
          uWorldSize: { value: 1024.0 },
        }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default VoxelTerrain;
