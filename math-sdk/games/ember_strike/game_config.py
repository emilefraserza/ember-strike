"""Stake Engine Python math-sdk configuration for Ember Strike (Matchstick Gaming)."""

GRID_ROWS = 6
GRID_COLS = 6
MAX_WIN_MULTIPLIER = 25000.0
MAX_FREE_SPINS = 30

PAYING_SYMBOLS = ("L1", "L2", "L3", "L4", "H1", "H2", "H3", "H4")
WILD = "W"
SCATTER = "S"

SYMBOLS = {
    "L1": {"name": "Triangle", "tier": "low"},
    "L2": {"name": "Thermometer", "tier": "low"},
    "L3": {"name": "Kindling", "tier": "low"},
    "L4": {"name": "Fuel Can", "tier": "low"},
    "H1": {"name": "Flint", "tier": "high"},
    "H2": {"name": "Lighter", "tier": "high"},
    "H3": {"name": "Flamethrower", "tier": "high"},
    "H4": {"name": "Dynamite", "tier": "high"},
    "W":  {"name": "Matchstick Wild", "tier": "wild"},
    "S":  {"name": "IGNITE Scatter", "tier": "scatter"},
}

BET_MODES = {
    "base": {"cost_mult": 1.0, "target_rtp": 0.9635, "buy": False},
    "bonus_hunt": {"cost_mult": 3.0, "target_rtp": 0.9638, "buy": False},
    "buy_regular": {"cost_mult": 100.0, "target_rtp": 0.9635, "buy": True},
    "buy_super": {"cost_mult": 350.0, "target_rtp": 0.9640, "buy": True},
    "buy_epic": {"cost_mult": 1000.0, "target_rtp": 0.9642, "buy": True},
    "buy_random": {"cost_mult": 185.0, "target_rtp": 0.9645, "buy": True},
}

CLUSTER_PAYTABLE = {
    "L1": [(15, 15.0), (12, 4.0), (10, 1.5), (9, 0.8), (8, 0.5), (7, 0.3), (6, 0.2), (5, 0.1)],
    "L2": [(15, 15.0), (12, 4.0), (10, 1.5), (9, 0.8), (8, 0.5), (7, 0.3), (6, 0.2), (5, 0.1)],
    "L3": [(15, 20.0), (12, 5.0), (10, 2.0), (9, 1.0), (8, 0.6), (7, 0.4), (6, 0.3), (5, 0.2)],
    "L4": [(15, 20.0), (12, 5.0), (10, 2.0), (9, 1.0), (8, 0.6), (7, 0.4), (6, 0.3), (5, 0.2)],
    "H1": [(15, 40.0), (12, 15.0), (10, 5.0), (9, 2.5), (8, 1.5), (7, 1.0), (6, 0.6), (5, 0.4)],
    "H2": [(15, 60.0), (12, 20.0), (10, 7.5), (9, 3.5), (8, 2.0), (7, 1.2), (6, 0.8), (5, 0.5)],
    "H3": [(15, 100.0), (12, 30.0), (10, 10.0), (9, 5.0), (8, 3.0), (7, 1.5), (6, 1.0), (5, 0.7)],
    "H4": [(15, 150.0), (12, 50.0), (10, 20.0), (9, 8.0), (8, 5.0), (7, 2.5), (6, 1.5), (5, 1.0)],
}

SYMBOL_WEIGHTS = {
    "base":  {"L1": 180, "L2": 180, "L3": 165, "L4": 165, "H1": 95,  "H2": 80, "H3": 65, "H4": 50, "W": 14},
    "tier1": {"L1": 175, "L2": 175, "L3": 160, "L4": 160, "H1": 100, "H2": 85, "H3": 70, "H4": 55, "W": 18},
    "tier2": {"L1": 170, "L2": 170, "L3": 155, "L4": 155, "H1": 102, "H2": 90, "H3": 75, "H4": 60, "W": 24},
    "tier3": {"L1": 165, "L2": 165, "L3": 155, "L4": 155, "H1": 105, "H2": 95, "H3": 80, "H4": 65, "W": 26},
}

SCATTER_PROBS = {
    "base": [(6, 1 / 250_000), (5, 1 / 25_000), (4, 1 / 1_800), (3, 1 / 220), (2, 0.065), (1, 0.180)],
    "bonus_hunt": [(6, 1 / 50_000), (5, 1 / 5_000), (4, 1 / 360), (3, 1 / 44), (2, 0.120), (1, 0.220)],
    "retrigger": [(3, 1 / 35), (2, 0.05), (1, 0.12)],
}

RANDOM_BUY_WEIGHTS = [(3, 0.72), (4, 0.225), (5, 0.052), (6, 0.003)]
FEATURE_UPGRADE_CHANCE = 0.25
