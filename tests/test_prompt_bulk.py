import unittest

from backend import prompt_bulk


class PromptBulkTests(unittest.TestCase):
    def test_normalize_bulk_ids(self):
        self.assertEqual(prompt_bulk.normalize_bulk_ids(None), [])
        self.assertEqual(prompt_bulk.normalize_bulk_ids("a"), [])
        # strips, dedupes (first wins), drops blank, stringifies non-strings
        self.assertEqual(
            prompt_bulk.normalize_bulk_ids([" a ", "b", "a", "", "  ", 7]),
            ["a", "b", "7"],
        )

    def test_resolve_bulk_selection_ids(self):
        metadata = {"p1": {}, "p2": {}, "p3": {}}
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "ids", "ids": [" p2 ", "p1", "p2"]}),
            ["p2", "p1"],
        )
        # prompt_ids is accepted as an alias for ids
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"prompt_ids": ["p3"]}),
            ["p3"],
        )

    def test_resolve_bulk_selection_validation(self):
        with self.assertRaises(ValueError):
            prompt_bulk.resolve_bulk_selection({}, ["p1"])
        with self.assertRaises(ValueError):
            prompt_bulk.resolve_bulk_selection({}, {"type": "bogus"})

    def test_resolve_bulk_selection_query_filters(self):
        metadata = {
            "p1": {"name": "Alpha", "prompt_text": "red dress", "category": "A", "favorite": True},
            "p2": {"name": "Beta", "prompt_text": "blue shirt", "category": "A", "favorite": False},
            "p3": {"name": "Gamma", "prompt_text": "red shoes", "category": "B", "favorite": False},
            "p4": {"name": "Delta", "prompt_text": "", "category": "", "favorite": True},
        }
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "category": "A"}),
            ["p1", "p2"],
        )
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "categories": ["B", "A"]}),
            ["p1", "p2", "p3"],
        )
        # "All Categories" disables the category filter
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "category": "All Categories"}),
            ["p1", "p2", "p3", "p4"],
        )
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "favorites_only": True}),
            ["p1", "p4"],
        )
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "uncategorized_only": True}),
            ["p4"],
        )
        # filter_name is case-insensitive and matches name or prompt_text
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(metadata, {"type": "query", "filter_name": "RED"}),
            ["p1", "p3"],
        )
        self.assertEqual(
            prompt_bulk.resolve_bulk_selection(
                metadata, {"type": "query", "category": "A", "exclusions": ["p1"]}),
            ["p2"],
        )

    def test_normalize_bulk_operations_text(self):
        ops = prompt_bulk.normalize_bulk_operations({
            "prompt_text": {"mode": "find_replace", "find": "a", "replace": "b", "case_sensitive": True},
            "name": {"mode": "find_replace", "find": "x"},
        })
        self.assertEqual(ops["prompt_text"], {
            "mode": "find_replace", "find": "a", "replace": "b", "value": "", "case_sensitive": True,
        })
        self.assertEqual(ops["name"], {
            "mode": "find_replace", "find": "x", "replace": "", "value": "", "case_sensitive": False,
        })
        # names only support find_replace; empty find is rejected
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"name": {"mode": "prepend", "value": "x"}})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"name": {"mode": "append", "value": "x"}})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"name": {"mode": "find_replace", "find": ""}})

    def test_normalize_bulk_operations_fields(self):
        ops = prompt_bulk.normalize_bulk_operations({
            "category": {"mode": "set", "value": "  New  "},
            "favorite": {"mode": "set", "value": True},
        })
        self.assertEqual(ops["category"], {"mode": "set", "value": "New"})
        self.assertEqual(ops["favorite"], {"mode": "set", "value": True})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"category": {"mode": "set", "value": 5}})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"favorite": {"mode": "set", "value": "yes"}})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"favorite": {"mode": "toggle", "value": True}})
        # empty / unknown / all-None inputs are rejected
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations("nope")
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"bogus": {"mode": "set"}})
        with self.assertRaises(ValueError):
            prompt_bulk.normalize_bulk_operations({"name": None, "category": None})

    def test_apply_bulk_operations(self):
        data = {"name": "Old Name", "prompt_text": "base text", "category": "A", "favorite": False}
        before, changed = prompt_bulk.apply_bulk_operations(data, {
            "name": {"mode": "find_replace", "find": "Old", "replace": "New", "value": "", "case_sensitive": True},
            "prompt_text": {"mode": "append", "find": "", "replace": "", "value": " + more", "case_sensitive": False},
            "category": {"mode": "set", "value": "B"},
            "favorite": {"mode": "set", "value": True},
        })
        self.assertEqual(before, {"name": "Old Name", "prompt_text": "base text", "category": "A", "favorite": False})
        self.assertTrue(changed)
        self.assertEqual(data["name"], "New Name")
        self.assertEqual(data["prompt_text"], "base text + more")
        self.assertEqual(data["category"], "B")
        self.assertTrue(data["favorite"])

        # a no-op reports unchanged and leaves the data intact
        data2 = {"name": "Same", "prompt_text": "text"}
        before2, changed2 = prompt_bulk.apply_bulk_operations(data2, {
            "name": {"mode": "find_replace", "find": "absent", "replace": "x", "value": "", "case_sensitive": True},
        })
        self.assertFalse(changed2)
        self.assertEqual(before2, data2)

    def test_apply_bulk_operations_case_insensitive_fold(self):
        # casefold maps "ß" -> "ss"; the whole "Straße" is one match and is replaced
        data = {"prompt_text": "Straße"}
        _, changed = prompt_bulk.apply_bulk_operations(data, {
            "prompt_text": {"mode": "find_replace", "find": "strasse", "replace": "X", "value": "", "case_sensitive": False},
        })
        self.assertTrue(changed)
        self.assertEqual(data["prompt_text"], "X")

    def test_bulk_diff(self):
        before = {"name": "A", "category": "X", "prompt_text": "old", "favorite": False}
        after = {"name": "B", "category": "X", "prompt_text": "new", "favorite": False}
        diff = prompt_bulk.bulk_diff("id-1", before, after)
        self.assertEqual(diff["id"], "id-1")
        self.assertEqual(diff["name"], {"before": "A", "after": "B"})
        self.assertNotIn("category", diff)
        self.assertNotIn("favorite", diff)
        self.assertEqual(diff["prompt_text"], {"before": "old", "after": "new"})

        # missing fields use defaults ("" / False); prompt_text is truncated to 240 chars
        before2 = {"name": "A"}
        after2 = {"name": "A", "favorite": True, "prompt_text": "x" * 300}
        diff2 = prompt_bulk.bulk_diff("id-2", before2, after2)
        self.assertEqual(diff2["favorite"], {"before": False, "after": True})
        self.assertEqual(diff2["prompt_text"]["before"], "")
        self.assertEqual(len(diff2["prompt_text"]["after"]), 240)

    def test_replace_category_refs(self):
        self.assertEqual(
            prompt_bulk.replace_category_refs(["A", "B", "A"], "A", "C"),
            ["C", "B"],
        )
        # replacing with a falsy value drops the entry
        self.assertEqual(
            prompt_bulk.replace_category_refs(["A", "B"], "A", ""),
            ["B"],
        )
        # non-list inputs are returned unchanged
        self.assertIsNone(prompt_bulk.replace_category_refs(None, "A", "B"))
        self.assertEqual(prompt_bulk.replace_category_refs("A", "A", "B"), "A")


if __name__ == "__main__":
    unittest.main()
