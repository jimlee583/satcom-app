import React, { useEffect, useMemo, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

const PRIME_MERIDIAN_OFFSET_DEG = 90; // Geometry seam points ~90°W in default pose

/**
 * Earth sphere with day texture.
 * Rotates so the given longitude is centered in the view.
 */
const Earth: React.FC = () => {
  const earthTexture = useLoader(TextureLoader, "/earth-day.jpg");

  return (
    <mesh>
      {/* radius 1, good segment count for smooth sphere */}
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial map={earthTexture} />
    </mesh>
  );
};

const GRID_RADIUS = 1.01;
const LAT_STEP_DEG = 15;
const LON_STEP_DEG = 15;
const SAMPLE_STEP_DEG = 5;
const MARKER_SIZE = 0.035;
const MARKER_RADIUS = GRID_RADIUS + 0.01;
const BEAM_RADIUS = GRID_RADIUS + 0.02;

const latLonToCartesian = (
  latitudeDeg: number,
  longitudeDeg: number,
  radius = GRID_RADIUS,
): [number, number, number] => {
  const latRad = THREE.MathUtils.degToRad(latitudeDeg);
  const lonRad = THREE.MathUtils.degToRad(
    longitudeDeg + PRIME_MERIDIAN_OFFSET_DEG,
  );

  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  return [x, y, z];
};

const buildLatitudeGeometry = (latDeg: number) => {
  const points: THREE.Vector3[] = [];
  for (let lon = -180; lon <= 180; lon += SAMPLE_STEP_DEG) {
    const [x, y, z] = latLonToCartesian(latDeg, lon, GRID_RADIUS);
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
};

const buildLongitudeGeometry = (lonDeg: number) => {
  const points: THREE.Vector3[] = [];
  for (let lat = -90; lat <= 90; lat += SAMPLE_STEP_DEG) {
    const [x, y, z] = latLonToCartesian(lat, lonDeg, GRID_RADIUS);
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
};

const buildBeamFootprintGeometry = (
  satLonDeg: number,
  centerLatDeg: number,
  centerLonDeg: number,
  beamwidthDeg: number,
): THREE.BufferGeometry | null => {
  if (!Number.isFinite(beamwidthDeg) || beamwidthDeg <= 0) {
    return null;
  }

  // Interpret beamwidth as full antenna pattern angle at the satellite.
  // Use half-angle as off-boresight angle at GEO altitude, then project
  // that cone onto the Earth sphere.
  const halfAngleRad = THREE.MathUtils.degToRad(beamwidthDeg / 2);

  // Normalized radii (Earth radius = 1, GEO radius ~ 6.61)
  const EARTH_RADIUS = 1;
  const GEO_RADIUS = 42164 / 6378; // ≈ 6.61

  // Satellite position in ECEF-like coordinates at latitude 0, longitude satLonDeg.
  const satLonRad = THREE.MathUtils.degToRad(satLonDeg);
  const satPos = new THREE.Vector3(
    GEO_RADIUS * Math.cos(0) * Math.sin(satLonRad),
    0,
    GEO_RADIUS * Math.cos(0) * Math.cos(satLonRad),
  );

  // Ground beam center point on Earth's surface.
  const centerLatRad = THREE.MathUtils.degToRad(centerLatDeg);
  const centerLonRad = THREE.MathUtils.degToRad(centerLonDeg);
  const groundCenter = new THREE.Vector3(
    EARTH_RADIUS * Math.cos(centerLatRad) * Math.sin(centerLonRad),
    EARTH_RADIUS * Math.sin(centerLatRad),
    EARTH_RADIUS * Math.cos(centerLatRad) * Math.cos(centerLonRad),
  );

  // Boresight direction from satellite to ground beam center.
  const n = groundCenter.clone().sub(satPos).normalize();

  // Build orthonormal basis around boresight axis.
  const up =
    Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();

  const points: THREE.Vector3[] = [];

  for (let bearingDeg = 0; bearingDeg <= 360; bearingDeg += SAMPLE_STEP_DEG) {
    const bearingRad = THREE.MathUtils.degToRad(bearingDeg);

    const dir = new THREE.Vector3()
      .copy(n)
      .multiplyScalar(Math.cos(halfAngleRad))
      .add(
        e1
          .clone()
          .multiplyScalar(Math.sin(halfAngleRad) * Math.cos(bearingRad)),
      )
      .add(
        e2
          .clone()
          .multiplyScalar(Math.sin(halfAngleRad) * Math.sin(bearingRad)),
      )
      .normalize();

    // Ray-sphere intersection: |S + t*D|^2 = R^2
    const a = 1; // |D|^2
    const b = 2 * satPos.dot(dir);
    const c = satPos.lengthSq() - EARTH_RADIUS * EARTH_RADIUS;
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      continue;
    }

    const t = (-b - Math.sqrt(disc)) / (2 * a); // nearer intersection
    if (t <= 0) {
      continue;
    }

    const hit = satPos.clone().addScaledVector(dir, t);

    // Convert hit point to geodetic lat/lon in the local frame.
    const r = hit.length();
    const latRad = Math.asin(hit.y / r);
    const lonRad = Math.atan2(hit.x, hit.z);

    const latDeg = THREE.MathUtils.radToDeg(latRad);
    const lonDeg = THREE.MathUtils.radToDeg(lonRad);

    const [x3, y3, z3] = latLonToCartesian(latDeg, lonDeg, BEAM_RADIUS);
    points.push(new THREE.Vector3(x3, y3, z3));
  }

  return new THREE.BufferGeometry().setFromPoints(points);
};

const LatLonGrid: React.FC = () => {
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#555555",
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  const { latGeometries, lonGeometries } = useMemo(() => {
    const lats: THREE.BufferGeometry[] = [];
    for (let lat = -75; lat <= 75; lat += LAT_STEP_DEG) {
      lats.push(buildLatitudeGeometry(lat));
    }

    const lons: THREE.BufferGeometry[] = [];
    for (let lon = -180; lon < 180; lon += LON_STEP_DEG) {
      lons.push(buildLongitudeGeometry(lon));
    }

    return { latGeometries: lats, lonGeometries: lons };
  }, []);

  useEffect(
    () => () => {
      latGeometries.forEach((geometry) => geometry.dispose());
      lonGeometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    },
    [latGeometries, lonGeometries, material],
  );

  return (
    <>
      {latGeometries.map((geometry, idx) => (
        <lineLoop key={`lat-${idx}`} geometry={geometry} material={material} />
      ))}
      {lonGeometries.map((geometry, idx) => (
        <lineLoop key={`lon-${idx}`} geometry={geometry} material={material} />
      ))}
    </>
  );
};

interface GeoLocation {
  latitude_deg: number;
  longitude_deg: number;
}

interface EarthViewProps {
  user1Location: GeoLocation;
  user2Location: GeoLocation;
  beamCenter: GeoLocation;
  beamwidthDeg: number;
}

const GroundMarker: React.FC<{
  location: GeoLocation;
  color: string;
}> = ({ location, color }) => {
  const position = useMemo(
    () =>
      latLonToCartesian(
        location.latitude_deg,
        location.longitude_deg,
        MARKER_RADIUS,
      ),
    [location.latitude_deg, location.longitude_deg],
  );

  return (
    <mesh position={position}>
      <sphereGeometry args={[MARKER_SIZE, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
};

const BeamFootprint: React.FC<{
  satLongitudeDeg: number;
  centerLatitudeDeg: number;
  centerLongitudeDeg: number;
  beamwidthDeg: number;
}> = ({ satLongitudeDeg, centerLatitudeDeg, centerLongitudeDeg, beamwidthDeg }) => {
  const geometry = useMemo(
    () =>
      buildBeamFootprintGeometry(
        satLongitudeDeg,
        centerLatitudeDeg,
        centerLongitudeDeg,
        beamwidthDeg,
      ),
    [satLongitudeDeg, centerLatitudeDeg, centerLongitudeDeg, beamwidthDeg],
  );

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#ffcc00",
        transparent: true,
        opacity: 0.9,
        linewidth: 2,
      }),
    [],
  );

  useEffect(
    () => () => {
      if (geometry) geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (!geometry) return null;

  return <lineLoop geometry={geometry} material={material} />;
};

/**
 * GEO Earth view with programmatic latitude/longitude grid overlay.
 * The grid is a wireframe sphere slightly larger than the textured Earth.
 */
export const EarthView: React.FC<EarthViewProps> = ({
  user1Location,
  user2Location,
  beamCenter,
  beamwidthDeg,
}) => {
  const [longitude, setLongitude] = useState<number>(0); // 0°E at start
  const rotationY = -THREE.MathUtils.degToRad(
    longitude + PRIME_MERIDIAN_OFFSET_DEG,
  );

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
                width: "5rem",
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

            <group rotation={[0, rotationY, 0]}>
              {/* Earth textured sphere */}
              <Earth />

              {/* Programmatic latitude/longitude grid overlay */}
              <LatLonGrid />

              {/* Beam footprint from satellite nadir */}
              <BeamFootprint
                satLongitudeDeg={longitude}
                centerLatitudeDeg={beamCenter.latitude_deg}
                centerLongitudeDeg={beamCenter.longitude_deg}
                beamwidthDeg={beamwidthDeg}
              />

              {/* Ground terminal markers */}
              <GroundMarker location={user1Location} color="#ff4d4d" />
              <GroundMarker location={user2Location} color="#ff9f9f" />
            </group>
          </Canvas>
        </div>
      </div>
    </div>
  );
};
