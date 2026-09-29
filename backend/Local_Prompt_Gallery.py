"""Prompt gallery backend entrypoint.

Importing this module registers the /localgalleryunified/prompt routes and exposes the node.
"""
from . import (  # noqa: F401
    prompt_routes_edit,
    prompt_routes_query,
    prompt_routes_settings,
    prompt_routes_thumbnails,
    prompt_routes_wildcards,
)
from .prompt_node import LocalPromptGallery, NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS  # noqa: F401
