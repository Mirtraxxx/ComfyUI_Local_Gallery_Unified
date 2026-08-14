import importlib
import json
import sys
import types
import unittest
from unittest.mock import patch


class _Routes:
    @staticmethod
    def get(_path):
        return lambda function: function

    post = get


def _import_prompt_backend():
    sys.modules.setdefault("folder_paths", types.SimpleNamespace())
    sys.modules.setdefault(
        "server",
        types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(
                instance=types.SimpleNamespace(routes=_Routes()),
            ),
        ),
    )
    return importlib.import_module("backend.Local_Prompt_Gallery")


class PromptWorkflowOverrideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = _import_prompt_backend()

    def compose(self, selection, metadata):
        with patch.object(self.backend, "load_metadata", return_value=metadata), \
             patch.object(self.backend, "get_metadata_indexes", return_value={}), \
             patch.object(self.backend, "load_ui_prefs", return_value={}):
            result = self.backend.LocalPromptGallery().process(
                selection_data=json.dumps(selection),
                wildcard_mode="off",
            )
        return result["result"][0]

    def test_workflow_override_wins_over_live_card_text(self):
        output = self.compose(
            [{"prompt_id": "card-1", "prompt_text_override": "workflow-only text"}],
            {"card-1": {"prompt_text": "stored card text"}},
        )

        self.assertEqual(output, "workflow-only text")

    def test_blank_override_falls_back_to_live_card_then_missing_card_inline_text(self):
        output = self.compose(
            [
                {"prompt_id": "card-1", "prompt_text_override": "   "},
                {"prompt_id": "missing", "prompt_text": "legacy fallback"},
            ],
            {"card-1": {"prompt_text": "stored card text"}},
        )

        self.assertEqual(output, "stored card text, legacy fallback")

    def test_override_is_used_even_if_its_source_card_is_missing(self):
        output = self.compose(
            [{"prompt_id": "missing", "prompt_text_override": "preserved workflow text", "prompt_text": "legacy fallback"}],
            {},
        )

        self.assertEqual(output, "preserved workflow text")


if __name__ == "__main__":
    unittest.main()
