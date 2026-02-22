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
## :)
import math
import os
from dataclasses import dataclass
from typing import Optional, Dict, Any

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
# T_range: window over which throttling increases (°C)
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
    "eu-west-2":      "NIAUL",
}

# Precompute static derived constants where possible (CARBON-OPT: reduce repeated calcs)
T_HOT_K = 273.15 + T_HOT_C  # Base hot temperature in Kelvin
CO2_RAD_FORCING = ALPHA_FORCING * math.log(CO2_CURRENT / CO2_PREINDUSTRIAL)  # CARBON-OPT: precompute once

# Type hints for clarity
AmbientProfile = Dict[str, Any]
ThermalModelResult = Dict[str, Any]

# Avoid repeated lookups in hot paths
math_log = math.log
math_exp = math.exp