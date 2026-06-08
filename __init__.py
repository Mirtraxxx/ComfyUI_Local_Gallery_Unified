"""
Unified Local Gallery - combines Local Prompt Gallery and Local LoRA Gallery.
"""

import os

from .Local_Gallery_Unified import (
    NODE_CLASS_MAPPINGS as UNIFIED_NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as UNIFIED_NODE_DISPLAY_NAME_MAPPINGS,
)


def _legacy_folder_exists(folder_name):
    custom_nodes_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.isdir(os.path.join(custom_nodes_dir, folder_name))


NODE_CLASS_MAPPINGS = dict(UNIFIED_NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(UNIFIED_NODE_DISPLAY_NAME_MAPPINGS)

_legacy_prompt_installed = _legacy_folder_exists("Local_Prompt_Gallery")
_legacy_lora_installed = _legacy_folder_exists("ComfyUI_Local_Lora_Gallery")

if not _legacy_prompt_installed:
    from .backend.Local_Prompt_Gallery import (  # noqa: F401
        NODE_CLASS_MAPPINGS as PROMPT_NODE_CLASS_MAPPINGS,
        NODE_DISPLAY_NAME_MAPPINGS as PROMPT_NODE_DISPLAY_NAME_MAPPINGS,
    )

    NODE_CLASS_MAPPINGS.update(PROMPT_NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(PROMPT_NODE_DISPLAY_NAME_MAPPINGS)

if not _legacy_lora_installed:
    from .backend.Local_Lora_Gallery import (  # noqa: F401
        NODE_CLASS_MAPPINGS as LORA_NODE_CLASS_MAPPINGS,
        NODE_DISPLAY_NAME_MAPPINGS as LORA_NODE_DISPLAY_NAME_MAPPINGS,
    )

    NODE_CLASS_MAPPINGS.update(LORA_NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(LORA_NODE_DISPLAY_NAME_MAPPINGS)

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
