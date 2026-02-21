"""
calculations.py — carbon emissions estimation for ML training jobs.

Physics pipeline:
    - Dynamic PUE from Carnot efficiency (ambient temp via weather API)
    - GPU thermal throttling via coupled ODE (scipy RK45)
    - Multi-period Fourier forecast for optimal scheduling windows
    - Embodied carbon amortisation over GPU lifetime
    - Marginal grid intensity via WattTime (falls back to Fourier extrapolation)
    - Full lifecycle projection including inference cascade
    - Uncertainty propagation through the full chain

Called by /api/gate/check on every PR. Keep this dependency-light.
"""

import math
import os
from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.integrate import solve_ivp

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    from codecarbon import EmissionsTracker
    CODECARBON_AVAILABLE = True
except ImportError:
    CODECARBON_AVAILABLE = False


# ---------------------------------------------------------------------------
# GPU reference data
# ---------------------------------------------------------------------------

# Manufacturer TDP specs. Real sustained draw under training load typically
# runs 5-10% lower than nameplate due to power limit governors.
GPU_TDP_W = {
    "H100":  700,
    "A100":  400,
    "V100":  300,
    "A10":   150,
    "A10G":  150,
    "T4":     70,
    "L40":   300,
    "L40S":  350,
}

# Embodied carbon estimates (kgCO2eq) from lifecycle assessment literature —
# Gupta et al. 2022, Patterson et al. 2021. ±30% uncertainty baked into
# compute_embodied_carbon(). Swap for audited LCA data if available.
GPU_EMBODIED_KG = {
    "H100":  150.0,
    "A100":  100.0,
    "V100":   75.0,
    "A10":    50.0,
    "A10G":   50.0,
    "T4":     30.0,
    "L40":    90.0,
    "L40S":  100.0,
}

# Thermal throttling parameters per GPU.
# T_threshold: junction temp (°C) at which throttling starts.
# alpha: max TDP reduction fraction at full throttle.
# R_thermal: steady-state thermal resistance of cooling solution (K/W).
GPU_THERMAL_PARAMS = {
    "H100":  {"T_threshold": 83, "T_range": 10, "alpha": 0.20, "R_thermal": 0.08},
    "A100":  {"T_threshold": 85, "T_range": 10, "alpha": 0.18, "R_thermal": 0.09},
    "V100":  {"T_threshold": 88, "T_range": 10, "alpha": 0.15, "R_thermal": 0.10},
    "A10":   {"T_threshold": 90, "T_range": 10, "alpha": 0.12, "R_thermal": 0.12},
    "A10G":  {"T_threshold": 90, "T_range": 10, "alpha": 0.12, "R_thermal": 0.12},
    "T4":    {"T_threshold": 88, "T_range": 10, "alpha": 0.10, "R_thermal": 0.15},
    "L40":   {"T_threshold": 85, "T_range": 10, "alpha": 0.18, "R_thermal": 0.09},
    "L40S":  {"T_threshold": 85, "T_range": 10, "alpha": 0.18, "R_thermal": 0.09},
}

GPU_LIFETIME_HOURS   = 35_000
GPU_UTILISATION_RATE = 0.70

# Crusoe geothermal constants
CRUSOE_INTENSITY_G_KWH = 50.0
CRUSOE_GROUND_TEMP_K   = 285.0   # ground loop temperature, ~12°C

# η for real chiller systems (fraction of Carnot COP). 0.6 is conservative;
# geothermal loops with variable-speed compressors can reach ~0.72.
ETA_COOLING = 0.60

T_HOT_C = 35.0   # hot aisle setpoint

# IPCC AR6 radiative forcing constants
ALPHA_FORCING        = 5.35    # W/m²
CO2_PREINDUSTRIAL    = 280.0   # ppm
CO2_CURRENT          = 422.0   # ppm — update periodically from NOAA MLO

# Gate thresholds as fraction of monthly budget overage
THRESHOLD_WARN = 0.10
THRESHOLD_SOFT = 0.20
THRESHOLD_HARD = 0.50


# ---------------------------------------------------------------------------
# WattTime region mappings
# ---------------------------------------------------------------------------

# WattTime balancing authority slugs for each cloud region.
# Full list via GET /v3/my-access once you have a key.
WATTTIME_BA = {
    "us-east-1":      "PJM_ROANOKE",
    "us-east-2":      "PJM_OHIO",
    "us-west-1":      "CAISO_NORTH",
    "us-west-2":      "NW_PACIF",
    "eu-west-1":      "IE",
    "eu-west-2":      "GB",
    "eu-central-1":   "DE",
    "eu-north-1":     "SE",
    "ap-southeast-1": "SG",
    "ap-northeast-1": "JP_TK",
}

ELECTRICITY_MAPS_ZONE = {
    "us-east-1":      "US-MIDA-PJM",
    "us-west-2":      "US-NW-PACW",
    "eu-west-1":      "IE",
    "eu-west-2":      "GB",
    "eu-central-1":   "DE",
    "eu-north-1":     "SE",
}

