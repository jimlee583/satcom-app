import React, { useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

interface EarthProps {
  longitudeDeg: number; // GEO orbital longitude, degrees East
}

/**
 * Earth sphere with day texture.
 * Rotates so the given longitude is centered in the view.
 */
const Earth: React.FC<EarthProps> = ({ longitudeDeg }) => {
  const earthTexture = useLoader(TextureLoader, "/earth-day.jpg");

  // Rotate Earth so the given longitude is at the center of the view.
  // Positive longitude east → rotate sphere by -longitude about Y.
  const rotationY = -THREE.MathUtils.degToRad(longitudeDeg);

  return (
    <mesh rotation={[0, rotationY, 0]}>
      {/* radius 1, good segment count for smooth sphere */}
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial map={earthTexture} />
    </mesh>
  );
};

/**
 * GEO Earth view with programmatic latitude/longitude grid overlay.
 * The grid is a wireframe sphere slightly larger than the textured Earth.
 */
export const EarthView: React.FC = () => {
  const [longitude, setLongitude] = useState<number>(0); // 0°E at start

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) return;
    setLongitude(value);
  };

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "2rem auto",
        padding: "1.5rem",
        borderRadius: 12,
        background: "#0b1120",
        color: "#e5e7eb",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      }}
    >
      <h2 style={{ marginBottom: "1rem" }}>GEO Earth View</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)",
          gap: "1.5rem",
          alignItems: "center",
        }}
      >
        {/* Controls */}
        <div>
          <p style={{ marginBottom: "0.75rem" }}>
            Enter the satellite <strong>orbital longitude in GEO</strong>{" "}
            (degrees East). The Earth view will rotate so that the
            sub-satellite point is at the center of the disk.
          </p>

          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            Longitude (°E, range −180 to +180):
            <input
              type="number"
              min={-180}
              max={180}
              step={1}
              value={longitude}
              onChange={handleChange}
              style={{
                marginLeft: "0.5rem",
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                width: "6rem",
              }}
            />
          </label>

          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={longitude}
            onChange={handleChange}
            style={{ width: "100%" }}
          />

          <p style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
            Current sub-satellite longitude:{" "}
            <strong>{longitude.toFixed(1)}°E</strong>
          </p>

          <ul style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
            <li>0°E → view centered near Africa/Europe</li>
            <li>−75° (75°W) → Americas centered</li>
            <li>+140°E → Asia/Pacific centered</li>
          </ul>
        </div>

        {/* 3D Earth with grid */}
        <div
          style={{
            height: 400,
            borderRadius: 12,
            overflow: "hidden",
            background: "black",
          }}
        >
          <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
            {/* Lights */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 3, 5]} intensity={1.1} />

            {/* Space background */}
            <color attach="background" args={["black"]} />

            {/* Earth textured sphere */}
            <Earth longitudeDeg={longitude} />

            {/* Programmatic latitude/longitude grid overlay
                A wireframe sphere slightly larger than Earth. */}
            <mesh>
              {/* radius 1.01 so the grid sits just above the Earth surface */}
              <sphereGeometry args={[1.01, 32, 16]} />
              <meshBasicMaterial
                wireframe={true}
                color="#555555"
                transparent={true}
                opacity={0.6}
              />
            </mesh>
          </Canvas>
        </div>
      </div>
    </div>
  );
};
