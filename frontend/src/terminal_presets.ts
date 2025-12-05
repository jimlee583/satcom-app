// frontend/src/terminal_presets.ts

export type Band = "X" | "Ka";

export interface TerminalPreset {
  id: string;
  label: string;
  band: Band;

  // Uplink capability
  eirp_dbw_op: number; // Operating EIRP at typical OBO (dBW)

  // Receive performance (downlink) at reference elevation
  gt_dbk_20deg: number; // G/T at ~20–30 deg elevation (dB/K)

  // Typical implementation / misc margin to budget (dB)
  impl_margin_db: number;

  // Notes for you (not used in math)
  notes?: string;
}

/**
 * X- and Ka-band presets based on open-source datasheets for
 * tactical US Army-style SATCOM terminals. Values are rounded
 * to convenient engineering numbers and can be tuned.
 */
export const TERMINAL_PRESETS: TerminalPreset[] = [
  // ---------- Manpack / small terminals ----------

  {
    id: "tampa-65cm-x",
    label: "Tampa Manpack 0.65 m X-band",
    band: "X",
    eirp_dbw_op: 42, // ~43–44 dBW at P1dB, minus OBO
    gt_dbk_20deg: 12, // ~11–12 dB/K @ 30° el
    impl_margin_db: 1.0,
    notes: "Representative small manpack X-band terminal (~0.65 m).",
  },
  {
    id: "tampa-65cm-ka",
    label: "Tampa Manpack 0.65 m Ka-band",
    band: "Ka",
    eirp_dbw_op: 46, // Ka tends to be a few dB higher for same size
    gt_dbk_20deg: 15, // Ka G/T better for same dish size
    impl_margin_db: 1.0,
    notes: "Representative small manpack Ka-band terminal (~0.65 m).",
  },

  // ---------- SNAP 2.0 m class ----------

  {
    id: "snap-2m-x",
    label: "SNAP 2.0 m X-band (hub)",
    band: "X",
    eirp_dbw_op: 61, // datasheet ~62–63 dBW; assume modest OBO
    gt_dbk_20deg: 22, // datasheet ~21–22 dB/K @ 20° el
    impl_margin_db: 1.0,
    notes: "Representative transportable 2.0 m X-band terminal.",
  },
  {
    id: "snap-2m-ka",
    label: "SNAP 2.0 m Ka-band (hub)",
    band: "Ka",
    eirp_dbw_op: 64, // datasheet ~65–66 dBW; assume some OBO
    gt_dbk_20deg: 27, // datasheet ~27–28 dB/K @ 20° el
    impl_margin_db: 1.0,
    notes: "Representative transportable 2.0 m Ka-band terminal.",
  },

  // ---------- STT / large node class ----------

  {
    id: "stt-x",
    label: "STT-type X-band hub (2.4–2.5 m)",
    band: "X",
    eirp_dbw_op: 70, // large hub terminal, 200 W class, high gain
    gt_dbk_20deg: 24,
    impl_margin_db: 1.0,
    notes: "Representative large X-band hub with ~2.4–2.5 m aperture.",
  },
  {
    id: "stt-ka",
    label: "STT-type Ka-band hub (2.4–2.5 m)",
    band: "Ka",
    eirp_dbw_op: 74, // datasheet Ka EIRP often mid-70s dBW
    gt_dbk_20deg: 28,
    impl_margin_db: 1.0,
    notes: "Representative large Ka-band hub terminal.",
  },

  // ---------- Airborne ----------

  {
    id: "airborne-18in-ka",
    label: "Airborne 18-inch Ka-band (USAF)",
    band: "Ka",
    eirp_dbw_op: 52, // Typical for ~46cm airborne terminal (e.g. Viasat GAT-5518 class)
    gt_dbk_20deg: 14, // ~13-15 dB/K
    impl_margin_db: 1.5, // Higher margin for radome loss
    notes: "Representative USAF airborne terminal (e.g. C-130/UAV), ~18in/46cm dish.",
  },

  // ---------- Gateways (Commercial / Teleport) ----------

  {
    id: "gateway-7m-x",
    label: "Commercial Gateway 7.3m X-band",
    band: "X",
    eirp_dbw_op: 80, // Large HPA + high gain
    gt_dbk_20deg: 33, // ~33-35 dB/K typical for 7.3m
    impl_margin_db: 0.5, // Fixed station, well calibrated
    notes: "Large fixed commercial X-band gateway (Teleport class, ~7.3m).",
  },
  {
    id: "gateway-7m-ka",
    label: "Commercial Gateway 7.3m Ka-band",
    band: "Ka",
    eirp_dbw_op: 85, // High power gateway
    gt_dbk_20deg: 38, // ~37-40 dB/K typical for 7.3m
    impl_margin_db: 0.5,
    notes: "Large fixed commercial Ka-band gateway (Teleport class, ~7.3m).",
  },
];
