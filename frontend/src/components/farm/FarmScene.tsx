import { Component, Suspense, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, useGLTF } from "@react-three/drei";
import {
  BackSide,
  Box3,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  SphereGeometry,
  Vector3,
} from "three";

import { clone } from "three/addons/utils/SkeletonUtils.js";
import FarmEnvironment from "./FarmEnvironment";

const MODEL_PATH = "/models/drone.glb";
const DRONE_SIZE = 3;

const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

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

function FlyingDrone({
  index,
  mission = false,
}: {
  index: number;
  mission?: boolean;
}) {
  const flight = FLIGHTS[index];

  const flightGroup = useRef<Group>(null);
  const elapsed = useRef(0);
  const tangent = useMemo(() => new Vector3(), []);

  const { scene } = useGLTF(MODEL_PATH);

  const model = useMemo(() => {
    const drone = scene.getObjectByName("Drone_Root");

    if (!drone) {
      throw new Error("Drone not found");
    }

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

    normalized.scale.setScalar(
      DRONE_SIZE / largestDimension,
    );

    return normalized;
  }, [scene]);

  const propellers = useMemo(
    () =>
      [
        "Propeller_FL",
        "Propeller_FR",
        "Propeller_RL",
        "Propeller_RR",
      ].map((name) => model.getObjectByName(name)),
    [model],
  );

  const missionRoute = useMemo(
    () =>
      new CatmullRomCurve3(
        [
          new Vector3(0, 6, 4),
          new Vector3(-18, 6, -3),
          new Vector3(-38, 7, -8),
          new Vector3(-38, 8, -34),
          new Vector3(-20, 8, -38),
          new Vector3(0, 7, -20),
          new Vector3(20, 8, -38),
          new Vector3(38, 8, -34),
          new Vector3(38, 7, -8),
          new Vector3(18, 6, -3),
        ],
        true,
        "centripetal",
      ),
    [],
  );

  const smoothstep = (value: number) =>
    value * value * (3 - 2 * value);

  useFrame((_, delta) => {
    if (!flightGroup.current) return;

    elapsed.current = mission
      ? Math.min(90, elapsed.current + delta)
      : elapsed.current + delta;

    const t = elapsed.current;
    const group = flightGroup.current;
    const directions = [1, -1, -1, 1];

    const rotorPower = mission
      ? smoothstep(
          Math.min(1, Math.max(0, (t - 3) / 2)),
        ) *
        (1 -
          smoothstep(
            Math.min(1, Math.max(0, (t - 88) / 2)),
          ))
      : 1;

    propellers.forEach((propeller, i) => {
      if (propeller) {
        propeller.rotation.y +=
          directions[i] * 100 * delta * rotorPower;
      }
    });

    if (mission) {
      const groundY = 0.73;
      const cruiseY = 6;
      const laps = 4;

      if (t < 3) {
        // 0–3 seconds: idle on pad.
        group.position.set(0, groundY, 4);
      } else if (t < 8) {
        // 3–8 seconds: vertical takeoff.
        const progress = smoothstep((t - 3) / 5);

        group.position.set(
          0,
          groundY + (cruiseY - groundY) * progress,
          4,
        );
      } else if (t < 82) {
        // 8–82 seconds: four complete field circuits.
        const flightTime = t - 8;
        const duration = 74;
        const ramp = 3;

        let distanceTime: number;

        if (flightTime < ramp) {
          distanceTime =
            (flightTime * flightTime) / (2 * ramp);
        } else if (flightTime > duration - ramp) {
          const remaining = duration - flightTime;

          distanceTime =
            duration -
            ramp -
            (remaining * remaining) / (2 * ramp);
        } else {
          distanceTime = flightTime - ramp / 2;
        }

        const progress =
          ((laps * distanceTime) / (duration - ramp)) % 1;

        missionRoute.getPointAt(
          progress,
          group.position,
        );

        missionRoute.getTangentAt(
          progress,
          tangent,
        );

        const targetYaw = Math.atan2(
          tangent.x,
          tangent.z,
        );

        const difference = Math.atan2(
          Math.sin(targetYaw - group.rotation.y),
          Math.cos(targetYaw - group.rotation.y),
        );

        group.rotation.y +=
          difference * (1 - Math.exp(-6 * delta));
      } else if (t < 90) {
        // 82–90 seconds: vertical landing.
        const progress = smoothstep((t - 82) / 8);

        group.position.set(
          0,
          cruiseY + (groundY - cruiseY) * progress,
          4,
        );
      } else {
        group.position.set(0, groundY, 4);
      }

      return;
    }

    // Other drones continue their normal looping flights.
    const progress =
      ((t * flight.speed) / flight.length + flight.phase) %
      1;

    flight.route.getPointAt(
      progress,
      group.position,
    );

    flight.route.getTangentAt(
      progress,
      tangent,
    );

    group.rotation.y = Math.atan2(
      tangent.x,
      tangent.z,
    );
  });

  return (
    <group
      ref={flightGroup}
      position={
        mission
          ? [0, 0.73, 4]
          : flight.route.getPointAt(flight.phase)
      }
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

function ChargingPad(){
  const {scene} = useGLTF("/models/charging-pad.glb");
  const model = useMemo(() => scene.clone(true), [scene]);


  return (
    <primitive
      object = {model}
      position = {[0,0.1,4]}
      scale={DRONE_SIZE / 0.8}
    />

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

       
        <hemisphereLight args={["#edf6ff", "#d6bd80", 2.0]} />
        <directionalLight
          position={[-55, 24, -180]}
          intensity={3.2}
          color="#fff0cc"
        />


        <directionalLight position={[20, 35, 45]} intensity={1.1} color="#fff6df" />

        <FarmEnvironment />

        <Suspense fallback={null}>
          <ChargingPad />

          {FLIGHTS.map((_, index) => (
         <FlyingDrone key={index} index={index} />
          ))}

         <FlyingDrone index={0} mission />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}

