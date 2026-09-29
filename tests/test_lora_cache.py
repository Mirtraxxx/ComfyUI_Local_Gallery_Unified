import importlib
import base64
import json
import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

from PIL import Image


class _Routes:
    @staticmethod
    def get(_path):
        return lambda function: function

    post = get


def _import_lora_backend():
    folder_paths = types.SimpleNamespace(
        get_filename_list=lambda _kind: [],
        get_folder_paths=lambda _kind: [],
        get_full_path=lambda _kind, _name: None,
    )
    server = types.SimpleNamespace(PromptServer=types.SimpleNamespace(
        instance=types.SimpleNamespace(routes=_Routes()),
    ))
    nodes = types.SimpleNamespace(
        LoraLoader=type("LoraLoader", (), {}),
        LoraLoaderModelOnly=type("LoraLoaderModelOnly", (), {}),
        NODE_CLASS_MAPPINGS={},
    )
    sys.modules.setdefault("folder_paths", folder_paths)
    sys.modules.setdefault("server", server)
    sys.modules.setdefault("nodes", nodes)
    return importlib.import_module("backend.Local_Lora_Gallery")


class LoraInventoryCacheTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _import_lora_backend()
        cls.library = importlib.import_module("backend.lora_library")
        cls.previews = importlib.import_module("backend.lora_routes_previews")

    def setUp(self):
        self.library.invalidate_lora_inventory()

    def test_inventory_reuses_unchanged_entries_and_explicit_invalidation_rebuilds(self):
        with tempfile.TemporaryDirectory() as directory:
            lora_path = os.path.join(directory, "example.safetensors")
            with open(lora_path, "wb") as handle:
                handle.write(b"lora")
            preview_calls = []

            with patch.object(self.library.folder_paths, "get_filename_list", return_value=["example.safetensors"]), \
                 patch.object(self.library.folder_paths, "get_folder_paths", return_value=[directory]), \
                 patch.object(self.previews.folder_paths, "get_full_path", return_value=lora_path), \
                 patch.object(self.library, "load_metadata", return_value={}), \
                 patch.object(self.library, "get_lora_preview_asset_info", side_effect=lambda name: (preview_calls.append(name) or ("", "none"))):
                first = self.library.get_lora_inventory()
                second = self.library.get_lora_inventory()
                self.assertIs(first, second)
                self.assertEqual(preview_calls, ["example.safetensors"])

                self.library.invalidate_lora_inventory()
                third = self.library.get_lora_inventory()
                self.assertIsNot(first, third)
                self.assertEqual(preview_calls, ["example.safetensors", "example.safetensors"])

    def test_execution_metadata_cache_tracks_revision(self):
        with patch.object(self.library, "file_signature", side_effect=[("one", 1), ("one", 1), ("two", 2)]), \
             patch.object(self.library, "load_metadata", side_effect=[{"version": 1}, {"version": 2}]) as load:
            self.library._EXECUTION_METADATA_CACHE = {"signature": None, "data": None}
            self.assertEqual(self.library.load_execution_metadata(), {"version": 1})
            self.assertEqual(self.library.load_execution_metadata(), {"version": 1})
            self.assertEqual(self.library.load_execution_metadata(), {"version": 2})
            self.assertEqual(load.call_count, 2)

    def test_last_output_replaces_preview_and_preserves_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            output_directory = os.path.join(directory, "output")
            lora_directory = os.path.join(directory, "loras")
            backup_directory = os.path.join(directory, "backups")
            os.makedirs(output_directory)
            os.makedirs(lora_directory)
            os.makedirs(backup_directory)

            lora_path = os.path.join(lora_directory, "example.safetensors")
            old_preview_path = os.path.join(lora_directory, "example.jpg")
            new_output_path = os.path.join(output_directory, "latest.png")
            manager_metadata_path = os.path.join(lora_directory, "example.metadata.json")
            with open(lora_path, "wb") as handle:
                handle.write(b"lora")
            with open(old_preview_path, "wb") as handle:
                handle.write(b"old preview")
            with open(new_output_path, "wb") as handle:
                handle.write(base64.b64decode(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
                    "YAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                ))
            with open(manager_metadata_path, "w", encoding="utf-8") as handle:
                json.dump({"preview_url": old_preview_path.replace(os.sep, "/")}, handle)

            with patch.object(self.previews.folder_paths, "get_full_path", return_value=lora_path), \
                 patch.object(self.previews.folder_paths, "get_output_directory", return_value=output_directory, create=True), \
                 patch.object(self.previews, "PREVIEW_BACKUP_DIR", backup_directory):
                preview_url, preview_type = self.previews.assign_lora_preview_file(
                    "example.safetensors",
                    "latest.png",
                )

            new_preview_path = os.path.join(lora_directory, "example.webp")
            self.assertEqual(preview_type, "image")
            self.assertIn("/localgalleryunified/lora/preview?", preview_url)
            with Image.open(new_preview_path) as image:
                self.assertEqual(image.format, "WEBP")
            self.assertFalse(os.path.exists(old_preview_path))
            with open(manager_metadata_path, "r", encoding="utf-8") as handle:
                manager_metadata = json.load(handle)
            self.assertEqual(
                manager_metadata["preview_url"],
                os.path.abspath(new_preview_path).replace(os.sep, "/"),
            )
            backup_names = os.listdir(backup_directory)
            self.assertEqual(len(backup_names), 1)
            self.assertTrue(backup_names[0].endswith("-example.jpg"))


if __name__ == "__main__":
    unittest.main()
