import React, { useState } from "react";
import { EarthView } from "./components/EarthView";
import { RfCniTool } from "./components/RfCniTool";

interface GeoLocation {
  latitude_deg: number;
  longitude_deg: number;
}

const App: React.FC = () => {
  const [user1Location, setUser1Location] = useState<GeoLocation>({
    latitude_deg: 40.0,
    longitude_deg: -105.0,
  });
  const [user2Location, setUser2Location] = useState<GeoLocation>({
    latitude_deg: 35.0,
    longitude_deg: -80.0,
  });

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
        GEO Satellite Earth View & RF Link Tool  
      </h1>
      <p
        style={{
          textAlign: "center",
          marginBottom: "1.5rem",
          fontSize: "0.9rem",
          opacity: 0.8,
        }}
      >
        Visualize the GEO satellite view and evaluate bent-pipe C/(N+I) and
        DVB-S2 MODCOD for ground-to-ground links.
      </p>

      <EarthView
        user1Location={user1Location}
        user2Location={user2Location}
      />
      <RfCniTool
        user1Location={user1Location}
        user2Location={user2Location}
        onUser1LocationChange={setUser1Location}
        onUser2LocationChange={setUser2Location}
      />
    </div>
  );
};

export default App;


