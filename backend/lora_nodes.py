"""The Local Lora Gallery nodes: apply the selected LoRAs and build trigger words."""

import copy
import hashlib
import json
import os
import secrets
import time

from nodes import LoraLoader, LoraLoaderModelOnly
import folder_paths

from .lora_library import METADATA_LOCK, get_lora_inventory, load_execution_metadata, save_metadata
from .lora_lookup import get_metadata_for_lora
from .value_utils import finite_float, parse_json_list

NunchakuFluxLoraLoader = None
NunchakuQwenLoraLoader = None
is_nunchaku_flux_available = False
is_nunchaku_qwen_available = False

try:
    from nodes import NODE_CLASS_MAPPINGS

    if "NunchakuFluxLoraLoader" in NODE_CLASS_MAPPINGS:
        NunchakuFluxLoraLoader = NODE_CLASS_MAPPINGS["NunchakuFluxLoraLoader"]
        is_nunchaku_flux_available = True
        print("✅ Local Lora Gallery: Nunchaku Flux integration enabled.")

    if "NunchakuQwenImageLoraLoader" in NODE_CLASS_MAPPINGS:
        NunchakuQwenLoraLoader = NODE_CLASS_MAPPINGS["NunchakuQwenImageLoraLoader"]
        is_nunchaku_qwen_available = True
        print("✅ Local Lora Gallery: Nunchaku Qwen Image integration enabled.")

except Exception as e:
    print(f"INFO: Local Lora Gallery - Nunchaku nodes not found or failed to load. Running in standard mode. Error: {e}")


