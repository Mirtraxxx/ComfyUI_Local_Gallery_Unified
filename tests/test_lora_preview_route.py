import asyncio
import importlib
import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


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


class _Request:
    """Aiohttp-like request: query values arrive already percent-decoded."""

    def __init__(self, query):
        self.query = query


class LoraPreviewRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _import_lora_backend()
        cls.backend = importlib.import_module("backend.lora_routes_previews")

    def _serve(self, lora_name, filename):
        with tempfile.TemporaryDirectory() as directory:
            safetensors = os.path.join(directory, lora_name)
            preview = os.path.join(directory, filename)
            with open(safetensors, "wb") as handle:
                handle.write(b"safetensors")
            with open(preview, "wb") as handle:
                handle.write(b"media")

            def resolve(_kind, name):
                path = os.path.join(directory, name)
                return path if os.path.exists(path) else None

            with patch.object(self.backend.folder_paths, "get_full_path", resolve):
                return asyncio.run(self.backend.get_preview_image(
                    _Request({"lora_name": lora_name, "filename": filename})
                ))

    def test_preview_with_literal_percent_20_in_name_is_served(self):
        # Civitai downloads encode spaces as "%20" inside the filename itself.
        lora_name = "MM-H320Ana20Armas%20v1.1.safetensors"
        response = self._serve(lora_name, "MM-H320Ana20Armas%20v1.1.mp4")
        self.assertEqual(200, response.status)

    def test_preview_with_encoded_space_is_served(self):
        response = self._serve("My Lora.safetensors", "My Lora.png")
        self.assertEqual(200, response.status)

    def test_preview_outside_the_lora_base_name_is_not_served(self):
        response = self._serve("My Lora.safetensors", "Other Lora.png")
        self.assertEqual(404, response.status)

    def test_traversal_filename_is_rejected(self):
        response = self._serve("My Lora.safetensors", "../evil.png")
        self.assertEqual(403, response.status)


if __name__ == "__main__":
    unittest.main()
