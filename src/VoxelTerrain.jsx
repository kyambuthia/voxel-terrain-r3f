import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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
  uniform float uHeightScale;

  varying vec2 vUv;

  vec2 mapUv(vec2 worldPos) {
    return fract(worldPos / uWorldSize);
  }

  float sampleHeightRaw(vec2 worldPos) {
    return texture2D(uHeightMap, mapUv(worldPos)).r * uHeightScale;
  }

  float sampleHeight(vec2 worldPos) {
    float center = sampleHeightRaw(worldPos) * 4.0;
    float cardinals =
      sampleHeightRaw(worldPos + vec2(1.0, 0.0)) * 2.0 +
      sampleHeightRaw(worldPos + vec2(-1.0, 0.0)) * 2.0 +
      sampleHeightRaw(worldPos + vec2(0.0, 1.0)) * 2.0 +
      sampleHeightRaw(worldPos + vec2(0.0, -1.0)) * 2.0;
    float diagonals =
      sampleHeightRaw(worldPos + vec2(1.0, 1.0)) +
      sampleHeightRaw(worldPos + vec2(-1.0, 1.0)) +
      sampleHeightRaw(worldPos + vec2(1.0, -1.0)) +
      sampleHeightRaw(worldPos + vec2(-1.0, -1.0));
    return (center + cardinals + diagonals) / 16.0;
  }

  vec3 sampleColorRaw(vec2 worldPos) {
    return texture2D(uColorMap, mapUv(worldPos)).rgb;
  }

  vec3 sampleColorMip(vec2 worldPos, float z) {
    float lod = clamp(log2(max(1.0, z) * 0.008), 0.0, 4.0);
    return texture2DLodEXT(uColorMap, mapUv(worldPos), lod).rgb;
  }

  vec3 sampleColor(vec2 worldPos, float z) {
    float blend = smoothstep(180.0, uDistance * 0.75, z);
    return mix(sampleColorRaw(worldPos), sampleColorMip(worldPos, z), blend);
  }

  // Project terrain height at distance z onto screen Y
  float projectY(float terrainH, float z) {
    return (uHeight - terrainH) / z * uScaleHeight + uHorizon;
  }

  void main() {
    float screenY = (1.0 - vUv.y) * uResolution.y;

    float sinA = sin(uAngle);
    float cosA = cos(uAngle);

    // Column offset scaled for ~70deg FOV
    float s = (vUv.x - 0.5) * 1.4;

    // Ray direction components
    float rd_x = sinA + cosA * s;
    float rd_y = cosA - sinA * s;

    vec3 resultColor = vec3(0.0);
    bool hit = false;

    float z = 1.0;
    float dz = 1.0;
    float prevZ = 0.5;

    for (int i = 0; i < 200; i++) {
      if (z > uDistance) break;

      vec2 wp = uPosition + z * vec2(rd_x, rd_y);
      float terrainH = sampleHeight(wp);
      float projectedY = projectY(terrainH, z);

      if (projectedY <= screenY) {
        // Binary search refinement: precisely locate terrain-sky boundary
        float lo = prevZ;
        float hi = z;
        for (int j = 0; j < 5; j++) {
          float mid = (lo + hi) * 0.5;
          vec2 mwp = uPosition + mid * vec2(rd_x, rd_y);
          float mH = sampleHeight(mwp);
          float mProjY = projectY(mH, mid);
          if (mProjY <= screenY) {
            hi = mid;
          } else {
            lo = mid;
          }
        }

        float hitZ = hi;
        vec2 hitWP = uPosition + hitZ * vec2(rd_x, rd_y);

        resultColor = sampleColor(hitWP, hitZ);

        // Slope shading
        float hBase = sampleHeight(hitWP);
        float hR = sampleHeight(hitWP + vec2(2.0, 0.0));
        float hF = sampleHeight(hitWP + vec2(0.0, 2.0));
        float shade = 0.85 + clamp((hBase - hR + hBase - hF) * 0.03, -0.15, 0.25);
        resultColor *= shade;

        // Distance fog
        float fogT = smoothstep(uDistance * 0.3, uDistance * 0.9, hitZ);
        resultColor = mix(resultColor, vec3(0.55, 0.75, 0.92), fogT);

        hit = true;
        break;
      }

      prevZ = z;
      z += dz;
      dz += 0.05;
    }

    if (!hit) {
      float skyT = clamp((uHorizon - screenY) / (uResolution.y * 0.6), 0.0, 1.0);
      resultColor = mix(vec3(0.55, 0.75, 0.92), vec3(0.08, 0.15, 0.45), skyT);
    }

    gl_FragColor = vec4(resultColor, 1.0);
  }
