import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, ShaderChunk } from "three";

// Shared dimensions keep the soil, fence, and planting area aligned.
const FIELD_WIDTH = 60;
const FIELD_DEPTH = 44;
const FIELD_CENTER_Z = -20;
// Corn needs more room than wheat for its broad, arching leaves.
const ROW_SPACING = 0.85;
const PLANT_SPACING = 0.6;
const EDGE_CLEARANCE = 2;
const PAD_X = 22;
const PAD_Z = -8;
const PAD_CLEARANCE = 4;
const ROWS = Math.floor((FIELD_WIDTH - EDGE_CLEARANCE * 2) / ROW_SPACING) + 1;
const PLANTS_PER_ROW = Math.floor((FIELD_DEPTH - EDGE_CLEARANCE * 2) / PLANT_SPACING) + 1;

const CROP_POSITIONS = Array.from({ length: ROWS * PLANTS_PER_ROW }, (_, index) => {
  const row = Math.floor(index / PLANTS_PER_ROW);
  const plant = index % PLANTS_PER_ROW;
  return {
    index,
    x: (row - (ROWS - 1) / 2) * ROW_SPACING + Math.sin(index * 13.7) * 0.05,
    z: FIELD_CENTER_Z + (plant - (PLANTS_PER_ROW - 1) / 2) * PLANT_SPACING + Math.cos(index * 9.1) * 0.08,
  };
}).filter(({ x, z }) => Math.hypot(x - PAD_X, z - PAD_Z) >= PAD_CLEARANCE);
const COUNT = CROP_POSITIONS.length;

const WIND_STRENGTH = 0.2;
const WIND_SPEED = 1.5;
const WIND_VERTEX = ShaderChunk.project_vertex.replace(
  "mvPosition = modelViewMatrix * mvPosition;",
  `
  float windHeight = clamp(mvPosition.y / 2.7, 0.0, 1.2);
  float windPhase = dot(mvPosition.xz, vec2(0.30, 0.20));
  float windGust = 0.75 + 0.25 * sin(uWindTime * 0.45 - windPhase * 0.55);
  float windWave = sin(uWindTime * uWindSpeed - windPhase);
  float windRipple = 0.15 * sin(uWindTime * 3.8 - windPhase * 1.7);
  float windBend = uWindStrength * windHeight * windHeight
    * windGust * (windWave + windRipple);
  mvPosition.xz += vec2(0.94, 0.34) * windBend;
  mvPosition = modelViewMatrix * mvPosition;
  `,
);

