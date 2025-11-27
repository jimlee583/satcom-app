import React, { useState } from "react";
import { TERMINAL_PRESETS } from "../terminal_presets";
import type { TerminalPreset } from "../terminal_presets";

const API_BASE_URL = "/api";

interface Location {
  latitude_deg: number;
  longitude_deg: number;
}

interface GroundTerminal {
  location: Location;
  eirp_dbw: number;
  gt_dbk: number;
  impl_margin_db: number;
}

interface LinkGeometry {
  satellite_longitude_deg: number;
}

interface LinkFrequencies {
  uplink_freq_ghz: number;
  downlink_freq_ghz: number;
  noise_bandwidth_hz: number;
}

interface SatelliteRF {
  uplink_gt_dbk: number;
  downlink_eirp_dbw: number;
  uplink_impl_margin_db: number;
  downlink_impl_margin_db: number;
  uplink_interference_margin_db: number;
  downlink_interference_margin_db: number;
}

interface CniRequest {
  user1: GroundTerminal;
  user2: GroundTerminal;
  geometry: LinkGeometry;
  rf: SatelliteRF;
  freqs: LinkFrequencies;
  modcod_margin_db: number;
}

interface ModcodInfo {
  name: string;
  required_esn0_db: number;
  margin_db: number;
}

interface CniResponse {
  uplink_cni_db: number;
  downlink_cni_db: number;
  total_cni_db: number;
  uplink_cn0_dbhz: number;
  downlink_cn0_dbhz: number;
  suggested_modcod: ModcodInfo | null;
}

interface RfCniToolProps {
  user1Location: Location;
  user2Location: Location;
  onUser1LocationChange: (location: Location) => void;
  onUser2LocationChange: (location: Location) => void;
}

async function computeCni(payload: CniRequest): Promise<CniResponse> {
  const res = await fetch(`${API_BASE_URL}/rf/cni`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      if ((data as any)?.detail) msg = (data as any).detail;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await res.json()) as CniResponse;
}