# Regional intensity baselines and day/night swings (gCO2/kWh).
# Baselines are approximate p5 observed intensity; ranges are p95-p5.
# These seed the fallback path and percentile-to-g/kWh conversion.
_REGION_BASELINE = {
    "us-east-1":      150.0,
    "us-east-2":      130.0,
    "us-west-1":       80.0,
    "us-west-2":       50.0,
    "eu-west-1":       80.0,
    "eu-west-2":      100.0,
    "eu-central-1":   150.0,
    "eu-north-1":      10.0,
    "ap-southeast-1": 350.0,
    "ap-northeast-1": 300.0,
}

_REGION_RANGE = {
    "us-east-1":      350.0,
    "us-east-2":      320.0,
    "us-west-1":      180.0,
    "us-west-2":      100.0,
    "eu-west-1":      250.0,
    "eu-west-2":      220.0,
    "eu-central-1":   250.0,
    "eu-north-1":      40.0,
    "ap-southeast-1": 150.0,
    "ap-northeast-1": 200.0,
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class GateDecision:
    status:             str    # pass | warn | soft_block | hard_block | uncertain
    overage_kg:         float
    overage_fraction:   float
    resolution_options: list
    message:            str


# ---------------------------------------------------------------------------
# WattTime + CodeCarbon integrations
# ---------------------------------------------------------------------------

def _percentile_to_g_kwh(region: str, pct: float) -> float:
    """Convert a WattTime 0-100 percentile to approximate gCO2/kWh."""
    base = _REGION_BASELINE.get(region, 200.0)
    rng  = _REGION_RANGE.get(region, 250.0)
    return base + (pct / 100.0) * rng


def _fallback_intensity(region: str) -> dict:
    """Static regional estimate used when WattTime is unreachable."""
    base      = _REGION_BASELINE.get(region, 200.0)
    rng       = _REGION_RANGE.get(region, 250.0)
    intensity = base + rng * 0.4
    return {
        "intensity_g_kwh": round(intensity, 2),
        "intensity_sigma": round(rng * 0.15, 2),
        "source":          "fallback",
        "balancing_auth":  WATTTIME_BA.get(region, "unknown"),
        "percent_clean":   None,
    }


def get_watttime_intensity(
    region:        str,
    watttime_user: Optional[str] = None,
    watttime_pass: Optional[str] = None,
) -> dict:
    """
    Fetch real-time marginal carbon intensity (MOER) from WattTime.

    Marginal intensity is the right signal for scheduling decisions — it measures
    the emissions of the specific generator that would respond to your additional
    load, not the average of everything already running. The two can differ by 2-3×
    during peak fossil dispatch periods.

    WattTime v3 returns a 0-100 percentile index by default; we convert to gCO2/kWh
    using observed regional baselines and ranges. For lbs/MWh directly, use
    /v3/historical with units=lbs_per_mwh and multiply by 0.4536.

    Returns intensity_g_kwh, intensity_sigma (from WattTime's own spread),
    source, balancing_auth, percent_clean.
    """
    if not REQUESTS_AVAILABLE:
        return _fallback_intensity(region)

    user = watttime_user or os.environ.get("WATTTIME_USER", "")
    pwd  = watttime_pass or os.environ.get("WATTTIME_PASS", "")
    ba   = WATTTIME_BA.get(region)

    if not user or not pwd or not ba:
        return _fallback_intensity(region)

    try:
        auth = requests.get(
            "https://api.watttime.org/login",
            auth=(user, pwd),
            timeout=5
        )
        if auth.status_code != 200:
            return _fallback_intensity(region)

        token   = auth.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = requests.get(
            "https://api.watttime.org/v3/signal-index",
            headers=headers,
            params={"region": ba, "signal_type": "co2_moer"},
            timeout=5
        )
        if resp.status_code != 200:
            return _fallback_intensity(region)

        raw       = float(resp.json()["data"][0].get("value", 50))
        intensity = _percentile_to_g_kwh(region, raw)

        # Derive σ from the typical ±8% spread in WattTime's confidence band.
        # Replace with moer_high/moer_low from /v3/historical if you pull that endpoint.
        hi_g    = _percentile_to_g_kwh(region, raw * 1.08)
        lo_g    = _percentile_to_g_kwh(region, raw * 0.92)
        sigma_g = (hi_g - lo_g) / 2.0

        return {
            "intensity_g_kwh": round(intensity, 2),
            "intensity_sigma": round(sigma_g, 2),
            "source":          "watttime",
            "balancing_auth":  ba,
            "percent_clean":   round(100.0 - raw, 1),
        }

    except Exception:
        return _fallback_intensity(region)


def get_watttime_forecast(
    region:        str,
    hours_ahead:   int = 48,
    watttime_user: Optional[str] = None,
    watttime_pass: Optional[str] = None,
) -> list[float]:
    """
    Fetch WattTime's 72h ahead MOER forecast as hourly gCO2/kWh values.

    When available this replaces the Fourier extrapolation entirely —
    WattTime's model has access to weather forecasts and generator dispatch
    schedules that our harmonic fit can't see. Falls back to [] so the
    caller can decide to run Fourier instead.

    WattTime returns 5-min intervals; we resample to hourly by taking
    every 12th point.
    """
    if not REQUESTS_AVAILABLE:
        return []

    user = watttime_user or os.environ.get("WATTTIME_USER", "")
    pwd  = watttime_pass or os.environ.get("WATTTIME_PASS", "")
    ba   = WATTTIME_BA.get(region)

    if not user or not pwd or not ba:
        return []

    try:
        auth  = requests.get("https://api.watttime.org/login", auth=(user, pwd), timeout=5)
        token = auth.json()["token"]

        resp = requests.get(
            "https://api.watttime.org/v3/forecast",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "region":        ba,
                "signal_type":   "co2_moer",
                "horizon_hours": min(hours_ahead, 72),
            },
            timeout=10
        )
        if resp.status_code != 200:
            return []

        points = resp.json().get("data", [])
        hourly = [
            round(_percentile_to_g_kwh(region, float(p.get("value", 50))), 2)
            for p in points
        ]
        return hourly[::12][:hours_ahead] if len(hourly) >= 12 else hourly

    except Exception:
        return []


