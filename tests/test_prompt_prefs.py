import importlib
import sys
import types
import unittest


def _import_prompt_prefs():
    # prompt_prefs -> prompt_store; stub the ComfyUI modules it reaches so the
    # pure preference logic can be imported without a running server.
    sys.modules.setdefault("folder_paths", types.SimpleNamespace())
    sys.modules.setdefault(
        "server",
        types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(
                instance=types.SimpleNamespace(
                    routes=types.SimpleNamespace(get=lambda _path: (lambda f: f),
                                                 post=lambda _path: (lambda f: f)),
                ),
            ),
        ),
    )
    return importlib.import_module("backend.prompt_prefs")


class PromptPrefsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global prompt_prefs
        prompt_prefs = _import_prompt_prefs()

    def test_normalize_ui_prefs_defaults(self):
        prefs = prompt_prefs.normalize_ui_prefs({})
        # every default key is present
        for key in prompt_prefs.UI_PREF_DEFAULTS:
            self.assertIn(key, prefs)
        # derived pixel sizes come from the default "medium" thumbnail size;
        # NOTE: active_thumbnail_size_px is derived (96), not the raw default (110)
        self.assertEqual(prefs["thumbnail_size_px"], 96)
        self.assertEqual(prefs["active_thumbnail_size_px"], 96)
        self.assertEqual(prefs["display_mode"], "thumbnails")
        self.assertEqual(prefs["cards_display_mode"], "thumbnails")
        self.assertEqual(prefs["active_display_mode"], "compact")

    def test_normalize_ui_prefs_display_mode_migration(self):
        # legacy "text" maps to "compact" and display_mode mirrors cards_display_mode
        prefs = prompt_prefs.normalize_ui_prefs({"display_mode": "text"})
        self.assertEqual(prefs["display_mode"], "compact")
        self.assertEqual(prefs["cards_display_mode"], "compact")
        self.assertEqual(prefs["active_display_mode"], "compact")
        # a bare display_mode is migrated into cards_display_mode
        migrated = prompt_prefs.normalize_ui_prefs({"display_mode": "thumbnails"})
        self.assertEqual(migrated["cards_display_mode"], "thumbnails")
        self.assertEqual(migrated["display_mode"], "thumbnails")

    def test_normalize_ui_prefs_thumbnail_sizes(self):
        small = prompt_prefs.normalize_ui_prefs({"thumbnail_size": "small"})
        self.assertEqual(small["thumbnail_size_px"], 81)
        self.assertEqual(small["active_thumbnail_size_px"], 81)
        # out-of-range values are clamped to [40, 320]
        clamped = prompt_prefs.normalize_ui_prefs({"thumbnail_size_px": 10})
        self.assertEqual(clamped["thumbnail_size_px"], 40)
        self.assertEqual(clamped["active_thumbnail_size_px"], 40)
        large = prompt_prefs.normalize_ui_prefs({"thumbnail_size_px": 500})
        self.assertEqual(large["thumbnail_size_px"], 320)

    def test_normalize_ui_prefs_list_and_choice_fields(self):
        prefs = prompt_prefs.normalize_ui_prefs({
            "library_tabs": ["pinned", "most_used", ""],
            "pinned_categories": ["a", "", "b"],
            "prompt_sort_mode": "bogus",
            "card_contrast_mode": "bogus",
            "from_last_output_name_default": "bogus",
            "last_created_category": 42,
            "wildcard_cycle_state": "nope",
        })
        # "most_used" and blank tabs are dropped
        self.assertEqual(prefs["library_tabs"], ["pinned"])
        self.assertEqual(prefs["pinned_categories"], ["a", "b"])
        self.assertEqual(prefs["prompt_sort_mode"], "manual")
        self.assertEqual(prefs["card_contrast_mode"], "off")
        self.assertEqual(prefs["from_last_output_name_default"], "time")
        self.assertEqual(prefs["last_created_category"], "42")
        self.assertEqual(prefs["wildcard_cycle_state"], {})
        # None stays None for the nullable list
        self.assertIsNone(prompt_prefs.normalize_ui_prefs({"pinned_categories": None})["pinned_categories"])

    def test_normalize_ui_prefs_map_fields(self):
        prefs = prompt_prefs.normalize_ui_prefs({
            "prompt_manual_orders": {"all": ["b", "a"], "category:x": "nope", "": ["c"]},
            "category_colors": {"a": "#fff", "b": 123, "": "#000", "c": "  "},
            "prompt_sort_modes": {"all": "az", "category:x": "bogus"},
        })
        # non-list values and blank scopes are dropped from manual orders
        self.assertEqual(prefs["prompt_manual_orders"], {"all": ["b", "a"]})
        # only non-blank string colors under non-blank categories survive
        self.assertEqual(prefs["category_colors"], {"a": "#fff"})
        # only known sort modes survive
        self.assertEqual(prefs["prompt_sort_modes"], {"all": "az"})

    def test_normalize_ui_prefs_ignores_unknown_keys(self):
        prefs = prompt_prefs.normalize_ui_prefs({"favorite": True, "bogus": 1})
        self.assertNotIn("favorite", prefs)
        self.assertNotIn("bogus", prefs)
        # every default key is still present
        for key in prompt_prefs.UI_PREF_DEFAULTS:
            self.assertIn(key, prefs)

    def test_normalize_display_mode(self):
        self.assertEqual(prompt_prefs._normalize_display_mode("text"), "compact")
        self.assertEqual(prompt_prefs._normalize_display_mode("bogus"), "compact")
        self.assertEqual(prompt_prefs._normalize_display_mode("thumbnails", "compact"), "thumbnails")
        self.assertEqual(prompt_prefs._normalize_display_mode("compact", "thumbnails"), "compact")

    def test_normalize_int(self):
        self.assertEqual(prompt_prefs._normalize_int("42", 0), 42)
        self.assertEqual(prompt_prefs._normalize_int("bogus", 7), 7)
        self.assertEqual(prompt_prefs._normalize_int(None, 7), 7)
        self.assertEqual(prompt_prefs._normalize_int(5, 0, 10, 20), 10)
        self.assertEqual(prompt_prefs._normalize_int(50, 0, 10, 20), 20)
        self.assertEqual(prompt_prefs._normalize_int(15, 0, 10, 20), 15)

    def test_normalize_str_list_and_nullable(self):
        self.assertEqual(prompt_prefs._normalize_str_list("nope"), [])
        self.assertEqual(prompt_prefs._normalize_str_list(None), [])
        # falsy items dropped, others stringified
        self.assertEqual(prompt_prefs._normalize_str_list([1, "", None, "a"]), ["1", "a"])
        self.assertIsNone(prompt_prefs._normalize_nullable_str_list(None))
        self.assertEqual(prompt_prefs._normalize_nullable_str_list(["a", ""]), ["a"])

    def test_normalize_map_helpers(self):
        self.assertEqual(prompt_prefs._normalize_manual_orders("nope"), {})
        self.assertEqual(
            prompt_prefs._normalize_manual_orders({"s": ["a"], "": ["b"], "t": "nope"}),
            {"s": ["a"]},
        )
        self.assertEqual(prompt_prefs._normalize_category_colors("nope"), {})
        self.assertEqual(
            prompt_prefs._normalize_category_colors({"a": "#fff", "b": 1, "": "#000"}),
            {"a": "#fff"},
        )
        self.assertEqual(prompt_prefs._normalize_sort_modes("nope"), {})
        self.assertEqual(
            prompt_prefs._normalize_sort_modes({"a": "az", "b": "nope", "": "za"}),
            {"a": "az"},
        )


if __name__ == "__main__":
    unittest.main()