class BaseLoraGallery:
    """Base class for common functionality."""

    @staticmethod
    def _get_selected_trigger_preset_names(config):
        selected_presets = config.get('selected_presets')
        if isinstance(selected_presets, list):
            names = [name for name in selected_presets if isinstance(name, str) and name]
            # Empty list must fall through to selected_preset (single-select path).
            if names:
                return names

        selected_preset = config.get('selected_preset')
        if isinstance(selected_preset, str) and selected_preset:
            return [selected_preset]
        if selected_preset and not isinstance(selected_preset, (list, dict)):
            return [str(selected_preset)]

        return []

    @classmethod
    def _get_trigger_words_for_config(cls, lora_meta, config):
        triggers = lora_meta.get('trigger_words', '').strip()
        preset_names = cls._get_selected_trigger_preset_names(config)
        if not preset_names:
            return triggers

        presets = lora_meta.get('trigger_presets', {})
        preset_triggers = [
            presets[preset_name].strip()
            for preset_name in preset_names
            if preset_name in presets and isinstance(presets[preset_name], str) and presets[preset_name].strip()
        ]
        return ", ".join(preset_triggers) if preset_triggers else triggers

    @staticmethod
    def _parse_selection_data(selection_data):
        return parse_json_list(selection_data)

    @staticmethod
    def _parse_selection_envelope(selection_data):
        if isinstance(selection_data, dict):
            return copy.deepcopy(selection_data)
        if not isinstance(selection_data, str):
            return None
        try:
            parsed = json.loads(selection_data or "[]")
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
        return copy.deepcopy(parsed) if isinstance(parsed, dict) else None

    @classmethod
    def _get_lottery_config(cls, selection_data):
        envelope = cls._parse_selection_envelope(selection_data)
        lottery = envelope.get("lottery") if isinstance(envelope, dict) else None
        return lottery if isinstance(lottery, dict) and lottery.get("enabled") else None

    @classmethod
    def resolve_lottery_selection(cls, selection_data):
        """Resolve one category-scoped LoRA for this execution only."""
        envelope = cls._parse_selection_envelope(selection_data)
        lottery = envelope.get("lottery") if isinstance(envelope, dict) else None
        if not isinstance(lottery, dict) or not lottery.get("enabled") or lottery.get("resolved"):
            return selection_data

        folder = str(lottery.get("folder") or "").strip()
        candidates = [
            entry for entry in get_lora_inventory()["entries"]
            if not folder or entry["folder"] == folder
        ]
        if not candidates:
            label = folder.replace("\\", "/") if folder else "All folders"
            raise ValueError(f"LocalLoraGallery: Lottery category '{label}' has no LoRAs.")

        chosen = secrets.choice(candidates)
        items = envelope.get("items")
        if not isinstance(items, list):
            items = []
        else:
            items = copy.deepcopy(items)

        chosen_name = chosen["name"]
        if not any(isinstance(item, dict) and item.get("lora") == chosen_name for item in items):
            strength_model = finite_float(lottery.get("strength", 1.0), 1.0)
            strength_clip = finite_float(lottery.get("strength_clip", strength_model), strength_model)
            items.append({
                "on": True,
                "lora": chosen_name,
                "strength": strength_model,
                "strength_clip": strength_clip,
                "lottery": True,
            })

        envelope["items"] = items
        envelope["lottery"] = {
            **lottery,
            "resolved": True,
            "selected_lora": chosen_name,
        }
        category_label = folder.replace("\\", "/") if folder else "All folders"
        print(f"LocalLoraGallery: Lottery selected '{chosen_name}' from '{category_label}'.")
        return json.dumps(envelope)

    @staticmethod
    def _float_config_value(config, key, fallback):
        return finite_float(config.get(key, fallback), fallback)

    @classmethod
    def MODEL_CHANGED(cls, selection_data, **kwargs):
        selection_data = cls.resolve_lottery_selection(selection_data)
        model_state = []
        for config in cls._parse_selection_data(selection_data):
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            strength_model = cls._float_config_value(config, 'strength', 1.0)
            strength_clip = cls._float_config_value(config, 'strength_clip', strength_model)
            if strength_model == 0 and strength_clip == 0:
                continue

            model_state.append({
                "lora": str(config.get('lora')),
                "strength": strength_model,
                "strength_clip": strength_clip,
            })

        return json.dumps(model_state, sort_keys=True)

    @classmethod
    def get_trigger_words_for_selection(cls, selection_data):
        selection_data = cls.resolve_lottery_selection(selection_data)
        all_metadata = load_execution_metadata()
        trigger_words_list = []

        for config in cls._parse_selection_data(selection_data):
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            with METADATA_LOCK:
                lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
                if metadata_changed:
                    try:
                        save_metadata(all_metadata)
                    except Exception as e:
                        print(f"LocalLoraGallery: Failed to persist migrated metadata: {e}")

            triggers = cls._get_trigger_words_for_config(lora_meta, config)
            if triggers:
                trigger_words_list.append(triggers)

        return ", ".join(trigger_words_list)
    
    @classmethod
    def IS_CHANGED(cls, selection_data, **kwargs):
        lottery_enabled = cls._get_lottery_config(selection_data) is not None
        lora_configs = cls._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_state = ""

        for config in lora_configs:
            if not config.get('on', True) or not config.get('lora'):
                continue
            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            with METADATA_LOCK:
                lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
                if metadata_changed:
                    try:
                        save_metadata(all_metadata)
                    except Exception as e:
                        print(f"LocalLoraGallery: Failed to persist migrated metadata: {e}")
            
            triggers = cls._get_trigger_words_for_config(lora_meta, config)
                    
            trigger_state += triggers

        if trigger_state:
            m = hashlib.sha256()
            m.update((selection_data + trigger_state).encode('utf-8'))
            signature = m.hexdigest()
            return f"{signature}:{time.time_ns()}" if lottery_enabled else signature

        return f"{selection_data}:{time.time_ns()}" if lottery_enabled else selection_data

    def _get_nunchaku_model_type(self, model):
        """Checks if the model is a Nunchaku-accelerated model and returns its type."""
        if not (is_nunchaku_flux_available or is_nunchaku_qwen_available):
            return 'none'
        
        if not hasattr(model.model, 'diffusion_model'):
            return 'none'
            
        wrapper_class_name = model.model.diffusion_model.__class__.__name__
        
        if wrapper_class_name == 'ComfyFluxWrapper' and is_nunchaku_flux_available:
            return 'flux'
        elif wrapper_class_name == 'ComfyQwenImageWrapper' and is_nunchaku_qwen_available:
            return 'qwen'
        
        return 'none'


