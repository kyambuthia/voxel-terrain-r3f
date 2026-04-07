import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
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

  varying vec2 vUv;

  void main() {
    float screenY = (1.0 - vUv.y) * uResolution.y;

    float sinA = sin(uAngle);
    float cosA = cos(uAngle);

    // Column offset scaled for ~70deg FOV
    float s = (vUv.x - 0.5) * 1.4;

    // Ray direction components (precompute)
    float rd_x = sinA + cosA * s;
    float rd_y = cosA - sinA * s;

    vec3 resultColor = vec3(0.0);
    bool hit = false;

    float z = 1.0;
    float dz = 1.0;
    float prevZ = 1.0;
    float prevProjY = uHorizon; // previous step's projected Y

    for (int i = 0; i < 180; i++) {
      if (z > uDistance) break;

      float wx = uPosition.x + z * rd_x;
      float wy = uPosition.y + z * rd_y;

      vec2 mapUV = fract(vec2(wx, wy) / uWorldSize);
      float terrainH = texture2D(uHeightMap, mapUV).r * 255.0;
      float projectedY = (uHeight - terrainH) / z * uScaleHeight + uHorizon;

      if (projectedY <= screenY) {
        // Interpolate between prev and current step for smoother silhouettes
        float t = 0.5;
        if (prevProjY > projectedY + 0.01) {
          t = clamp((screenY - projectedY) / (prevProjY - projectedY), 0.0, 1.0);
        }
        float hitZ = mix(z, prevZ, t);

        // Resample at interpolated position
        float hwx = uPosition.x + hitZ * rd_x;
        float hwy = uPosition.y + hitZ * rd_y;
        vec2 hitUV = fract(vec2(hwx, hwy) / uWorldSize);

        resultColor = texture2D(uColorMap, hitUV).rgb;

        // Slope shading
        float hBase = texture2D(uHeightMap, hitUV).r * 255.0;
        float hR = texture2D(uHeightMap, fract(vec2(hwx + 1.0, hwy) / uWorldSize)).r * 255.0;
        float hF = texture2D(uHeightMap, fract(vec2(hwx, hwy + 1.0) / uWorldSize)).r * 255.0;
        float shade = 0.85 + clamp((hBase - hR + hBase - hF) * 0.04, -0.2, 0.3);
        resultColor *= shade;

        // Distance fog
        float fogT = smoothstep(uDistance * 0.25, uDistance * 0.85, hitZ);
        resultColor = mix(resultColor, vec3(0.55, 0.75, 0.92), fogT);

        hit = true;
        break;
      }

      prevZ = z;
      prevProjY = projectedY;
      z += dz;
      dz += 0.1;
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
  const [, getKeys] = useKeyboardControls();

  const state = useRef({
    pos: new THREE.Vector2(512, 512),
    angle: 0,
    height: 150.0,
    speed: 0,
    rotSpeed: 0,
  });

  const [colorMap, heightMap] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const c = loader.load('/assets/colormap.png');
    const h = loader.load('/assets/heightmap.png');

    c.minFilter = THREE.LinearFilter;
    c.magFilter = THREE.LinearFilter;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;

    h.minFilter = THREE.LinearFilter;
    h.magFilter = THREE.LinearFilter;
    h.wrapS = h.wrapT = THREE.RepeatWrapping;
    h.colorSpace = THREE.NoColorSpace;

    return [c, h];
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.05);
    const keys = getKeys();

    const targetSpeed = (keys.forward ? 300 : 0) + (keys.backward ? -120 : 0);
    const targetRot = (keys.left ? -1.5 : 0) + (keys.right ? 1.5 : 0);
    state.current.speed = THREE.MathUtils.lerp(state.current.speed, targetSpeed, 0.08);
    state.current.rotSpeed = THREE.MathUtils.lerp(state.current.rotSpeed, targetRot, 0.12);

    if (keys.up) state.current.height += 80 * dt;
    if (keys.down) state.current.height -= 80 * dt;
    state.current.height = Math.max(80, Math.min(400, state.current.height));

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
          uPosition: { value: new THREE.Vector2(512, 512) },
          uAngle: { value: 0 },
          uHeight: { value: 150.0 },
          uHorizon: { value: 325.0 },
          uDistance: { value: 600.0 },
          uScaleHeight: { value: 80.0 },
          uWorldSize: { value: 1024.0 },
        }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default VoxelTerrain;
