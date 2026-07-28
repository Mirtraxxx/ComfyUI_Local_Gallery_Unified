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


def _import_modules():
    sys.modules.setdefault(
        "folder_paths",
        types.SimpleNamespace(
            get_filename_list=lambda _kind: [],
            get_folder_paths=lambda _kind: [],
            get_full_path=lambda _kind, name: name,
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
    backend = importlib.import_module("backend.Local_Lora_Gallery")
    unified = importlib.import_module("Local_Gallery_Unified")
    return backend, unified


class _RecordingLoader:
    calls = []

    def load_lora(self, model, clip, lora_name, strength_model, strength_clip):
        self.calls.append((model, clip, lora_name, strength_model, strength_clip))
        return (
            f"{model}+{lora_name}@{strength_model:g}",
            f"{clip}+{lora_name}@{strength_clip:g}",
        )


class _PromptNode:
    def process(self, **_kwargs):
        return ("prompt",)


class LoraCompareModeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend, cls.unified = _import_modules()

    def setUp(self):
        _RecordingLoader.calls = []
        node_class = self.unified.LocalGalleryPromptLora
        node_class._LORA_CACHE_KEY = None
        node_class._LORA_CACHE_VALUE = None
        node_class._LORA_COMPARE_CACHE_KEY = None
        node_class._LORA_COMPARE_CACHE_VALUE = None

    def test_compare_variants_each_start_from_original_model_and_clip(self):
        selection = json.dumps([
            {"lora": "epoch12.safetensors", "on": True},
            {"lora": "epoch14.safetensors", "on": True},
        ])
        metadata = {
            "epoch12.safetensors": {"trigger_words": "epoch twelve"},
            "epoch14.safetensors": {"trigger_words": "epoch fourteen"},
        }

        with patch.object(self.backend, "LoraLoader", _RecordingLoader), \
             patch.object(self.backend.LocalLoraGallery, "_get_nunchaku_model_type", return_value="none"), \
             patch.object(self.backend, "load_execution_metadata", return_value=metadata), \
             patch.object(
                 self.backend,
                 "get_metadata_for_lora",
                 side_effect=lambda all_metadata, name, _path: (all_metadata[name], False),
             ):
            result = self.backend.LocalLoraGallery().load_loras_independently(
                "base-model",
                "base-clip",
                selection,
                "0.8, 1.0",
            )

        self.assertEqual(len(_RecordingLoader.calls), 4)
        self.assertTrue(all(call[0] == "base-model" for call in _RecordingLoader.calls))
        self.assertTrue(all(call[1] == "base-clip" for call in _RecordingLoader.calls))
        self.assertEqual(
            [call[2:] for call in _RecordingLoader.calls],
            [
                ("epoch12.safetensors", 0.8, 0.8),
                ("epoch12.safetensors", 1.0, 1.0),
                ("epoch14.safetensors", 0.8, 0.8),
                ("epoch14.safetensors", 1.0, 1.0),
            ],
        )
        self.assertEqual(
            result[3],
            [
                "epoch12_strength_0.8",
                "epoch12_strength_1",
                "epoch14_strength_0.8",
                "epoch14_strength_1",
            ],
        )

    def test_unified_stack_mode_wraps_existing_outputs_in_one_item_lists(self):
        node_class = self.unified.LocalGalleryPromptLora
        with patch.object(
            node_class,
            "_get_cached_lora_outputs",
            return_value=("stacked-model", "stacked-clip", "stack triggers"),
        ), patch.object(self.unified, "LocalPromptGallery", _PromptNode):
            result = node_class().process("base-model", "base-clip")

        self.assertEqual(
            result["result"],
            (
                ["stacked-model"],
                ["stacked-clip"],
                ["stack triggers"],
                "prompt",
                ["stack"],
            ),
        )

    def test_unified_compare_mode_returns_independent_variant_lists(self):
        node_class = self.unified.LocalGalleryPromptLora
        compare_outputs = (
            ["model-a", "model-b"],
            ["clip-a", "clip-b"],
            ["trigger-a", "trigger-b"],
            ["epoch12_strength_1", "epoch14_strength_1"],
        )
        with patch.object(
            node_class,
            "_get_cached_lora_compare_outputs",
            return_value=compare_outputs,
        ), patch.object(self.unified, "LocalPromptGallery", _PromptNode):
            result = node_class().process(
                "base-model",
                "base-clip",
                lora_execution_mode="compare",
            )

        self.assertEqual(
            result["result"],
            (*compare_outputs[:3], "prompt", compare_outputs[3]),
        )
        self.assertEqual(
            node_class.OUTPUT_IS_LIST,
            (True, True, True, False, True),
        )

    def test_execution_mode_and_strengths_are_read_from_selection_envelope(self):
        selection = json.dumps({
            "version": 1,
            "items": [{"lora": "epoch12.safetensors", "on": True}],
            "execution": {"mode": "compare", "strengths": "0.7, 0.9"},
        })

        self.assertEqual(
            self.unified.LocalGalleryPromptLora._get_lora_execution_options(selection),
            ("compare", "0.7, 0.9"),
        )


if __name__ == "__main__":
    unittest.main()
