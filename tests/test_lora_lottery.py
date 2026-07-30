import json
import unittest
from unittest.mock import patch

from test_lora_cache import _import_lora_backend


class LoraLotteryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = _import_lora_backend()

    def test_resolution_draws_from_the_selected_folder_and_keeps_manual_items(self):
        selection = json.dumps({
            "version": 1,
            "items": [{
                "on": True,
                "lora": "manual.safetensors",
                "strength": 1.0,
                "strength_clip": 1.0,
            }],
            "lottery": {
                "enabled": True,
                "folder": "Styles",
                "strength": 0.7,
                "strength_clip": 0.5,
            },
        })
        inventory = {
            "entries": [
                {"name": "characters/hero.safetensors", "folder": "Characters"},
                {"name": "styles/ink.safetensors", "folder": "Styles"},
                {"name": "styles/oil.safetensors", "folder": "Styles"},
            ],
        }

        with patch.object(self.backend, "get_lora_inventory", return_value=inventory), \
             patch.object(self.backend.secrets, "choice", side_effect=lambda values: values[-1]):
            resolved_json = self.backend.LocalLoraGallery.resolve_lottery_selection(selection)

        resolved = json.loads(resolved_json)
        self.assertEqual(
            [item["lora"] for item in resolved["items"]],
            ["manual.safetensors", "styles/oil.safetensors"],
        )
        self.assertEqual(resolved["items"][-1]["strength"], 0.7)
        self.assertEqual(resolved["items"][-1]["strength_clip"], 0.5)
        self.assertTrue(resolved["items"][-1]["lottery"])
        self.assertTrue(resolved["lottery"]["resolved"])
        self.assertEqual(resolved["lottery"]["selected_lora"], "styles/oil.safetensors")

    def test_empty_lottery_category_fails_with_a_clear_message(self):
        selection = json.dumps({
            "version": 1,
            "items": [],
            "lottery": {"enabled": True, "folder": "Missing"},
        })
        with patch.object(self.backend, "get_lora_inventory", return_value={"entries": []}):
            with self.assertRaisesRegex(ValueError, "Missing.*has no LoRAs"):
                self.backend.LocalLoraGallery.resolve_lottery_selection(selection)

    def test_lottery_invalidates_each_queue(self):
        selection = json.dumps({
            "version": 1,
            "items": [],
            "lottery": {"enabled": True, "folder": "Styles"},
        })
        with patch.object(self.backend.time, "time_ns", side_effect=[101, 102]):
            first = self.backend.LocalLoraGallery.IS_CHANGED(selection)
            second = self.backend.LocalLoraGallery.IS_CHANGED(selection)
        self.assertNotEqual(first, second)
        self.assertTrue(first.endswith(":101"))
        self.assertTrue(second.endswith(":102"))


if __name__ == "__main__":
    unittest.main()