class LocalLoraGallery(BaseLoraGallery):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"model": ("MODEL",), "clip": ("CLIP",)}, 
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True})
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "trigger_words")

    FUNCTION = "load_loras"
    CATEGORY = "📜Asset Gallery/Loras"

    @staticmethod
    def _parse_compare_strengths(strengths):
        if isinstance(strengths, (list, tuple)):
            raw_values = strengths
        else:
            raw_values = str(strengths or "").split(",")

        parsed = []
        for value in raw_values:
            text = str(value).strip()
            if not text:
                continue
            try:
                strength = float(text)
            except (TypeError, ValueError):
                continue
            if strength != strength or strength in (float("inf"), float("-inf")):
                continue
            parsed.append(strength)
        return parsed or [1.0]

    def load_loras_independently(self, model, clip, selection_data="[]", strengths="1.0"):
        """Build independent base-model variants for every enabled LoRA/strength pair."""
        selection_data = self.resolve_lottery_selection(selection_data)
        lora_configs = self._parse_selection_data(selection_data)
        compare_strengths = self._parse_compare_strengths(strengths)
        all_metadata = load_execution_metadata()
        nunchaku_model_type = self._get_nunchaku_model_type(model)

        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGallery: Using NunchakuFluxLoraLoader for comparison.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGallery: Using NunchakuQwenImageLoraLoader for comparison.")
        else:
            loader_instance = LoraLoader()
            print("LocalLoraGallery: Using standard LoraLoader for comparison.")

        models_output = []
        clips_output = []
        trigger_words_output = []
        metadata_output = []
        enabled_count = 0

        for config in lora_configs:
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            enabled_count += 1
            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            with METADATA_LOCK:
                lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
                if metadata_changed:
                    try:
                        save_metadata(all_metadata)
                    except Exception as e:
                        print(f"LocalLoraGallery: Failed to persist migrated metadata: {e}")
            triggers = self._get_trigger_words_for_config(lora_meta, config)
            metadata_name = os.path.splitext(os.path.basename(lora_name))[0]

            for strength in compare_strengths:
                try:
                    # Every variant deliberately starts from the original inputs.
                    if nunchaku_model_type in ['flux', 'qwen']:
                        (variant_model,) = loader_instance.load_lora(model, lora_name, strength)
                        variant_clip = clip
                    else:
                        variant_model, variant_clip = loader_instance.load_lora(
                            model,
                            clip,
                            lora_name,
                            strength,
                            strength,
                        )

                    models_output.append(variant_model)
                    clips_output.append(variant_clip)
                    trigger_words_output.append(triggers)
                    metadata_output.append(f"{metadata_name}_strength_{strength:g}")
                except Exception as e:
                    print(
                        f"LocalLoraGallery: Failed comparison variant "
                        f"'{lora_name}' at strength {strength:g}: {e}"
                    )

        if not models_output:
            if enabled_count:
                raise ValueError("LocalLoraGallery: No LoRA comparison variants could be loaded.")
            return ([model], [clip], [""], ["base_model"])

        print(f"LocalLoraGallery: Built {len(models_output)} independent comparison variants.")
        return (models_output, clips_output, trigger_words_output, metadata_output)

    def load_loras(self, model, clip, unique_id, selection_data="[]", **kwargs):
        selection_data = self.resolve_lottery_selection(selection_data)
        lora_configs = self._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_words_list = []

        current_model, current_clip = model, clip
        applied_count = 0

        nunchaku_model_type = self._get_nunchaku_model_type(model)
        loader_instance = None
        
        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGallery: Using NunchakuFluxLoraLoader.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGallery: Using NunchakuQwenImageLoraLoader.")
        else:
            loader_instance = LoraLoader()
            print("LocalLoraGallery: Using standard LoraLoader.")

        for config in lora_configs:
            if not isinstance(config, dict):
                continue
            if not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']

            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            with METADATA_LOCK:
                lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
                if metadata_changed:
                    try:
                        save_metadata(all_metadata)
                    except Exception as e:
                        print(f"LocalLoraGallery: Failed to persist migrated metadata: {e}")
            triggers = self._get_trigger_words_for_config(lora_meta, config)

            try:
                strength_model = self._float_config_value(config, 'strength', 1.0)
                strength_clip = self._float_config_value(config, 'strength_clip', strength_model)

                if strength_model == 0 and strength_clip == 0:
                    continue

                if nunchaku_model_type in ['flux', 'qwen']:
                    (current_model,) = loader_instance.load_lora(current_model, lora_name, strength_model)
                else:
                    current_model, current_clip = loader_instance.load_lora(current_model, current_clip, lora_name, strength_model, strength_clip)

                applied_count += 1
                if triggers:
                    trigger_words_list.append(triggers)
            except Exception as e:
                print(f"LocalLoraGallery: Failed to load LoRA '{lora_name}': {e}")

        print(f"LocalLoraGallery: Applied {applied_count} LoRAs.")

        trigger_words_string = ", ".join(trigger_words_list)
        return (current_model, current_clip, trigger_words_string)


