import math
import unittest

from backend.value_utils import bounded_int, finite_float, parse_json_list


class ValueUtilsTests(unittest.TestCase):
    def test_parse_json_list_rejects_wrong_shapes_and_malformed_json(self):
        self.assertEqual(parse_json_list('[{"id": 1}]'), [{"id": 1}])
        self.assertEqual(parse_json_list('{"version": 1, "items": [{"id": 2}]}'), [{"id": 2}])
        self.assertEqual(parse_json_list('{"version": 1, "items": "bad"}'), [])
        self.assertEqual(parse_json_list('not json'), [])
        self.assertEqual(parse_json_list(None), [])

    def test_finite_float_rejects_non_finite_values(self):
        self.assertEqual(finite_float("0", 1.0), 0.0)
        self.assertEqual(finite_float("bad", 1.0), 1.0)
        self.assertEqual(finite_float(float("nan"), 1.0), 1.0)
        self.assertEqual(finite_float(float("inf"), 1.0), 1.0)

    def test_bounded_int_uses_fallback_and_clamps(self):
        self.assertEqual(bounded_int("25", 10, 1, 100), 25)
        self.assertEqual(bounded_int("bad", 10, 1, 100), 10)
        self.assertEqual(bounded_int(0, 10, 1, 100), 1)
        self.assertEqual(bounded_int(1000, 10, 1, 100), 100)


if __name__ == "__main__":
    unittest.main()
