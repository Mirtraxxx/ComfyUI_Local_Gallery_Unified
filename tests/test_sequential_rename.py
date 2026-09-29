import copy
import unittest

from backend import prompt_bulk, prompt_cards


def load_rename_helpers():
    """Collect the pure ordering and selection helpers by name."""
    helpers = {}
    for module in (prompt_cards, prompt_bulk):
        helpers.update(vars(module))
    return helpers


class SequentialRenameTests(unittest.TestCase):
    def test_wildcard_order_precedes_stable_fallback_and_preserves_metadata(self):
        build_plan = load_rename_helpers()["build_sequential_rename_plan"]
        metadata = {
            "late": {"name": "old late", "wildcard_order": 8, "created_at": 30, "prompt_text": "late", "category": "x", "favorite": True},
            "first": {"name": "old first", "wildcard_order": 0, "created_at": 20, "prompt_text": "first", "category": "x", "preview_type": "image"},
            "middle": {"name": "old middle", "wildcard_order": "3", "created_at": 10, "prompt_text": "middle", "tags": ["kept"]},
            "fallback_early": {"name": "old fallback", "wildcard_order": "not a number", "created_at": 1, "prompt_text": "fallback", "usage_count": 7},
            "fallback_late": {"name": "old fallback 2", "created_at": 10, "prompt_text": "fallback two", "image": "kept.png"},
        }
        original = copy.deepcopy(metadata)

        plan = build_plan(metadata, ["fallback_late", "late", "first", "fallback_early", "middle"])

        self.assertEqual(plan, [
            ("first", "001"),
            ("middle", "002"),
            ("late", "003"),
            ("fallback_early", "004"),
            ("fallback_late", "005"),
        ])
        self.assertEqual(metadata, original)

    def test_selected_only_and_padding_expands_past_three_digits(self):
        build_plan = load_rename_helpers()["build_sequential_rename_plan"]
        metadata = {
            f"card-{index}": {"wildcard_order": index, "created_at": index}
            for index in range(1000)
        }

        selected_plan = build_plan(metadata, ["card-3", "card-1"])
        full_plan = build_plan(metadata, list(metadata))

        self.assertEqual(selected_plan, [("card-1", "001"), ("card-3", "002")])
        self.assertEqual(full_plan[0], ("card-0", "0001"))
        self.assertEqual(full_plan[-1], ("card-999", "1000"))

    def test_query_selection_resolves_every_matching_card_not_only_one_page(self):
        resolve_ids = load_rename_helpers()["resolve_sequential_rename_ids"]
        metadata = {
            **{
                f"category-a-{index}": {
                    "name": f"Card {index}",
                    "prompt_text": f"training prompt {index}",
                    "category": "Category A",
                }
                for index in range(45)
            },
            **{
                f"category-b-{index}": {
                    "name": f"Other {index}",
                    "prompt_text": f"other prompt {index}",
                    "category": "Category B",
                }
                for index in range(5)
            },
        }
        request_data = {
            "selection": {
                "type": "query",
                "filter_name": "training",
                "category": "Category A",
                "categories": [],
                "favorites_only": False,
                "uncategorized_only": False,
                "exclusions": ["category-a-3"],
            },
        }

        resolved = resolve_ids(metadata, request_data)

        self.assertEqual(len(resolved), 44)
        self.assertNotIn("category-a-3", resolved)
        self.assertNotIn("category-b-0", resolved)
        self.assertIn("category-a-44", resolved)

    def test_query_validation_rejects_malformed_and_empty_snapshots(self):
        helpers = load_rename_helpers()
        validate = helpers["_sequential_rename_selection_from_request"]
        resolve_ids = helpers["resolve_sequential_rename_ids"]
        incomplete_query = {
            "selection": {
                "type": "query",
                "filter_name": "",
                "categories": [],
                "favorites_only": False,
                "uncategorized_only": False,
                "exclusions": [],
            },
        }
        complete_empty_query = {
            "selection": {
                "type": "query",
                "filter_name": "",
                "category": "Missing",
                "categories": [],
                "favorites_only": False,
                "uncategorized_only": False,
                "exclusions": [],
            },
        }

        with self.assertRaisesRegex(ValueError, "missing category"):
            validate(incomplete_query)
        with self.assertRaisesRegex(ValueError, "no longer match any results"):
            resolve_ids({}, complete_empty_query)

    def test_explicit_selection_protocol_remains_supported(self):
        resolve_ids = load_rename_helpers()["resolve_sequential_rename_ids"]
        metadata = {
            "one": {"name": "One"},
            "two": {"name": "Two"},
            "three": {"name": "Three"},
        }

        self.assertEqual(
            resolve_ids(metadata, {"prompt_ids": ["three", "one"]}),
            ["three", "one"],
        )


if __name__ == "__main__":
    unittest.main()
