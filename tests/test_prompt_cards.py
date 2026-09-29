import unittest

from backend import prompt_cards


class PromptCardsTests(unittest.TestCase):
    def test_prompt_has_order(self):
        metadata = {
            "a": {"wildcard_order": 1},
            "b": {},
            "c": {"wildcard_order": None},
        }
        self.assertTrue(prompt_cards.prompt_has_order(metadata, ["b", "a"]))
        self.assertFalse(prompt_cards.prompt_has_order(metadata, ["b", "c"]))
        self.assertFalse(prompt_cards.prompt_has_order(metadata, []))

    def test_sort_prompt_ids_for_wildcards(self):
        # no wildcard_order anywhere -> input order preserved
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_wildcards({"x": {}}, ["x", "y"]),
            ["x", "y"],
        )
        metadata = {
            "a": {"wildcard_order": 2},
            "b": {},
            "c": {"wildcard_order": 1},
        }
        # ordered cards first (by order, then id), unordered last (by id)
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_wildcards(metadata, ["b", "a", "c"]),
            ["c", "a", "b"],
        )

    def test_apply_manual_prompt_order(self):
        ids = ["a", "b", "c", "d"]
        self.assertEqual(prompt_cards.apply_manual_prompt_order(ids), ids)
        self.assertEqual(prompt_cards.apply_manual_prompt_order(ids, []), ids)
        # manual order first, then the rest in original order
        self.assertEqual(
            prompt_cards.apply_manual_prompt_order(ids, ["c", "a"]),
            ["c", "a", "b", "d"],
        )
        # ids not present are ignored; duplicates collapsed
        self.assertEqual(
            prompt_cards.apply_manual_prompt_order(ids, ["d", "zzz", "d", "b"]),
            ["d", "b", "a", "c"],
        )

    def test_get_prompt_manual_order_scope(self):
        self.assertEqual(prompt_cards.get_prompt_manual_order_scope(), "all")
        self.assertEqual(prompt_cards.get_prompt_manual_order_scope("   "), "all")
        self.assertEqual(prompt_cards.get_prompt_manual_order_scope("Animals"), "category:Animals")
        # favorites_only wins over category
        self.assertEqual(prompt_cards.get_prompt_manual_order_scope("Animals", True), "favorites")
        self.assertEqual(prompt_cards.get_prompt_manual_order_scope("", True), "favorites")

    def test_sort_prompt_ids_for_display_name_modes(self):
        metadata = {
            "a": {"name": "banana"},
            "b": {"name": "Apple"},
            "c": {"name": "cherry"},
        }
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "az"),
            ["b", "a", "c"],
        )
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "za"),
            ["c", "a", "b"],
        )
        # aliases are accepted
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "a-z"),
            ["b", "a", "c"],
        )

    def test_sort_prompt_ids_for_display_time_modes(self):
        metadata = {
            "a": {"name": "a", "created_at": 300},
            "b": {"name": "b", "date_added": "100"},
            "c": {"name": "c"},
        }
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "newest"),
            ["a", "b", "c"],
        )
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "oldest"),
            ["c", "b", "a"],
        )

    def test_sort_prompt_ids_for_display_manual_fallback(self):
        metadata = {"a": {"name": "a"}, "b": {"name": "b"}, "c": {"name": "c"}}
        # unknown modes fall back to manual ordering
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], "bogus", ["c", "a"]),
            ["c", "a", "b"],
        )
        self.assertEqual(
            prompt_cards.sort_prompt_ids_for_display(metadata, ["a", "b", "c"], None),
            ["a", "b", "c"],
        )

    def test_build_metadata_indexes(self):
        metadata = {
            "p1": {"name": "Zeta", "prompt_text": "Red text", "category": "B", "favorite": True, "wildcard_order": 2},
            "p2": {"name": "Alpha", "prompt_text": "blue", "category": "A", "wildcard_order": 1},
            "p3": {"name": "Mid", "prompt_text": "", "category": "A"},
        }
        indexes = prompt_cards.build_metadata_indexes(metadata)
        self.assertEqual(indexes["categories"], ["A", "B"])
        self.assertEqual(indexes["category_ids"], {"B": ["p1"], "A": ["p2", "p3"]})
        self.assertEqual(indexes["favorite_ids"], ["p1"])
        self.assertEqual(indexes["name_to_id"], {"zeta": "p1", "alpha": "p2", "mid": "p3"})
        self.assertEqual(
            indexes["searchable_text_by_id"]["p1"],
            ("zeta", "red text"),
        )
        # wildcard ordering within a category
        self.assertEqual(indexes["wildcard_category_ids"]["A"], ["p2", "p3"])
        # name-sorted views
        self.assertEqual(indexes["category_name_ids"]["A"], ["p2", "p3"])
        self.assertEqual(indexes["favorite_name_ids"], ["p1"])
        self.assertEqual(indexes["all_name_ids"], ["p2", "p3", "p1"])

    def test_prompt_response(self):
        response = prompt_cards.prompt_response("id-1", {
            "name": "Card",
            "prompt_text": "text",
            "category": "A",
            "created_at": 123,
            "favorite": True,
            "favorite_color": "#ff0000",
            "category_favorites": ["B"],
            "preview_type": "webp",
            "preview_version": 7,
        })
        self.assertEqual(response["id"], "id-1")
        self.assertEqual(response["name"], "Card")
        self.assertEqual(response["prompt_text"], "text")
        self.assertEqual(response["category"], "A")
        self.assertEqual(response["created_at"], 123)
        self.assertEqual(response["favorite"], True)
        self.assertEqual(response["favorite_color"], "#ff0000")
        self.assertEqual(response["category_favorites"], ["B"])
        self.assertEqual(response["preview_type"], "webp")
        self.assertEqual(response["preview_url"], "/localgalleryunified/prompt/thumbnail/id-1?v=7")

        # defaults: name falls back to id, no preview, empty lists
        minimal = prompt_cards.prompt_response("id-2", {})
        self.assertEqual(minimal["name"], "id-2")
        self.assertEqual(minimal["prompt_text"], "")
        self.assertEqual(minimal["category"], "")
        self.assertIsNone(minimal["created_at"])
        self.assertIsNone(minimal["preview_type"])
        self.assertIsNone(minimal["preview_url"])
        self.assertFalse(minimal["favorite"])
        self.assertIsNone(minimal["favorite_color"])
        self.assertEqual(minimal["category_favorites"], [])

    def test_prompt_response_created_at_fallback(self):
        # created_at falls back through date_added then createdAt
        self.assertEqual(
            prompt_cards.prompt_response("id-3", {"date_added": 5})["created_at"],
            5,
        )
        self.assertEqual(
            prompt_cards.prompt_response("id-4", {"createdAt": 9})["created_at"],
            9,
        )
        # NOTE: the `or` chain treats a falsy created_at (e.g. 0) as missing,
        # so 0 falls through to date_added/createdAt.
        self.assertEqual(
            prompt_cards.prompt_response("id-5", {"created_at": 0, "date_added": 5})["created_at"],
            5,
        )


if __name__ == "__main__":
    unittest.main()
