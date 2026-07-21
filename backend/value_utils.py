import json
import math


def parse_json_list(value):
    """Decode a legacy list or a versioned ``{"items": [...]}`` envelope."""
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict) and isinstance(parsed.get("items"), list):
        return parsed["items"]
    return []


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
