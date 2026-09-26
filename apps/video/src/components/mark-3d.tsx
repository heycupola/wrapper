import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { useTheme } from "../theme";
import { T, ease, easeInOut, mix, progress, useTime } from "../timing";
import { MARK_PATH } from "./mark";

const TILE = 0.92;
const DEPTH = 0.2;
const RADIUS = (22 / 96) * TILE;

function roundedSquare(size: number, radius: number): THREE.Shape {
  const h = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-h + radius, -h);
  shape.lineTo(h - radius, -h);
  shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius);
  shape.quadraticCurveTo(h, h, h - radius, h);
  shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius);
  shape.lineTo(-h, -h + radius);
  shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  return shape;
}

function markShapes(): THREE.Shape[] {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="${MARK_PATH}"/></svg>`;
  const { paths } = new SVGLoader().parse(svg);
  return paths.flatMap((path) => SVGLoader.createShapes(path));
}

/* Image-based lighting so the ceramic reads as a real material, not a flat fill. */
function Studio() {
  const gl = useThree((state) => state.gl);
  const environment = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => environment.dispose(), [environment]);
  return <primitive object={environment} attach="environment" />;
}

function Tile({ t }: { t: number }) {
  const theme = useTheme();
  const tileGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(roundedSquare(TILE - 0.06, RADIUS - 0.03), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 8,
      curveSegments: 24,
    });
    geometry.translate(0, 0, -DEPTH / 2);
    return geometry;
  }, []);
  const wGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(markShapes(), {
      depth: 3,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.35,
      bevelSegments: 4,
    });
    geometry.translate(-48, -48, 0);
    geometry.scale(TILE / 96, TILE / 96, 0.012);
    /* SVG y points down; flipping about X keeps the winding (and normals) correct. */
    geometry.rotateX(Math.PI);
    return geometry;
  }, []);

  const dark = theme === "dark";
  const settle = progress(t, T.mark, 1.6, ease);
  const float = Math.sin((t - T.mark) * 0.9) * progress(t, T.mark + 1.2, 1.2, easeInOut);

  return (
    <group
      rotation={[
        mix(0.5, -0.12, settle) + float * 0.04,
        mix(-1.25, 0.22, settle) + float * 0.08,
        0,
      ]}
      position={[0, mix(-0.12, 0, settle), mix(-1.2, 0, settle)]}
      scale={mix(0.82, 1, settle)}
    >
      <mesh geometry={tileGeometry}>
        <meshPhysicalMaterial
          color={dark ? "#F4F4F1" : "#141518"}
          roughness={dark ? 0.32 : 0.22}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.18}
          envMapIntensity={dark ? 0.9 : 1.1}
        />
      </mesh>
      <mesh geometry={wGeometry} position={[0, 0, DEPTH / 2 + 0.055]}>
        <meshPhysicalMaterial
          color={dark ? "#0E0E0E" : "#FAFAF9"}
          roughness={0.4}
          metalness={0}
          clearcoat={0.4}
          envMapIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

/* A light that sweeps across the tile once it lands. */
function Glint({ t }: { t: number }) {
  const sweep = progress(t, T.mark + 0.7, 1.4, easeInOut);
  return (
    <pointLight
      position={[mix(-3, 3, sweep), mix(1.4, 0.6, sweep), 2.2]}
      intensity={10 * Math.sin(Math.PI * sweep)}
      distance={8}
      decay={2}
    />
  );
}

export function Mark3D({ size }: { size: number }) {
  const t = useTime();
  const theme = useTheme();
  const appear = progress(t, T.mark, 0.7);

  return (
    <div style={{ width: size, height: size, opacity: appear }}>
      <ThreeCanvas
        width={size}
        height={size}
        camera={{ fov: 30, position: [0, 0, 4.6], near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        dpr={2}
        flat
      >
        <Studio />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3, 4]} intensity={2.4} />
        <directionalLight position={[-3, -1, 2]} intensity={0.6} />
        <directionalLight position={[0, -3, 1]} intensity={theme === "dark" ? 0.3 : 0.5} />
        <Glint t={t} />
        <Tile t={t} />
      </ThreeCanvas>
    </div>
  );
}
