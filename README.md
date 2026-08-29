# ComfyUI Local Gallery (Prompt + LoRA)

Card-based prompt builder and LoRA stack manager for ComfyUI. One node — **`Local Gallery: Prompt + LoRA`** (`LocalGalleryPromptLora`) — loads your selected LoRAs, builds the visible prompt from prompt cards, and injects hidden meta-tag prompts into the final result.

Everything runs locally against your ComfyUI install: cards, thumbnails, LoRA metadata, and selection state live in the node's `data/` folder.

## Features

**Prompt side**
- Prompt cards organized into categories, with thumbnails
- Card manager: browse, edit, bulk-edit, import, and manage stored prompts
- Active stack: enable/disable cards with weights; they are prepended to whatever prompt you inject
- Hidden prompts (meta tags): injected text appended outside the visible stack
- Wildcard categories with seed-stable or fresh RNG modes
- "From last output" dialog: save the last generated image's prompt back into a card (with optional new category)

**LoRA side**
- LoRA stack with per-LoRA strength and optional CLIP strength
- LoRA presets and trigger-word injection (`lora_trigger_words` output)
- Compare mode: load each LoRA independently for side-by-side variants
- Lottery selection: pick randomly from a set of LoRAs
- Folder browsing, metadata editor, Civitai sync, card previews

## Install

```powershell
cd ComfyUI/custom_nodes
git clone https://github.com/Mirtraxxx/ComfyUI_Local_Gallery_Unified
```

Restart ComfyUI. No external Python dependencies beyond ComfyUI's own stack (`PIL`, `aiohttp`).

## Usage

1. Add the **`Local Gallery: Prompt + LoRA`** node between your model and sampler.
2. Inputs: `model`, `clip`, optional `seed`.
3. Open the node UI (tabs for **Prompt** and **LoRA**) to build your prompt card stack and LoRA stack.
4. Outputs:
   - `MODEL` / `CLIP` — model with selected LoRAs applied
   - `lora_trigger_words` — trigger words for the active LoRAs
   - `combined_prompt` — the assembled prompt (card stack + hidden meta tags)
   - `lora_variant_metadata` — variant labels (stack / compare mode)

Selection state is stored in hidden JSON widgets on the node (`prompt_selection_data`, `lora_selection_data`, `prompt_meta_tags`, wildcard widgets), so selections persist with the workflow and are fully editable via the ComfyUI API — e.g. to script runs or queue generations programmatically.

## Data

Runtime data lives under the node's own folder and is not committed to git:

```
data/prompt_gallery/   # prompt cards, thumbnails, presets, wildcards
data/lora_gallery/     # LoRA metadata, presets, thumbnails
```

Back these up before migrating or cleaning up.

## Legacy compatibility

This node bundles the standalone **Local Prompt Gallery** and **Local LoRA Gallery** node mappings. If a legacy sibling installation (`Local_Prompt_Gallery` / `ComfyUI_local_lora_gallery`) is present, the bundled duplicates are not registered to avoid conflicts.

## Development

```powershell
# JS checks
node --check <changed-js-files>
node --test tests/*.test.mjs

# Python checks
python -m py_compile Local_Gallery_Unified.py __init__.py backend/*.py
python -m unittest discover -s tests -p 'test_*.py'
```

Restart ComfyUI after Python/backend changes. For UI changes, smoke-test the changed surface plus workflow reload and preference persistence after `F5`.

See `AGENTS.md` for the full architecture map and contracts.

## Notes

- The bundled node mappings are only registered when the matching legacy sibling installation is absent (see `__init__.py`).
- Selection readers accept both legacy raw-array and versioned `{ "version": 1, "items": [] }` JSON envelopes.
