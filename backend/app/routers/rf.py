from math import radians, cos, sqrt, log10
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/rf", tags=["rf"])


# ---------- Basic models ----------

class Location(BaseModel):
    latitude_deg: float = Field(..., description="Geodetic latitude of the ground terminal (deg)")
    longitude_deg: float = Field(..., description="Longitude of the ground terminal (deg, East positive)")


class GroundTerminal(BaseModel):
    location: Location
    eirp_dbw: float = Field(..., description="Uplink EIRP toward satellite (dBW)")
    gt_dbk: float = Field(..., description="Downlink G/T of the ground terminal (dB/K)")
    npr_db: float = Field(
        100.0,
        description="Noise Power Ratio (dB) for interference/intermod (treated as C/I)"
    )


class LinkGeometry(BaseModel):
    satellite_longitude_deg: float = Field(
        ..., description="GEO satellite longitude in degrees East (sat at equator)"
    )


class LinkFrequencies(BaseModel):
    uplink_freq_ghz: float = Field(..., description="Uplink RF frequency (GHz)")
    downlink_freq_ghz: float = Field(..., description="Downlink RF frequency (GHz)")
    noise_bandwidth_hz: float = Field(
        ...,
        description="Noise bandwidth (Hz) for C/N and C/(N+I) calculations"
    )


class SatelliteRF(BaseModel):
    uplink_gt_dbk: float = Field(
        ...,
        description="Satellite receive G/T on uplink (dB/K)"
    )
    downlink_eirp_dbw: float = Field(
        ...,
        description="Satellite transmit EIRP toward user 2 on downlink (dBW)"
    )
    uplink_impl_margin_db: float = Field(
        0.0, description="Additional uplink implementation margin (dB)"
    )
    downlink_impl_margin_db: float = Field(
        0.0, description="Additional downlink implementation margin (dB)"
    )
    npr_db: float = Field(
        100.0,
        description="Satellite NPR (dB) contributing to downlink C/I"
    )


class CniRequest(BaseModel):
    """End-to-end GEO bent-pipe link: user1 -> satellite -> user2."""
    user1: GroundTerminal
    user2: GroundTerminal
    geometry: LinkGeometry
    rf: SatelliteRF
    freqs: LinkFrequencies
    modcod_margin_db: float = Field(
        1.0,
        description="Design margin (dB) to subtract from C/(N+I) before picking MODCOD"
    )


# ---------- MODCOD table & response ----------

class ModcodInfo(BaseModel):
    name: str
    required_esn0_db: float
    margin_db: float


class CniResponse(BaseModel):
    uplink_cni_db: float
    downlink_cni_db: float
    total_cni_db: float
    uplink_cn0_dbhz: float
    downlink_cn0_dbhz: float
    suggested_modcod: Optional[ModcodInfo]


# DVB-S2 MODCOD ideal Es/N0 thresholds in AWGN (FECFRAME 64800, no pilots).
# Numbers from ETSI EN 302 307-1 Table 13 (rounded to 2 decimal places). :contentReference[oaicite:2]{index=2}
DVB_S2_MODCODS = [
    # QPSK
    ("QPSK 1/4", -2.35),
    ("QPSK 1/3", -1.24),
    ("QPSK 2/5", -0.30),
    ("QPSK 1/2", 1.00),
    ("QPSK 3/5", 2.23),
    ("QPSK 2/3", 3.10),
    ("QPSK 3/4", 4.03),
    ("QPSK 4/5", 4.68),
    ("QPSK 5/6", 5.18),
    ("QPSK 8/9", 6.20),
    ("QPSK 9/10", 6.42),
    # 8PSK
    ("8PSK 3/5", 5.50),
    ("8PSK 2/3", 6.62),
    ("8PSK 3/4", 7.91),
    ("8PSK 5/6", 9.35),
    ("8PSK 8/9", 10.69),
    ("8PSK 9/10", 10.98),
    # 16APSK
    ("16APSK 2/3", 8.97),
    ("16APSK 3/4", 10.21),
    ("16APSK 4/5", 11.03),
    ("16APSK 5/6", 11.61),
    ("16APSK 8/9", 12.89),
    ("16APSK 9/10", 13.13),
    # 32APSK
    ("32APSK 3/4", 12.73),
    ("32APSK 4/5", 13.64),
    ("32APSK 5/6", 14.28),
    ("32APSK 8/9", 15.69),
    ("32APSK 9/10", 16.05),
]


# ---------- Utility functions ----------

def geo_slant_range_km(
    ground_lat_deg: float,
    ground_lon_deg: float,
    sat_lon_deg: float,
    re_km: float = 6378.0,
    rs_km: float = 42164.0,
) -> float:
    """
    Approximate GEO slant range using spherical geometry.

    Satellite is at (lat=0, lon=sat_lon).
    """
    phi = radians(ground_lat_deg)
    dlon = radians(ground_lon_deg - sat_lon_deg)

    cos_psi = cos(phi) * cos(dlon)
    # Law of cosines between Earth center, ground point, satellite
    r2 = re_km**2 + rs_km**2 - 2.0 * re_km * rs_km * cos_psi
    return sqrt(max(r2, 0.0))


def fspl_db(distance_km: float, freq_ghz: float) -> float:
    """
    Free-space path loss in dB, distance in km, frequency in GHz.

    Lfs = 92.45 + 20 log10(d_km) + 20 log10(f_GHz)
    """
    return 92.45 + 20.0 * log10(distance_km) + 20.0 * log10(freq_ghz)


