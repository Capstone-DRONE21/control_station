import { Component, Suspense, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, useGLTF } from "@react-three/drei";
import { BackSide, Box3, CatmullRomCurve3, Color, Float32BufferAttribute, Group, SphereGeometry, Vector3 } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

import FarmEnvironment from "./FarmEnvironment";

const MODEL_PATH = "/models/drone.glb";
const DRONE_SIZE = 3;

// Change this if your model faces the wrong direction.
const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

// Side patrol lanes leave the center of the view clear for the login interface.
const FLIGHTS = [
  {
    points: [[-12, 5, -10], [-16, 5, -17], [-19, 5, -24], [-15, 5, -26], [-12, 5, -19], [-10, 5, -12]],
    speed: 5, phase: 0,
  },
  {
    points: [[-22, 8, -29], [-25, 8, -34], [-27, 8, -38], [-22, 8, -39], [-19, 8, -35], [-19, 8, -30]],
    speed: 5, phase: 0.38,
  },
  {
    points: [[12, 6.5, -12], [18, 6.5, -23], [25, 6.5, -35], [21, 6.5, -38], [16, 6.5, -27], [10, 6.5, -15]],
    speed: 5, phase: 0.7,
  },
].map(({ points, ...flight }) => {
  const route = new CatmullRomCurve3(
    points.map(([x, y, z]) => new Vector3(x, y, z)),
    true,
    "centripetal",
  );
  return { ...flight, route, length: route.getLength() };
});

function FlyingDrone({ index }: { index: number }) {
  const flight = FLIGHTS[index];
  const flightGroup = useRef<Group>(null);
  const elapsed = useRef(0);
  const tangent = useMemo(() => new Vector3(), []);

  const { scene } = useGLTF(MODEL_PATH);


  // Each drone gets its own object hierarchy.
  const model = useMemo(() => {

    const drone = scene.getObjectByName("Drone_Root");
    if (!drone) throw new Error("Drone not found");
    const copy = clone(drone);

    const oriented = new Group();
    oriented.rotation.set(...MODEL_ROTATION);
    oriented.add(copy);
    oriented.updateMatrixWorld(true);

    const bounds = new Box3().setFromObject(oriented);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());

    const centered = new Group();
    centered.add(oriented);
    centered.position.copy(center).multiplyScalar(-1);

    const normalized = new Group();
    normalized.add(centered);

    const largestDimension = Math.max(
      size.x,
      size.y,
      size.z,
      0.001,
    );

    normalized.scale.setScalar(DRONE_SIZE / largestDimension);

    return normalized;
  }, [scene]);

  const propellers = useMemo (
    () =>
    [
      "Propeller_FL",
      "Propeller_FR",
      "Propeller_RL",
      "Propeller_RR"
    ].map((name)=> model.getObjectByName(name)),
  [model],
);

  useFrame((_, delta) => {

    const dt = Math.min(delta, 0.05);
  const spinSpeed = 200;

  const directions = [1, -1, -1, 1];

  propellers.forEach((propeller, index) => {
    if (propeller) {
      propeller.rotation.y += directions[index] * spinSpeed * dt;
    }
});

    if (!flightGroup.current) return;

    elapsed.current += Math.min(delta, 0.05);

    // Arc-length sampling gives steady speed on straight runs and rounded turns.
    const progress = (flight.phase + elapsed.current * flight.speed / flight.length) % 1;
    flight.route.getPointAt(progress, flightGroup.current.position);
    flight.route.getTangentAt(progress, tangent);
    flightGroup.current.rotation.y = Math.atan2(tangent.x, tangent.z);

  });

  return (
    <group
      ref={flightGroup}
      position={flight.route.getPointAt(flight.phase)}
    >
      <primitive object={model} dispose={null} />
    </group>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="scene-notice">
          3D background unavailable. Check the browser console.
        </div>
      );
    }

    return this.props.children;
  }
}

// A blue sky dome: lighter near the horizon and deeper overhead.
// Unlit and untone-mapped so exposure from the warm sunlight cannot wash it out.
function BlueSky() {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(300, 48, 32);
    const positions = sphere.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const horizon = new Color("#619cc4");
    const zenith = new Color("#2866a0");
    const color = new Color();

    for (let i = 0; i < positions.count; i++) {
      const elevation = Math.max(0, positions.getY(i) / 300);
      color.copy(horizon).lerp(zenith, Math.pow(elevation, 0.55));
      color.toArray(colors, i * 3);
    }
    sphere.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return sphere;
  }, []);

  return (
    <mesh geometry={geometry} renderOrder={-100}>
      <meshBasicMaterial
        vertexColors
        side={BackSide}
        toneMapped={false}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

function FieldClouds() {
  const clouds = [
    { position: [-90, 23, -145] as [number, number, number], scale: 1 },
    { position: [-24, 27, -190] as [number, number, number], scale: 1 },
    { position: [45, 24, -155] as [number, number, number], scale: 1 },
    { position: [98, 32, -185] as [number, number, number], scale: 1 },
    { position: [-115, 46, -210] as [number, number, number], scale: 1 },
  ];

  return (
    <group name="Clouds">
      {clouds.map((cloud, index) => (
        <Billboard key={index} position={cloud.position} scale={cloud.scale}>
          <mesh>
            <planeGeometry args={[48, 20]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              toneMapped={false}
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                varying vec2 vUv;
                float puff(vec2 p, vec2 center, vec2 size) {
                  return 1.0 - smoothstep(0.65, 1.0, length((p - center) / size));
                }
                void main() {
                  vec2 p = vUv;
                  float cloud = puff(p, vec2(0.24, 0.4), vec2(0.2, 0.23));
                  cloud = max(cloud, puff(p, vec2(0.42, 0.55), vec2(0.19, 0.36)));
                  cloud = max(cloud, puff(p, vec2(0.61, 0.47), vec2(0.2, 0.29)));
                  cloud = max(cloud, puff(p, vec2(0.78, 0.38), vec2(0.18, 0.2)));
                  cloud = max(cloud, puff(p, vec2(0.49, 0.32), vec2(0.34, 0.16)));
                  vec3 color = mix(vec3(0.72, 0.8, 0.86), vec3(1.0, 0.99, 0.95), smoothstep(0.2, 0.65, p.y));
                  gl_FragColor = vec4(color, cloud * 0.92);
                }
              `}
            />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}

export default function FarmScene() {
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 5, 15], fov: 50, near: 0.1, far: 350 }}
        dpr={[1, 1.5]}
        frameloop="always"
        onCreated={({ camera }) => camera.lookAt(0, 3, -18)}
        fallback={
          <div className="scene-notice">
            3D rendering is unavailable.
          </div>
        }
      >
        <BlueSky />
        
        <FieldClouds />

        {/* Soft blue skylight with warm light reflected from the field. */}
        <hemisphereLight args={["#edf6ff", "#d6bd80", 2.0]} />
        <directionalLight
          position={[-55, 24, -180]}
          intensity={3.2}
          color="#fff0cc"
        />

        {/* Gentle front fill reveals the wheat and drones against the sun. */}
        <directionalLight position={[20, 35, 45]} intensity={1.1} color="#fff6df" />

        <FarmEnvironment />

        <Suspense fallback={null}>
          {FLIGHTS.map((_, index) => (
            <FlyingDrone key={index} index={index} />
          ))}
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
