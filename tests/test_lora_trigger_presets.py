import importlib
import sys
import types
import unittest


class _Routes:
    @staticmethod
    def get(_path):
        return lambda function: function

    post = get


def _import_lora_backend():
    sys.modules.setdefault(
        "folder_paths",
        types.SimpleNamespace(
            get_filename_list=lambda _kind: [],
            get_folder_paths=lambda _kind: [],
            get_full_path=lambda _kind, _name: None,
        ),
    )
    sys.modules.setdefault(
        "server",
        types.SimpleNamespace(
            PromptServer=types.SimpleNamespace(
                instance=types.SimpleNamespace(routes=_Routes()),
            ),
        ),
    )
    sys.modules.setdefault(
        "nodes",
        types.SimpleNamespace(
            LoraLoader=type("LoraLoader", (), {}),
            LoraLoaderModelOnly=type("LoraLoaderModelOnly", (), {}),
            NODE_CLASS_MAPPINGS={},
        ),
    )
    return importlib.import_module("backend.Local_Lora_Gallery")


class LoraTriggerPresetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = _import_lora_backend()
        cls.nodes = importlib.import_module("backend.lora_nodes")

    def test_single_selected_preset_replaces_default_triggers(self):
        metadata = {
            "trigger_words": "default trigger",
            "trigger_presets": {"portrait": "portrait trigger"},
        }
        config = {
            "selected_preset": "portrait",
            "selected_presets": ["portrait"],
        }

        self.assertEqual(
            self.nodes.BaseLoraGallery._get_trigger_words_for_config(metadata, config),
            "portrait trigger",
        )

    def test_stacked_presets_are_joined_in_selection_order(self):
        metadata = {
            "trigger_words": "default trigger",
            "trigger_presets": {
                "portrait": "portrait trigger",
                "lighting": "lighting trigger",
            },
        }
        config = {
            "stack_trigger_presets": True,
            "selected_presets": ["portrait", "lighting"],
        }

        self.assertEqual(
            self.nodes.BaseLoraGallery._get_trigger_words_for_config(metadata, config),
            "portrait trigger, lighting trigger",
        )

    def test_empty_selected_presets_falls_back_to_single_selection(self):
        metadata = {
            "trigger_words": "default trigger",
            "trigger_presets": {"portrait": "portrait trigger"},
        }
        config = {
            "selected_preset": "portrait",
            "selected_presets": [],
        }

        self.assertEqual(
            self.nodes.BaseLoraGallery._get_trigger_words_for_config(metadata, config),
            "portrait trigger",
        )


if __name__ == "__main__":
    unittest.main()