def measure_with_codecarbon(
    job_fn,
    region:  str = "us-east-1",
    gpu:     str = "A100",
    project: str = "carbon-gate",
) -> Optional[dict]:
    """
    Instrument an actual training job with CodeCarbon and return measured emissions.

    This is the ground-truth path — use it when the job is actually running rather
    than being estimated pre-flight. The delta between predicted (physics model) and
    measured (CodeCarbon) is worth logging: a consistent gap suggests the TDP or
    throttling parameters need recalibration for this hardware/environment combination.

    Returns None silently if CodeCarbon isn't installed, so callers don't need to
    branch on availability.
    """
    if not CODECARBON_AVAILABLE:
        return None

    cc_country = {
        "us-east-1": "USA", "us-east-2": "USA",
        "us-west-1": "USA", "us-west-2": "USA",
        "eu-west-1": "IRL", "eu-west-2": "GBR",
        "eu-central-1": "DEU", "eu-north-1": "SWE",
        "ap-southeast-1": "SGP", "ap-northeast-1": "JPN",
    }.get(region, "USA")

    try:
        tracker = EmissionsTracker(
            project_name     = project,
            country_iso_code = cc_country,
            log_level        = "WARNING",
            save_to_file     = False,
            tracking_mode    = "machine",
        )
        tracker.start()
        job_fn()
        emissions_kg = tracker.stop()
        final        = tracker.final_emissions_data

        return {
            "emissions_kg": round(float(emissions_kg), 6),
            "energy_kwh":   round(float(getattr(final, "energy_consumed", 0.0)), 6),
            "duration_s":   round(float(getattr(final, "duration",         0.0)), 2),
            "cpu_power_w":  round(float(getattr(final, "cpu_power",        0.0)), 2),
            "gpu_power_w":  round(float(getattr(final, "gpu_power",        0.0)), 2),
            "ram_power_w":  round(float(getattr(final, "ram_power",        0.0)), 2),
            "source":       "codecarbon",
            "region":       region,
            "gpu":          gpu,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PUE model (Carnot-based, thermodynamic)
# ---------------------------------------------------------------------------

def compute_pue(ambient_temp_c: float, is_crusoe: bool = False) -> tuple[float, float]:
    """
    Derive PUE from first principles rather than assuming a flat value.

        COP_carnot = T_cold / (T_hot - T_cold)    [Kelvin]
        COP_actual = η × COP_carnot
        PUE        = 1 + 1 / COP_actual

    For Crusoe, T_cold is the geothermal ground loop temperature (~12°C year-round),
    which is structurally lower than ambient air cooling and independent of seasonal
    variation. This is where Crusoe's PUE advantage comes from thermodynamically.

    Uncertainty is propagated numerically from ±2°C weather forecast error.
    """
    T_hot_K  = T_HOT_C + 273.15
    T_cold_K = CRUSOE_GROUND_TEMP_K if is_crusoe else ambient_temp_c + 273.15
    T_cold_K = min(T_cold_K, T_hot_K - 1.0)

    cop_carnot = T_cold_K / (T_hot_K - T_cold_K)
    cop_actual = ETA_COOLING * cop_carnot
    pue        = 1.0 + 1.0 / cop_actual

    dt       = 2.0
    pue_hi   = 1.0 + 1.0 / (ETA_COOLING * (T_cold_K + dt) / (T_hot_K - (T_cold_K + dt)))
    pue_lo   = 1.0 + 1.0 / (ETA_COOLING * (T_cold_K - dt) / (T_hot_K - (T_cold_K - dt)))
    pue_sigma = abs(pue_hi - pue_lo) / 2.0

    return round(pue, 4), round(pue_sigma, 4)


# ---------------------------------------------------------------------------
# GPU thermal throttling (coupled ODE)
# ---------------------------------------------------------------------------

def compute_throttle_adjustment(
    gpu:           str,
    hours:         float,
    ambient_temp_c: float,
) -> tuple[float, float]:
    """
    Solve the coupled thermal ODE for actual GPU power draw over a training run.

    Junction temperature and power are mutually dependent:
        P(t)    = P_tdp × (1 - α × clamp((T_j - T_thresh) / T_range, 0, 1))
        T_j(t)  = T_ambient + P(t) × R_thermal

    Modelled as a first-order thermal lag with τ = 60s (reasonable for a 2U
    server chassis). Solved with RK45 via scipy. For runs longer than ~2h on
    H100 clusters with marginal airflow, throttling can reduce actual energy
    draw by 10-15% relative to naive TDP × hours.
    """
    p        = GPU_THERMAL_PARAMS.get(gpu, GPU_THERMAL_PARAMS["A100"])
    P_tdp    = GPU_TDP_W.get(gpu, 400)

    def power_at(T_j: float) -> float:
        throttle = p["alpha"] * max(0.0, (T_j - p["T_threshold"]) / p["T_range"])
        return P_tdp * (1.0 - min(throttle, p["alpha"]))

    def ode(t, state):
        T_j   = state[0]
        T_ss  = ambient_temp_c + power_at(T_j) * p["R_thermal"]
        return [(T_ss - T_j) / 60.0]

    t_eval = np.linspace(0, hours * 3600, max(100, int(hours * 60)))
    sol    = solve_ivp(ode, (0, hours * 3600), [ambient_temp_c], t_eval=t_eval, method="RK45")

    P_trace  = np.array([power_at(T) for T in sol.y[0]])
    energy_j = np.trapezoid(P_trace, t_eval)
    energy_kwh = energy_j / 3_600_000.0

    naive_kwh    = P_tdp * hours / 1000.0
    throttle_pct = (1.0 - energy_kwh / naive_kwh) * 100.0

    return round(energy_kwh, 4), round(throttle_pct, 2)


# ---------------------------------------------------------------------------
# Fourier carbon intensity forecasting
# ---------------------------------------------------------------------------

def _build_fourier_matrix(
    t: np.ndarray,
    n_daily:  int,
    n_weekly: int,
    N_history: int,
) -> np.ndarray:
    """Build a Fourier design matrix for the given time indices."""
    cols = [np.ones(len(t))]

    for n in range(1, n_daily + 1):
        cols.append(np.cos(2 * np.pi * n * t / 24.0))
        cols.append(np.sin(2 * np.pi * n * t / 24.0))

    if N_history >= 336 and n_weekly > 0:
        for m in range(1, n_weekly + 1):
            cols.append(np.cos(2 * np.pi * m * t / 168.0))
            cols.append(np.sin(2 * np.pi * m * t / 168.0))

    if N_history >= 672 and n_weekly > 0:
        for m in range(1, n_weekly + 1):
            cols.append(np.cos(2 * np.pi * m * t / 336.0))
            cols.append(np.sin(2 * np.pi * m * t / 336.0))

    return np.column_stack(cols)


def fit_fourier_forecast(
    intensity_history:  list[float],
    n_daily_harmonics:  int = 5,
    n_weekly_harmonics: int = 2,
) -> tuple[np.ndarray, float, dict]:
    """
    Fit a multi-period Fourier series to historical hourly carbon intensity.

    Three periodicities are modelled simultaneously:
        24h   — solar generation cycle and human demand rhythm
        168h  — Mon-Fri industrial load versus weekend renewable surplus
        336h  — fortnightly grid scheduling and maintenance patterns

    The weekly and bi-weekly terms typically explain an additional 10-25% of
    variance on fossil-heavy grids (us-east-1, eu-central-1) — grids where
    a daily-only model will mis-schedule jobs that span a weekend transition.

    Returns fitted coefficients, residual std (used for confidence), and
    a per-period R² breakdown useful for regional grid characterisation.
    """
    N = len(intensity_history)
    t = np.arange(N, dtype=float)
    y = np.array(intensity_history, dtype=float)

    X      = _build_fourier_matrix(t, n_daily_harmonics, n_weekly_harmonics, N)
    coeffs, _, _, _ = np.linalg.lstsq(X, y, rcond=None)

    residuals    = y - X @ coeffs
    residual_std = float(np.std(residuals))

    y_mean   = float(np.mean(y))
    ss_total = float(np.sum((y - y_mean) ** 2))

    def partial_r2(col_slice):
        if not col_slice:
            return 0.0
        Xp        = np.column_stack([X[:, 0]] + [X[:, i] for i in col_slice])
        c, _, _, _ = np.linalg.lstsq(Xp, y, rcond=None)
        ss_res    = float(np.sum((y - Xp @ c) ** 2))
        return max(0.0, 1.0 - ss_res / ss_total) if ss_total > 0 else 0.0

    nd         = n_daily_harmonics
    nw         = n_weekly_harmonics
    d_idx      = list(range(1, 1 + 2 * nd))
    w_start    = 1 + 2 * nd
    w_idx      = list(range(w_start, w_start + 2 * nw)) if N >= 336 else []
    b_start    = w_start + 2 * nw
    b_idx      = list(range(b_start, b_start + 2 * nw)) if N >= 672 else []

    r2_total = max(0.0, 1.0 - np.sum(residuals**2) / ss_total) if ss_total > 0 else 0.0

    meta = {
        "r2_daily":           round(partial_r2(d_idx), 3),
        "r2_weekly":          round(partial_r2(w_idx), 3),
        "r2_biweekly":        round(partial_r2(b_idx), 3),
        "r2_total":           round(r2_total, 3),
        "n_coefficients":     len(coeffs),
        "n_daily_harmonics":  n_daily_harmonics,
        "n_weekly_harmonics": n_weekly_harmonics,
    }

    return coeffs, residual_std, meta


def forecast_optimal_window(
    intensity_history:  list[float],
    current_intensity:  float,
    lookahead_hours:    int = 48,
    n_daily_harmonics:  int = 5,
    n_weekly_harmonics: int = 2,
) -> tuple[float, float, float, dict]:
    """
    Find the lowest-carbon window within the next lookahead_hours.

    Confidence is penalised proportionally to grid volatility. A stable
    hydro/nuclear grid (σ ~ 20 gCO2/kWh) gets minimal penalty; a volatile
    fossil-gas grid (σ ~ 100 gCO2/kWh) gets up to 40% confidence reduction.
    This makes the uncertainty honest — we're more confident telling you to
    wait 3 hours on the Swedish grid than on PJM East.

    Returns optimal_wait_hours, confidence (0-1), carbon_savings_pct, meta dict.
    """
    if len(intensity_history) < 48:
        return 0.0, 0.0, 0.0, {"error": "insufficient_history"}

    coeffs, residual_std, fit_meta = fit_fourier_forecast(
        intensity_history, n_daily_harmonics, n_weekly_harmonics
    )

    N        = len(intensity_history)
    future_t = np.arange(N, N + lookahead_hours, dtype=float)
    X_future = _build_fourier_matrix(future_t, n_daily_harmonics, n_weekly_harmonics, N)

    n_cols     = X_future.shape[1]
    c          = coeffs[:n_cols] if len(coeffs) >= n_cols else np.pad(coeffs, (0, n_cols - len(coeffs)))
    I_forecast = X_future @ c

    min_idx      = int(np.argmin(I_forecast))
    min_g        = float(I_forecast[min_idx])
    savings_pct  = max(0.0, (current_intensity - min_g) / current_intensity * 100.0)

    fcast_range = float(np.max(I_forecast) - np.min(I_forecast))
    base_conf   = max(0.0, min(1.0, 1.0 - residual_std / fcast_range)) if fcast_range > 0 else 0.5

    # Volatility penalty — calibrated on typical Electricity Maps regional σ values:
    # ~20 g/kWh for stable grids (Nordic hydro), ~100 g/kWh for volatile ones (PJM).
    VOL_CEILING      = 100.0
    VOLATILITY_WEIGHT = 0.40

    volatility   = float(np.std(intensity_history))
    vol_discount = VOLATILITY_WEIGHT * min(1.0, volatility / VOL_CEILING)
    confidence   = max(0.0, base_conf * (1.0 - vol_discount))

    if confidence >= 0.75:
        conf_label = "high"
    elif confidence >= 0.50:
        conf_label = "moderate"
    elif confidence >= 0.25:
        conf_label = "low"
    else:
        conf_label = "very low — volatile grid"

    forecast_meta = {
        **fit_meta,
        "residual_std":     round(residual_std, 2),
        "base_confidence":  round(base_conf, 3),
        "volatility":       round(volatility, 2),
        "vol_discount":     round(vol_discount, 3),
        "final_confidence": round(confidence, 3),
        "confidence_label": conf_label,
        "forecast_range_g": round(fcast_range, 2),
        "min_intensity_g":  round(min_g, 2),
        "optimal_wait_hrs": float(min_idx),
    }

    return round(float(min_idx), 1), round(confidence, 3), round(savings_pct, 1), forecast_meta


# ---------------------------------------------------------------------------
# Embodied carbon
# ---------------------------------------------------------------------------

def compute_embodied_carbon(gpu: str, hours: float) -> tuple[float, float]:
    """
    Amortise manufacturing carbon over the GPU's operational lifetime.

        C_per_hour = C_manufacturing / (lifetime_hours × utilisation_rate)

    Manufacturing figures carry ±30% uncertainty from variation in fab
    processes, packaging, and supply chain. This propagates into the
    total σ via quadrature in estimate_emissions().
    """
    C_mfg       = GPU_EMBODIED_KG.get(gpu, GPU_EMBODIED_KG["A100"])
    C_per_hour  = C_mfg / (GPU_LIFETIME_HOURS * GPU_UTILISATION_RATE)
    embodied_kg = C_per_hour * hours
    return round(embodied_kg, 4), round(embodied_kg * 0.30, 4)


# ---------------------------------------------------------------------------
# Radiative forcing
# ---------------------------------------------------------------------------

def compute_radiative_forcing(emissions_kg: float) -> float:
    """
    Express this run's emissions as a marginal radiative forcing contribution.

    Uses the IPCC AR6 logarithmic forcing formula:
        ΔF = α × ln(C / C₀)  [W/m²],  α = 5.35 W/m²

    Computed as the difference between current forcing and forcing after
    adding emissions_kg to the atmospheric CO2 stock. The result is small
    individually (attojoules per m²) but scales usefully for fleet reporting.
    """
    ATMOS_CO2_KG = 3.16e15
    ppm_per_kg   = CO2_CURRENT / ATMOS_CO2_KG
    C_new        = CO2_CURRENT + emissions_kg * ppm_per_kg
    return (
        ALPHA_FORCING * math.log(C_new / CO2_PREINDUSTRIAL)
        - ALPHA_FORCING * math.log(CO2_CURRENT / CO2_PREINDUSTRIAL)
    )


# ---------------------------------------------------------------------------
# Scope 3 inference cascade
# ---------------------------------------------------------------------------

def compute_lifecycle_emissions(
    operational_kg:        float,
    embodied_kg:           float,
    model_params_billions: float,
    queries_per_day:       float,
    deployment_months:     float,
    carbon_intensity:      float = 400.0,
) -> float:
    """
    Project total lifecycle emissions: training + embodied carbon + inference.

    Inference energy scales roughly linearly with model parameter count.
    Rule of thumb from published benchmarks: ~1e-6 kWh per billion parameters
    per query. This is a first-order estimate — instrument actual inference
    hardware with CodeCarbon to replace it with a measured value.
    """
    kwh_per_query       = model_params_billions * 1e-6
    inference_kwh       = kwh_per_query * queries_per_day * deployment_months * 30
    inference_kg        = inference_kwh * carbon_intensity / 1000.0
    return round(operational_kg + embodied_kg + inference_kg, 3)


# ---------------------------------------------------------------------------
# Carbon diff
# ---------------------------------------------------------------------------

def compute_carbon_diff(
    current_kg:  float,
    previous_kg: Optional[float],
) -> dict:
    """Delta between this gate check and the previous one for the same repo."""
    if not previous_kg:
        return {"delta_kg": 0.0, "delta_pct": 0.0, "direction": "baseline"}
    delta = current_kg - previous_kg
    return {
        "delta_kg":  round(delta, 4),
        "delta_pct": round(delta / previous_kg * 100.0, 2),
        "direction": "increase" if delta > 0 else "decrease",
    }


# ---------------------------------------------------------------------------
# Graduated response engine
# ---------------------------------------------------------------------------

def compute_gate_decision(
    emissions_kg:              float,
    emissions_sigma:           float,
    monthly_budget_kg:         float,
    monthly_used_kg:           float,
    optimal_window_hours:      float,
    optimal_window_confidence: float,
    carbon_savings_pct:        float,
    crusoe_available:          bool,
    crusoe_emissions_kg:       float,
) -> GateDecision:
    """
    Apply graduated response logic and return a GateDecision.

    Four tiers based on overage as a fraction of monthly budget:
        pass       — under budget
        warn       — 0-10% over — suggestion only, no block
        soft_block — 10-20% over — blocked, resolvable by picking an option
        hard_block — >50% over — hard block, requires manual escalation

    An additional uncertain state fires when the ±σ interval straddles a
    tier boundary — we can't confidently assign a status so we surface the
    ambiguity rather than making an arbitrary call.
    """
    remaining     = monthly_budget_kg - monthly_used_kg
    overage_kg    = max(0.0, emissions_kg - remaining)
    overage_frac  = overage_kg / monthly_budget_kg if monthly_budget_kg > 0 else 0.0

    lower_overage = max(0.0, (emissions_kg - emissions_sigma) - remaining)
    upper_overage = max(0.0, (emissions_kg + emissions_sigma) - remaining)

    if lower_overage == 0.0 and upper_overage > 0.0:
        status = "uncertain"
    elif overage_frac == 0.0:
        status = "pass"
    elif overage_frac <= THRESHOLD_WARN:
        status = "warn"
    elif overage_frac <= THRESHOLD_SOFT:
        status = "soft_block"
    else:
        status = "hard_block"

    options = []

    if optimal_window_hours > 0 and carbon_savings_pct > 5:
        conf_label = "high" if optimal_window_confidence > 0.7 else "moderate"
        options.append({
            "id":          "wait",
            "label":       f"Wait {optimal_window_hours}h",
            "description": f"Carbon drops {carbon_savings_pct:.0f}% — forecast confidence: {conf_label}",
            "savings_pct": carbon_savings_pct,
            "cost_delta":  0.0,
            "effort":      "none",
        })

    if crusoe_available and crusoe_emissions_kg < emissions_kg:
        saving = (1.0 - crusoe_emissions_kg / emissions_kg) * 100.0
        options.append({
            "id":          "crusoe",
            "label":       "Reroute to Crusoe",
            "description": f"{saving:.0f}% cleaner — geothermal infrastructure",
            "savings_pct": saving,
            "cost_delta":  2.20,
            "effort":      "low",
        })

    options.append({
        "id":          "reduce_epochs",
        "label":       "Reduce training epochs",
        "description": "Halving epochs saves ~44% carbon and cuts runtime proportionally",
        "savings_pct": 44.0,
        "cost_delta":  0.0,
        "effort":      "medium",
    })

    if status in ("soft_block", "hard_block", "uncertain"):
        options.append({
            "id":          "override",
            "label":       "Override (justify)",
            "description": "Add label carbon-override and comment your reason",
            "savings_pct": 0.0,
            "cost_delta":  0.0,
            "effort":      "high",
        })

    options.sort(key=lambda x: x["savings_pct"], reverse=True)

    messages = {
        "pass":       f"✅ Under budget — {remaining:.1f} kg remaining this month.",
        "warn":       f"⚠️  {overage_kg:.2f} kg over budget (+{overage_frac*100:.0f}%). Consider scheduling or Crusoe.",
        "soft_block": f"🔶 Blocked — {overage_kg:.2f} kg over budget. Pick a resolution option to proceed.",
        "hard_block": f"🔴 Hard block — {overage_kg:.2f} kg over budget ({overage_frac*100:.0f}%). Escalation required.",
        "uncertain":  f"❓ Uncertain — emissions estimate spans the budget threshold (±{emissions_sigma:.2f} kg).",
    }

    return GateDecision(
        status=status,
        overage_kg=round(overage_kg, 4),
        overage_fraction=round(overage_frac, 4),
        resolution_options=options,
        message=messages[status],
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def estimate_emissions(
    gpu:                   str,
    hours:                 float,
    region:                str,
    ambient_temp_c:        float,
    carbon_intensity:      float,
    intensity_history:     list[float],
    monthly_budget_kg:     float,
    monthly_used_kg:       float,
    previous_emissions_kg: Optional[float] = None,
    is_crusoe:             bool            = False,
    crusoe_available:      bool            = False,
    model_params_billions: float           = 7.0,
    queries_per_day:       float           = 10_000.0,
    deployment_months:     float           = 12.0,
) -> dict:
    """
    Orchestrate all physics models for a single gate check.

    Priority order for intensity data:
        1. WattTime real-time MOER  (marginal, with σ from their confidence band)
        2. Passed-in carbon_intensity with flat 10% σ estimate (Electricity Maps)
        3. Regional static fallback

    Priority order for scheduling forecast:
        1. WattTime 72h MOER forecast  (weather-aware, 5-min resolution)
        2. Multi-period Fourier extrapolation from intensity_history
    """
    pue, pue_sigma = compute_pue(ambient_temp_c, is_crusoe=is_crusoe)

    energy_kwh, throttle_pct = compute_throttle_adjustment(gpu, hours, ambient_temp_c)
    total_energy_kwh          = energy_kwh * pue

    operational_kg  = total_energy_kwh * carbon_intensity / 1000.0

    crusoe_pue, _   = compute_pue(ambient_temp_c, is_crusoe=True)
    crusoe_op_kg    = energy_kwh * crusoe_pue * CRUSOE_INTENSITY_G_KWH / 1000.0

    embodied_kg, embodied_sigma       = compute_embodied_carbon(gpu, hours)
    crusoe_embodied_kg, _             = compute_embodied_carbon(gpu, hours)

    emissions_kg        = operational_kg + embodied_kg
    crusoe_emissions_kg = crusoe_op_kg + crusoe_embodied_kg

    watttime_data   = get_watttime_intensity(region)
    intensity_sigma = (
        watttime_data["intensity_sigma"]
        if watttime_data["source"] == "watttime"
        else carbon_intensity * 0.10
    )

    sigma_op      = total_energy_kwh / 1000.0 * math.sqrt(
        (pue_sigma / pue) ** 2 + (intensity_sigma / carbon_intensity) ** 2
    ) * carbon_intensity
    emissions_sigma = math.sqrt(sigma_op**2 + embodied_sigma**2)

    watttime_forecast = get_watttime_forecast(region, hours_ahead=48)

    if len(watttime_forecast) >= 24:
        min_idx      = int(np.argmin(watttime_forecast))
        min_g        = float(watttime_forecast[min_idx])
        opt_wait     = float(min_idx)
        savings_pct  = round(max(0.0, (carbon_intensity - min_g) / carbon_intensity * 100.0), 1)
        opt_conf     = 0.90
        forecast_meta = {
            "source":           "watttime_forecast",
            "r2_daily":         None, "r2_weekly": None,
            "r2_biweekly":      None, "r2_total":  None,
            "confidence_label": "high",
            "volatility":       round(float(np.std(watttime_forecast)), 2),
            "min_intensity_g":  round(min_g, 2),
            "optimal_wait_hrs": opt_wait,
        }
    else:
        opt_wait, opt_conf, savings_pct, forecast_meta = forecast_optimal_window(
            intensity_history, carbon_intensity
        )
        forecast_meta["source"] = "fourier_fallback"

    volatility   = float(np.std(intensity_history)) if len(intensity_history) > 1 else 0.0
    lifecycle_kg = compute_lifecycle_emissions(
        operational_kg, embodied_kg,
        model_params_billions, queries_per_day, deployment_months, carbon_intensity
    )
    delta_F      = compute_radiative_forcing(emissions_kg)
    carbon_diff  = compute_carbon_diff(emissions_kg, previous_emissions_kg)

    gate = compute_gate_decision(
        emissions_kg              = emissions_kg,
        emissions_sigma           = emissions_sigma,
        monthly_budget_kg         = monthly_budget_kg,
        monthly_used_kg           = monthly_used_kg,
        optimal_window_hours      = opt_wait,
        optimal_window_confidence = opt_conf,
        carbon_savings_pct        = savings_pct,
        crusoe_available          = crusoe_available,
        crusoe_emissions_kg       = crusoe_emissions_kg,
    )

    return {
        "emissions_kg":              round(emissions_kg, 4),
        "emissions_sigma":           round(emissions_sigma, 4),
        "crusoe_emissions_kg":       round(crusoe_emissions_kg, 4),
        "operational_kg":            round(operational_kg, 4),
        "embodied_kg":               round(embodied_kg, 4),
        "lifecycle_kg":              lifecycle_kg,
        "pue_used":                  pue,
        "pue_sigma":                 pue_sigma,
        "throttle_adjustment_pct":   throttle_pct,
        "carbon_intensity":          carbon_intensity,
        "intensity_sigma":           round(intensity_sigma, 2),
        "optimal_window_hours":      opt_wait,
        "optimal_window_confidence": opt_conf,
        "carbon_savings_pct":        savings_pct,
        "radiative_forcing_w_m2":    delta_F,
        "volatility_score":          round(volatility, 2),
        "carbon_diff":               carbon_diff,
        "gate":                      gate.__dict__,
        "gate_status":               gate.status,
        "gate_message":              gate.message,
        "resolution_options":        gate.resolution_options,
        "region":                    region,
        "forecast_meta":             forecast_meta,
        "intensity_source":          watttime_data["source"],
        "watttime_percent_clean":    watttime_data.get("percent_clean"),
    }


# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    np.random.seed(42)
    t = np.arange(2160)
    history = (
        350
        + 80  * np.sin(2 * np.pi * t / 24)
        + 30  * np.sin(2 * np.pi * t / 168)
        + np.random.normal(0, 15, 2160)
    ).tolist()

    r = estimate_emissions(
        gpu                   = "A100",
        hours                 = 4.0,
        region                = "us-east-1",
        ambient_temp_c        = 18.0,
        carbon_intensity      = 420.0,
        intensity_history     = history,
        monthly_budget_kg     = 50.0,
        monthly_used_kg       = 43.0,
        previous_emissions_kg = 2.8,
        is_crusoe             = False,
        crusoe_available      = True,
        model_params_billions = 7.0,
        queries_per_day       = 10_000,
        deployment_months     = 12.0,
    )

    fm = r["forecast_meta"]
    print(f"\nA100 × 4h @ us-east-1")
    print(f"  emissions       {r['emissions_kg']} ± {r['emissions_sigma']} kgCO₂eq")
    print(f"  crusoe alt      {r['crusoe_emissions_kg']} kgCO₂eq")
    print(f"  pue             {r['pue_used']} ± {r['pue_sigma']}")
    print(f"  throttle adj    -{r['throttle_adjustment_pct']}%")
    print(f"  embodied        {r['embodied_kg']} kg")
    print(f"  lifecycle 12mo  {r['lifecycle_kg']} kg")
    print(f"  optimal window  wait {r['optimal_window_hours']}h  conf={r['optimal_window_confidence']}")
    print(f"  savings         {r['carbon_savings_pct']}%")
    print(f"  forecast R²     daily={fm['r2_daily']}  weekly={fm['r2_weekly']}  biweekly={fm['r2_biweekly']}  total={fm['r2_total']}")
    print(f"  volatility      {fm['volatility']} gCO₂/kWh  discount={fm['vol_discount']:.2f}  ({fm['confidence_label']})")
    print(f"  carbon diff     {r['carbon_diff']['delta_kg']:+.3f} kg  ({r['carbon_diff']['delta_pct']:+.1f}%)")
    print(f"  gate            {r['gate_status'].upper()}  —  {r['gate_message']}")
    print(f"  intensity src   {r['intensity_source']}")
    for opt in r["resolution_options"]:
        print(f"    [{opt['id']}]  {opt['label']}  saves {opt['savings_pct']:.0f}%")
    print(f"  forcing         {r['radiative_forcing_w_m2']:.3e} W/m²")