export const RfCniTool: React.FC<RfCniToolProps> = ({
  user1Location,
  user2Location,
  onUser1LocationChange,
  onUser2LocationChange,
}) => {
  // Geometry (satellite longitude)
  const [satLon, setSatLon] = useState(-80);

  // User 1
  const [u1Eirp, setU1Eirp] = useState(50.0);
  const [u1Gt, setU1Gt] = useState(20.0);
  const [u1Impl, setU1Impl] = useState(1.0);

  // User 2
  const [u2Gt, setU2Gt] = useState(20.0);
  const [u2Impl, setU2Impl] = useState(1.0);

  // Satellite RF
  const [satUplinkGt, setSatUplinkGt] = useState(15.0);
  const [satDownlinkEirp, setSatDownlinkEirp] = useState(52.0);
  const [uplinkImpl, setUplinkImpl] = useState(1.0);
  const [downlinkImpl, setDownlinkImpl] = useState(1.0);
  const [uplinkIntMargin, setUplinkIntMargin] = useState(1.0);
  const [downlinkIntMargin, setDownlinkIntMargin] = useState(1.0);

  // Frequencies / BW
  const [uplinkFreq, setUplinkFreq] = useState(14.0);       // GHz
  const [downlinkFreq, setDownlinkFreq] = useState(12.0);   // GHz
  const [noiseBwMHz, setNoiseBwMHz] = useState(36);         // MHz (UI)
  const [modcodMargin, setModcodMargin] = useState(1.0);

  const [result, setResult] = useState<CniResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected presets (for UI only)
  const [user1PresetId, setUser1PresetId] = useState<string | "">("");
  const [user2PresetId, setUser2PresetId] = useState<string | "">("");

  const applyPresetToUser1 = (preset: TerminalPreset) => {
    setU1Eirp(preset.eirp_dbw_op);
    setU1Gt(preset.gt_dbk_20deg);
    setU1Impl(preset.impl_margin_db);

    // Set default freqs based on band
    if (preset.band === "Ka") {
      // Ka-band
      setUplinkFreq(30.5);
      setDownlinkFreq(20.7);
    } else if (preset.band === "X") {
      // X-band
      setUplinkFreq(8.3);
      setDownlinkFreq(7.9);
    }
  };

  const applyPresetToUser2 = (preset: TerminalPreset) => {
    // User 2 is receive-only in this simple bent-pipe model
    setU2Gt(preset.gt_dbk_20deg);
    setU2Impl(preset.impl_margin_db);
  };

  const handleUser1PresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setUser1PresetId(id);
    const preset = TERMINAL_PRESETS.find((p) => p.id === id);
    if (preset) applyPresetToUser1(preset);
  };

  const handleUser2PresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setUser2PresetId(id);
    const preset = TERMINAL_PRESETS.find((p) => p.id === id);
    if (preset) applyPresetToUser2(preset);
  };

  const updateUser1Latitude = (value: number) => {
    if (Number.isNaN(value)) return;
    onUser1LocationChange({
      ...user1Location,
      latitude_deg: value,
    });
  };

  const updateUser1Longitude = (value: number) => {
    if (Number.isNaN(value)) return;
    onUser1LocationChange({
      ...user1Location,
      longitude_deg: value,
    });
  };

  const updateUser2Latitude = (value: number) => {
    if (Number.isNaN(value)) return;
    onUser2LocationChange({
      ...user2Location,
      latitude_deg: value,
    });
  };

  const updateUser2Longitude = (value: number) => {
    if (Number.isNaN(value)) return;
    onUser2LocationChange({
      ...user2Location,
      longitude_deg: value,
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const payload: CniRequest = {
        user1: {
          location: {
            latitude_deg: user1Location.latitude_deg,
            longitude_deg: user1Location.longitude_deg,
          },
          eirp_dbw: u1Eirp,
          gt_dbk: u1Gt,
          impl_margin_db: u1Impl,
        },
        user2: {
          location: {
            latitude_deg: user2Location.latitude_deg,
            longitude_deg: user2Location.longitude_deg,
          },
          eirp_dbw: 0.0, // user2 not transmitting in this bent-pipe model
          gt_dbk: u2Gt,
          impl_margin_db: u2Impl,
        },
        geometry: {
          satellite_longitude_deg: satLon,
        },
        rf: {
          uplink_gt_dbk: satUplinkGt,
          downlink_eirp_dbw: satDownlinkEirp,
          uplink_impl_margin_db: uplinkImpl,
          downlink_impl_margin_db: downlinkImpl,
          uplink_interference_margin_db: uplinkIntMargin,
          downlink_interference_margin_db: downlinkIntMargin,
        },
        freqs: {
          uplink_freq_ghz: uplinkFreq,
          downlink_freq_ghz: downlinkFreq,
          noise_bandwidth_hz: noiseBwMHz * 1_000_000, // convert MHz -> Hz
        },
        modcod_margin_db: modcodMargin,
      };

      const data = await computeCni(payload);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    marginTop: "1.5rem",
    padding: "1rem 1.25rem",
    borderRadius: 10,
    background: "#020617",
    border: "1px solid #1f2937",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
    alignItems: "center",
    fontSize: "0.85rem",
  };

  const inputStyle: React.CSSProperties = {
    flex: "0 0 6rem",
    padding: "0.15rem 0.35rem",
    borderRadius: 4,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#e5e7eb",
    fontSize: "0.85rem",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.2rem 0.35rem",
    borderRadius: 4,
    border: "1px solid #4b5563",
    background: "#020617",
    color: "#e5e7eb",
    fontSize: "0.85rem",
  };

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "2rem auto",
        padding: "1.5rem",
        borderRadius: 12,
        background: "#020617",
        color: "#e5e7eb",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
      }}
    >
      <h2 style={{ marginBottom: "0.5rem" }}>GEO Bent-Pipe C/(N+I) Tool</h2>
      <p style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "1.25rem" }}>
        Computes uplink, downlink, and end-to-end C/(N+I) for a GEO bent-pipe
        link between two ground users and suggests the highest DVB-S2 MODCOD
        that fits the link margin.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* User 1 */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            User 1 (uplink)
          </h3>
          <label
            style={{
              ...labelStyle,
              marginBottom: "0.4rem",
              justifyContent: "flex-start",
            }}
          >
            <span style={{ marginRight: "0.5rem" }}>Preset:</span>
            <select
              value={user1PresetId}
              onChange={handleUser1PresetChange}
              style={selectStyle}
            >
              <option value="">None (manual)</option>
              {TERMINAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.band})
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={labelStyle}>
              Lat (deg):
              <input
                type="number"
                value={user1Location.latitude_deg}
                onChange={(e) =>
                  updateUser1Latitude(parseFloat(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Lon (deg, East+):
              <input
                type="number"
                value={user1Location.longitude_deg}
                onChange={(e) =>
                  updateUser1Longitude(parseFloat(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              EIRP (dBW):
              <input
                type="number"
                value={u1Eirp}
                onChange={(e) => setU1Eirp(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              G/T (dB/K):
              <input
                type="number"
                value={u1Gt}
                onChange={(e) => setU1Gt(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Impl. margin (dB):
              <input
                type="number"
                value={u1Impl}
                onChange={(e) => setU1Impl(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {/* Satellite RF (includes satellite longitude now) */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            Satellite RF & Geometry
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={labelStyle}>
              Satellite longitude (°E):
              <input
                type="number"
                value={satLon}
                onChange={(e) => setSatLon(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Uplink G/T (dB/K):
              <input
                type="number"
                value={satUplinkGt}
                onChange={(e) => setSatUplinkGt(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Downlink EIRP (dBW):
              <input
                type="number"
                value={satDownlinkEirp}
                onChange={(e) => setSatDownlinkEirp(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Uplink impl. margin (dB):
              <input
                type="number"
                value={uplinkImpl}
                onChange={(e) => setUplinkImpl(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Downlink impl. margin (dB):
              <input
                type="number"
                value={downlinkImpl}
                onChange={(e) => setDownlinkImpl(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Uplink intf. margin (dB):
              <input
                type="number"
                value={uplinkIntMargin}
                onChange={(e) => setUplinkIntMargin(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Downlink intf. margin (dB):
              <input
                type="number"
                value={downlinkIntMargin}
                onChange={(e) => setDownlinkIntMargin(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {/* User 2 */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            User 2 (downlink)
          </h3>
          <label
            style={{
              ...labelStyle,
              marginBottom: "0.4rem",
              justifyContent: "flex-start",
            }}
          >
            <span style={{ marginRight: "0.5rem" }}>Preset:</span>
            <select
              value={user2PresetId}
              onChange={handleUser2PresetChange}
              style={selectStyle}
            >
              <option value="">None (manual)</option>
              {TERMINAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.band})
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={labelStyle}>
              Lat (deg):
              <input
                type="number"
                value={user2Location.latitude_deg}
                onChange={(e) =>
                  updateUser2Latitude(parseFloat(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Lon (deg, East+):
              <input
                type="number"
                value={user2Location.longitude_deg}
                onChange={(e) =>
                  updateUser2Longitude(parseFloat(e.target.value))
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              G/T (dB/K):
              <input
                type="number"
                value={u2Gt}
                onChange={(e) => setU2Gt(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Impl. margin (dB):
              <input
                type="number"
                value={u2Impl}
                onChange={(e) => setU2Impl(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {/* Frequencies & MODCOD margin */}
        <div style={cardStyle}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "0.95rem" }}>
            Frequencies & MODCOD Margin
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={labelStyle}>
              Uplink freq (GHz):
              <input
                type="number"
                value={uplinkFreq}
                onChange={(e) => setUplinkFreq(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Downlink freq (GHz):
              <input
                type="number"
                value={downlinkFreq}
                onChange={(e) => setDownlinkFreq(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Noise BW (MHz):
              <input
                type="number"
                value={noiseBwMHz}
                onChange={(e) => setNoiseBwMHz(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              MODCOD margin (dB):
              <input
                type="number"
                value={modcodMargin}
                onChange={(e) => setModcodMargin(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "right" }}>
        <button
          type="submit"
          onClick={() => handleSubmit()}
          disabled={loading}
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: 6,
            border: "1px solid #38bdf8",
            background: loading ? "#0f172a" : "#0369a1",
            color: "#e5e7eb",
            fontSize: "0.9rem",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Computing..." : "Compute C/(N+I) and MODCOD"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem 0.8rem",
            borderRadius: 6,
            background: "#7f1d1d",
            fontSize: "0.85rem",
          }}
        >
          Error: {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: "1.25rem",
            padding: "1rem 1.25rem",
            borderRadius: 10,
            background: "#020617",
            border: "1px solid #1f2937",
          }}
        >
          <h3 style={{ marginBottom: "0.75rem", fontSize: "0.95rem" }}>
            Link Results
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "0.25rem 0.5rem", opacity: 0.8 }}>
                  Uplink C/N<sub>0</sub> (dBHz)
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {result.uplink_cn0_dbhz.toFixed(1)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.25rem 0.5rem", opacity: 0.8 }}>
                  Downlink C/N<sub>0</sub> (dBHz)
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {result.downlink_cn0_dbhz.toFixed(1)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.25rem 0.5rem", opacity: 0.8 }}>
                  Uplink C/(N+I) (dB)
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {result.uplink_cni_db.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.25rem 0.5rem", opacity: 0.8 }}>
                  Downlink C/(N+I) (dB)
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {result.downlink_cni_db.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.25rem 0.5rem", opacity: 0.8 }}>
                  End-to-end C/(N+I) (dB)
                </td>
                <td style={{ padding: "0.25rem 0.5rem", textAlign: "right" }}>
                  {result.total_cni_db.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {result.suggested_modcod && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
              <div>
                Suggested MODCOD:{" "}
                <strong>{result.suggested_modcod.name}</strong>
              </div>
              <div style={{ opacity: 0.85 }}>
                Required Es/N<sub>0</sub>:{" "}
                {result.suggested_modcod.required_esn0_db.toFixed(2)} dB
              </div>
              <div style={{ opacity: 0.85 }}>
                Margin vs required:{" "}
                {result.suggested_modcod.margin_db.toFixed(2)} dB (after{" "}
                {modcodMargin.toFixed(1)} dB design margin)
              </div>
            </div>
          )}

          {!result.suggested_modcod && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
              No DVB-S2 MODCOD meets the required Es/N<sub>0</sub> with the
              current C/(N+I) and margin.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