function Crops() {
  const { scene } = useGLTF("/models/corn.glb");
  const instances = useRef<(InstancedMesh | null)[]>([]);
  const invalidate = useThree((state) => state.invalidate);
  const wind = useMemo(() => ({
    uWindTime: { value: 0 },
    uWindStrength: { value: WIND_STRENGTH },
    uWindSpeed: { value: WIND_SPEED },
  }), []);

  const windTime = useRef<{ value: number } | null>(null);
  useLayoutEffect(() => {
    windTime.current = wind.uWindTime;
  }, [wind]);
  useFrame((_, delta) => {
    if (windTime.current) windTime.current.value += Math.min(delta, 0.05);
  });

  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    return meshes.map((mesh) => {
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        .map((source) => {
          const material = source.clone();
          material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, wind);
            shader.vertexShader = `uniform float uWindTime;
              uniform float uWindStrength;
              uniform float uWindSpeed;\n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <project_vertex>", WIND_VERTEX,
            );
          };
          material.customProgramCacheKey = () => "corn-wind-v1";
          return material;
        });
      return {
        geometry: mesh.geometry,
        material: Array.isArray(mesh.material) ? materials : materials[0],
        matrix: mesh.matrixWorld.clone(),
      };
    });
  }, [scene, wind]);

  useLayoutEffect(() => () => {
    parts.forEach(({ material }) => {
      (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
    });
  }, [parts]);

  useLayoutEffect(() => {
    const transform = new Object3D();
    const matrix = new Matrix4();

    CROP_POSITIONS.forEach(({ index, x, z }, instanceIndex) => {
      transform.position.set(x, 0, z);
      transform.rotation.set(0, index * 2.39996, 0);

      // Natural corn proportions with an uneven, roughly 2.4–2.9 unit canopy.
      const height = 0.9 + (Math.sin(index * 12.9898) * 0.5 + 0.5) * 0.18;
      const width = 0.85 + (Math.sin(index * 7.13) * 0.5 + 0.5) * 0.15;
      transform.scale.set(width, height, width);
      transform.updateMatrix();

      parts.forEach((part, partIndex) => {
        matrix.multiplyMatrices(transform.matrix, part.matrix);
        instances.current[partIndex]?.setMatrixAt(instanceIndex, matrix);
      });
    });

    instances.current.forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += WIND_STRENGTH * 2;
    });
    // Refresh after updating the crop instances.
    invalidate();
  }, [parts, invalidate]);

  return (
    <group dispose={null}>
      {parts.map((part, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => { instances.current[index] = mesh; }}
          args={[part.geometry, part.material, COUNT]}
        />
      ))}
    </group>
  );
}

function MountainRidge({ distant = false }: { distant?: boolean }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const columns = 48;
    const rows = 8;
    for (let row = 0; row <= rows; row++) {
      const depth = row / rows;
      for (let col = 0; col <= columns; col++) {
        const x = (col / columns - 0.5) * 340;
        const ridge = 13 + Math.sin(col * 0.53) * 5 + Math.sin(col * 1.37) * 3;
        const envelope = Math.sin(depth * Math.PI);
        const y = Math.max(0, ridge * envelope + Math.sin(col * 2.7 + row) * 1.7 * envelope);
        positions.push(x, y - 0.5, -depth * 55);
        if (row < rows && col < columns) {
          const i = row * (columns + 1) + col;
          indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
        }
      }
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, []);

  return (
    <mesh geometry={geometry} position={[distant ? 15 : 0, 0, distant ? -115 : -65]} scale={[1, distant ? 1.5 : 1, 1]}>
      <meshStandardMaterial color={distant ? "#a6a799" : "#78816b"} flatShading roughness={1} />
    </mesh>
  );
}

function Mountains() {
  return <group name="Mountain_Range"><MountainRidge /><MountainRidge distant /></group>;
}

function FieldDetails() {
  return (
    <group>

      {/* Small orchard silhouettes give the distant landscape scale. */}
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} position={[-40 + i * 7, 0, -50 - Math.sin(i) * 4]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.15, 0.22, 2.2, 5]} />
            <meshStandardMaterial color="#615541" />
          </mesh>
          <mesh position={[0, 3, 0]} scale={[1.2, 1.7 + (i % 3) * 0.2, 1.2]}>
            <icosahedronGeometry args={[1.3, 1]} />
            <meshStandardMaterial color={i % 2 ? "#59684b" : "#6b7650"} flatShading />
          </mesh>
        </group>
      ))}
      <group position={[PAD_X, 0.05, PAD_Z]}>
        <mesh>
          <cylinderGeometry args={[2.1, 2.2, 0.18, 32]} />
          <meshStandardMaterial color="#3e4b46" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[1.65, 1.72, 40]} />
          <meshBasicMaterial color="#dbe9c7" />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.15, 0]}>
            <boxGeometry args={[0.12, 0.01, 1.1]} />
            <meshBasicMaterial color="#dbe9c7" />
          </mesh>
        ))}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.9, 0.01, 0.12]} />
          <meshBasicMaterial color="#dbe9c7" />
        </mesh>
      </group>
    </group>
  );
}

function FieldFence() {
  const width = FIELD_WIDTH;
  const depth = FIELD_DEPTH;
  const centerZ = FIELD_CENTER_Z;
  const postSpacing = 4;

  const sides = [
    { x: 0, z: centerZ + depth / 2, length: width, rotation: 0 },
    { x: 0, z: centerZ - depth / 2, length: width, rotation: 0 },
    {
      x: -width / 2,
      z: centerZ,
      length: depth,
      rotation: Math.PI / 2,
    },
    {
      x: width / 2,
      z: centerZ,
      length: depth,
      rotation: Math.PI / 2,
    },
  ];

  return (
    <group name="Field_Fence">
      {sides.map((side, sideIndex) => {
        const sections = Math.ceil(side.length / postSpacing);

        return (
          <group
            key={sideIndex}
            position={[side.x, 0, side.z]}
            rotation={[0, side.rotation, 0]}
          >
            {/* Omit each side's last post to avoid duplicate corners. */}
            {Array.from({ length: sections }, (_, index) => (
              <mesh
                key={index}
                position={[
                  -side.length / 2 + (index / sections) * side.length,
                  0.8,
                  0,
                ]}
              >
                <boxGeometry args={[0.18, 1.6, 0.18]} />
                <meshStandardMaterial
                  color="#695238"
                  roughness={1}
                />
              </mesh>
            ))}

            {/* Two horizontal wooden rails. */}
            {[0.55, 1.15].map((height) => (
              <mesh key={height} position={[0, height, 0]}>
                <boxGeometry args={[side.length, 0.12, 0.1]} />
                <meshStandardMaterial
                  color="#91734D"
                  roughness={1}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export default function FarmEnvironment() {
  return (
    <>
     
      <FieldDetails />
      <FieldFence />
      <Mountains/>
      {/* Main ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.06, 0]}
      >
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#a49b70" roughness={1} />
      </mesh>

      {/* Soil beneath the crops */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, FIELD_CENTER_Z]}
      >
      <planeGeometry args={[FIELD_WIDTH - 2, FIELD_DEPTH - 2]} />
      <meshStandardMaterial color="#A58B49" roughness={1} />
      </mesh>

      <Suspense fallback={null}>
        <Crops />
      </Suspense>

      {/* Dirt road */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 5]}
      >
        <planeGeometry args={[100, 5]} />
        <meshStandardMaterial color="#c2ac82" roughness={1} />
      </mesh>

    </>
  );
}
