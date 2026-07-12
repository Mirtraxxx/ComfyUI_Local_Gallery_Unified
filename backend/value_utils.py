import json
import math


def parse_json_list(value):
    """Return a decoded JSON list, or an empty list for malformed/wrong-shaped input."""
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def finite_float(value, fallback=1.0):
    """Coerce a finite float while rejecting NaN and infinities."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if math.isfinite(parsed) else fallback


def bounded_int(value, fallback, minimum, maximum):
    """Coerce and clamp an integer used at an external input boundary."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = fallback
    return max(minimum, min(maximum, parsed))
