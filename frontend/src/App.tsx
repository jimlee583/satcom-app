import React from "react";
import { EarthView } from "./components/EarthView";

const App: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "1.5rem 1rem 3rem",
        background:
          "radial-gradient(circle at top, #020617, #020617 40%, #000 100%)",
        color: "#e5e7eb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        GEO Satellite Earth View
      </h1>
      <p
        style={{
          textAlign: "center",
          marginBottom: "1.5rem",
          fontSize: "0.9rem",
          opacity: 0.8,
        }}
      >
        Visualize what the Earth looks like from different GEO orbital
        longitudes.
      </p>
      <EarthView />
    </div>
  );
};

export default App;