def cn0_dbhz_from_eirp_gt(
    eirp_dbw: float,
    gt_dbk: float,
    fspl_db_val: float,
    extra_losses_db: float = 0.0,
) -> float:
    """
    Compute C/N0 in dBHz from EIRP, G/T and path loss.

    C/N0 (dBHz) = EIRP(dBW) + G/T(dB/K) - Lfs(dB) - extra_losses + 228.6
    (10*log10(k) ≈ -228.6 dBW/K/Hz).
    """
    return eirp_dbw + gt_dbk - fspl_db_val - extra_losses_db + 228.6


def cn_db_from_cn0(cn0_dbhz: float, noise_bw_hz: float) -> float:
    """
    C/N (dB) given C/N0 (dBHz) and noise bandwidth (Hz).
    """
    return cn0_dbhz - 10.0 * log10(noise_bw_hz)


def combine_cn_linear(cn1_db: float, cn2_db: float) -> float:
    """
    Combine two independent noise contributions (uplink, downlink)
    into an end-to-end C/N.

    1/(C/N)_total = 1/(C/N)_1 + 1/(C/N)_2 (in linear).
    """
    cn1_lin = 10.0 ** (cn1_db / 10.0)
    cn2_lin = 10.0 ** (cn2_db / 10.0)

    total_lin = 1.0 / (1.0 / cn1_lin + 1.0 / cn2_lin)
    return 10.0 * log10(total_lin)


def pick_best_modcod(
    available_esn0_db: float,
) -> Optional[ModcodInfo]:
    """
    Given an available Es/N0 (approx. using C/(N+I)), pick the highest
    DVB-S2 MODCOD whose required Es/N0 is <= available_esn0_db.
    """
    best: Optional[ModcodInfo] = None
    for name, required in DVB_S2_MODCODS:
        if available_esn0_db >= required:
            best = ModcodInfo(
                name=name,
                required_esn0_db=required,
                margin_db=available_esn0_db - required,
            )
    return best


# ---------- Endpoint ----------

@router.post("/cni", response_model=CniResponse)
async def compute_cni(req: CniRequest) -> CniResponse:
    """
    Compute uplink, downlink, and end-to-end C/(N+I) for a bent-pipe GEO link:
    user1 -> satellite -> user2.

    Simplifications:
      * Spherical Earth + fixed GEO radius
      * No rain/fade/model-specific losses (beyond supplied margins)
      * Treats C/(N+I) ≈ C/N for MODCOD selection
    """

    # --- Geometry & FSPL ---

    d_uplink_km = geo_slant_range_km(
        ground_lat_deg=req.user1.location.latitude_deg,
        ground_lon_deg=req.user1.location.longitude_deg,
        sat_lon_deg=req.geometry.satellite_longitude_deg,
    )
    d_downlink_km = geo_slant_range_km(
        ground_lat_deg=req.user2.location.latitude_deg,
        ground_lon_deg=req.user2.location.longitude_deg,
        sat_lon_deg=req.geometry.satellite_longitude_deg,
    )

    fspl_uplink_db = fspl_db(d_uplink_km, req.freqs.uplink_freq_ghz)
    fspl_downlink_db = fspl_db(d_downlink_km, req.freqs.downlink_freq_ghz)

    # --- Uplink C/N0 and C/(N+I) ---

    uplink_extra_losses = req.rf.uplink_impl_margin_db

    cn0_uplink_dbhz = cn0_dbhz_from_eirp_gt(
        eirp_dbw=req.user1.eirp_dbw,
        gt_dbk=req.rf.uplink_gt_dbk,
        fspl_db_val=fspl_uplink_db,
        extra_losses_db=uplink_extra_losses,
    )
    cn_uplink_db = cn_db_from_cn0(cn0_uplink_dbhz, req.freqs.noise_bandwidth_hz)

    # Apply interference / OBO margin on uplink
    # Treat User 1 NPR as uplink C/I
    cni_uplink_db = combine_cn_linear(cn_uplink_db, req.user1.npr_db)

    # --- Downlink C/N0 and C/(N+I) ---

    downlink_extra_losses = req.rf.downlink_impl_margin_db

    cn0_downlink_dbhz = cn0_dbhz_from_eirp_gt(
        eirp_dbw=req.rf.downlink_eirp_dbw,
        gt_dbk=req.user2.gt_dbk,
        fspl_db_val=fspl_downlink_db,
        extra_losses_db=downlink_extra_losses,
    )
    cn_downlink_db = cn_db_from_cn0(cn0_downlink_dbhz, req.freqs.noise_bandwidth_hz)

    # Treat Satellite RF NPR as downlink C/I
    cni_downlink_db = combine_cn_linear(cn_downlink_db, req.rf.npr_db)

    # --- End-to-end C/(N+I) ---

    total_cni_db = combine_cn_linear(cni_uplink_db, cni_downlink_db)

    # For a first cut, approximate Es/N0 ≈ C/(N+I) (dB) for MODCOD selection.
    available_esn0_db = total_cni_db - req.modcod_margin_db
    best_modcod = pick_best_modcod(available_esn0_db)

    return CniResponse(
        uplink_cni_db=cni_uplink_db,
        downlink_cni_db=cni_downlink_db,
        total_cni_db=total_cni_db,
        uplink_cn0_dbhz=cn0_uplink_dbhz,
        downlink_cn0_dbhz=cn0_downlink_dbhz,
        suggested_modcod=best_modcod,
    )