class LocalLoraGalleryModelOnly(BaseLoraGallery):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"model": ("MODEL",)}, 
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True})
            }
        }

    RETURN_TYPES = ("MODEL", "STRING")
    RETURN_NAMES = ("MODEL", "trigger_words")

    FUNCTION = "load_loras"
    CATEGORY = "📜Asset Gallery/Loras"

    def load_loras(self, model, unique_id, selection_data="[]", **kwargs):
        selection_data = self.resolve_lottery_selection(selection_data)
        lora_configs = self._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_words_list = []

        current_model = model
        applied_count = 0

        nunchaku_model_type = self._get_nunchaku_model_type(model)
        loader_instance = None

        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGalleryModelOnly: Using NunchakuFluxLoraLoader.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGalleryModelOnly: Using NunchakuQwenImageLoraLoader.")
        else:
            loader_instance = LoraLoaderModelOnly()
            print("LocalLoraGalleryModelOnly: Using standard LoraLoaderModelOnly.")

        for config in lora_configs:
            if not isinstance(config, dict):
                continue
            if not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']

            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            with METADATA_LOCK:
                lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
                if metadata_changed:
                    try:
                        save_metadata(all_metadata)
                    except Exception as e:
                        print(f"LocalLoraGalleryModelOnly: Failed to persist migrated metadata: {e}")
            triggers = self._get_trigger_words_for_config(lora_meta, config)

            try:
                strength_model = self._float_config_value(config, 'strength', 1.0)
                if strength_model == 0:
                    continue

                if nunchaku_model_type in ['flux', 'qwen']:
                    (current_model,) = loader_instance.load_lora(current_model, lora_name, strength_model)
                else:
                    (current_model,) = loader_instance.load_lora_model_only(current_model, lora_name, strength_model)

                applied_count += 1
                if triggers:
                    trigger_words_list.append(triggers)
            except Exception as e:
                print(f"LocalLoraGalleryModelOnly: Failed to load LoRA '{lora_name}': {e}")

        print(f"LocalLoraGalleryModelOnly: Applied {applied_count} LoRAs.")

        trigger_words_string = ", ".join(trigger_words_list)
        return (current_model, trigger_words_string)


NODE_CLASS_MAPPINGS = {
    "LocalLoraGallery": LocalLoraGallery,
    "LocalLoraGalleryModelOnly": LocalLoraGalleryModelOnly
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalLoraGallery": "Local Lora Gallery",
    "LocalLoraGalleryModelOnly": "Local Lora Gallery (Model Only)"
}