`;

const VoxelTerrain = () => {
  const meshRef = useRef();
  const { size } = useThree();
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const state = useRef({
    pos: new THREE.Vector2(512, 800),
    angle: 0,
    height: 300.0,
    speed: 0,
    rotSpeed: 0,
  });

  const [colorMap, heightMap] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const c = loader.load('/assets/colormap.png');
    const h = loader.load('/assets/heightmap.png');

    // Trilinear mipmapping: pre-averages the texture at multiple
    // resolutions so LOD-biased sampling in the shader returns
    // smooth, stable height values instead of raw noisy texels.
    c.minFilter = THREE.LinearMipmapLinearFilter;
    c.magFilter = THREE.LinearFilter;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.generateMipmaps = true;

    h.minFilter = THREE.LinearMipmapLinearFilter;
    h.magFilter = THREE.LinearFilter;
    h.wrapS = h.wrapT = THREE.RepeatWrapping;
    h.colorSpace = THREE.NoColorSpace;
    h.generateMipmaps = true;

    return [c, h];
  }, []);

  useEffect(() => {
    const keyMap = {
      ArrowUp: 'forward',
      KeyW: 'forward',
      ArrowDown: 'backward',
      KeyS: 'backward',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      KeyQ: 'up',
      KeyE: 'down',
    };

    const setKeyState = (event, pressed) => {
      const action = keyMap[event.code];
      if (!action) return;
      keysRef.current[action] = pressed;
    };

    const handleKeyDown = (event) => setKeyState(event, true);
    const handleKeyUp = (event) => setKeyState(event, false);
    const resetKeys = () => {
      Object.keys(keysRef.current).forEach((key) => {
        keysRef.current[key] = false;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', resetKeys);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', resetKeys);
    };
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;

    const targetSpeed = (keys.forward ? 300 : 0) + (keys.backward ? -120 : 0);
    const targetRot = (keys.left ? -1.5 : 0) + (keys.right ? 1.5 : 0);
    state.current.speed = THREE.MathUtils.lerp(state.current.speed, targetSpeed, 0.08);
    state.current.rotSpeed = THREE.MathUtils.lerp(state.current.rotSpeed, targetRot, 0.12);

    if (keys.up) state.current.height += 120 * dt;
    if (keys.down) state.current.height -= 120 * dt;
    state.current.height = Math.max(120, Math.min(720, state.current.height));

    state.current.angle += state.current.rotSpeed * dt;
    state.current.pos.x += Math.sin(state.current.angle) * state.current.speed * dt;
    state.current.pos.y += Math.cos(state.current.angle) * state.current.speed * dt;

    const u = meshRef.current.material.uniforms;
    u.uAngle.value = state.current.angle;
    u.uPosition.value.copy(state.current.pos);
    u.uHeight.value = state.current.height;
    u.uResolution.value.set(size.width, size.height);
    u.uHorizon.value = size.height * 0.5;
    u.uScaleHeight.value = size.height * 0.12;
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
          uPosition: { value: new THREE.Vector2(512, 800) },
          uAngle: { value: 0 },
          uHeight: { value: 300.0 },
          uHorizon: { value: 325.0 },
          uDistance: { value: 800.0 },
          uScaleHeight: { value: 80.0 },
          uWorldSize: { value: 1024.0 },
          uHeightScale: { value: 220.0 },
        }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default VoxelTerrain;
