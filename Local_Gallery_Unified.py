import json
import time

try:
    from .backend.Local_Lora_Gallery import LocalLoraGallery
    from .backend.Local_Prompt_Gallery import LocalPromptGallery
    from .backend.value_utils import parse_json_list
except ImportError:
    from backend.Local_Lora_Gallery import LocalLoraGallery
    from backend.Local_Prompt_Gallery import LocalPromptGallery
    from backend.value_utils import parse_json_list


class LocalGalleryPromptLora:
    _LORA_CACHE_KEY = None
    _LORA_CACHE_VALUE = None
    _LORA_COMPARE_CACHE_KEY = None
    _LORA_COMPARE_CACHE_VALUE = None

    @staticmethod
    def _has_wildcard_categories(wildcard_categories):
        if not wildcard_categories:
            return False
        if isinstance(wildcard_categories, str):
            value = wildcard_categories.strip()
            return bool(value and value not in ("[]", "{}"))
        return True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
            },
            "optional": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "hidden": {
                "lora_selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True}),
                "prompt_selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True}),
                "prompt_meta_tags": ("STRING", {"default": "[]", "multiline": True, "forceInput": True}),
                "wildcard_categories": "STRING",
                "wildcard_mode": "STRING",
                "wildcard_rng_mode": "STRING",
                "wildcard_shuffle_nonce": "STRING",
                "wildcard_auto_attach_thumbnail": "STRING",
                "active_tab": "STRING",
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "lora_trigger_words", "combined_prompt", "lora_variant_metadata")
    OUTPUT_IS_LIST = (True, True, True, False, True)
    FUNCTION = "process"
    CATEGORY = "Asset Gallery"

    @classmethod
    def _get_lora_change_signature(cls, lora_cls, lora_selection_data):
        if lora_cls and hasattr(lora_cls, "IS_CHANGED"):
            try:
                return lora_cls.IS_CHANGED(lora_selection_data)
            except Exception:
                pass
        return lora_selection_data

    @classmethod
    def _get_lora_model_signature(cls, lora_cls, lora_selection_data):
        if lora_cls and hasattr(lora_cls, "MODEL_CHANGED"):
            try:
                return lora_cls.MODEL_CHANGED(lora_selection_data)
            except Exception:
                pass
        return cls._get_lora_change_signature(lora_cls, lora_selection_data)

    @classmethod
    def _get_lora_trigger_words(cls, lora_cls, lora_selection_data):
        if lora_cls and hasattr(lora_cls, "get_trigger_words_for_selection"):
            try:
                return lora_cls.get_trigger_words_for_selection(lora_selection_data)
            except Exception:
                pass
        return ""

    @staticmethod
    def _get_lora_execution_options(lora_selection_data, mode="stack", strengths="1.0"):
        try:
            parsed = json.loads(lora_selection_data or "[]") if isinstance(lora_selection_data, str) else None
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None
        execution = parsed.get("execution") if isinstance(parsed, dict) else None
        if isinstance(execution, dict):
            mode = execution.get("mode", mode)
            strengths = execution.get("strengths", strengths)
        normalized_mode = "compare" if str(mode or "").strip().lower() == "compare" else "stack"
        normalized_strengths = str(strengths or "1.0").strip() or "1.0"
        return normalized_mode, normalized_strengths

    @classmethod
    def _get_cached_lora_outputs(cls, model, clip, lora_cls, lora_selection_data):
        lora_signature = cls._get_lora_model_signature(lora_cls, lora_selection_data)
        cache_key = (id(model), id(clip), lora_signature)
        if cls._LORA_CACHE_KEY == cache_key and cls._LORA_CACHE_VALUE is not None:
            model_out, clip_out = cls._LORA_CACHE_VALUE
            lora_trigger_words = cls._get_lora_trigger_words(lora_cls, lora_selection_data or "[]")
            return model_out, clip_out, lora_trigger_words

        model_out, clip_out, lora_trigger_words = lora_cls().load_loras(
            model,
            clip,
            "unified-gallery",
            lora_selection_data or "[]",
        )
        cls._LORA_CACHE_KEY = cache_key
        cls._LORA_CACHE_VALUE = (model_out, clip_out)
        return model_out, clip_out, lora_trigger_words

    @classmethod
    def _get_cached_lora_compare_outputs(
        cls,
        model,
        clip,
        lora_cls,
        lora_selection_data,
        lora_compare_strengths,
    ):
        lora_signature = cls._get_lora_change_signature(lora_cls, lora_selection_data)
        cache_key = (id(model), id(clip), lora_signature, str(lora_compare_strengths or "1.0"))
        if cls._LORA_COMPARE_CACHE_KEY == cache_key and cls._LORA_COMPARE_CACHE_VALUE is not None:
            return cls._LORA_COMPARE_CACHE_VALUE

        outputs = lora_cls().load_loras_independently(
            model,
            clip,
            lora_selection_data or "[]",
            lora_compare_strengths or "1.0",
        )
        cls._LORA_COMPARE_CACHE_KEY = cache_key
        cls._LORA_COMPARE_CACHE_VALUE = outputs
        return outputs

    @classmethod
    def IS_CHANGED(
        cls,
        model,
        clip,
        seed=0,
        lora_selection_data="[]",
        lora_execution_mode="stack",
        lora_compare_strengths="1.0",
        prompt_selection_data="[]",
        prompt_meta_tags="[]",
        wildcard_categories="",
        wildcard_mode="off",
        wildcard_rng_mode="seed_stable",
        wildcard_shuffle_nonce="0",
        wildcard_auto_attach_thumbnail="off",
        active_tab="prompt",
        **kwargs,
    ):
        lora_execution_mode, lora_compare_strengths = cls._get_lora_execution_options(
            lora_selection_data,
            lora_execution_mode,
            lora_compare_strengths,
        )
        lora_changed = cls._get_lora_change_signature(LocalLoraGallery, lora_selection_data)
        uses_wildcards = (wildcard_mode or "off") != "off" and cls._has_wildcard_categories(wildcard_categories)

        return json.dumps(
            {
                "lora": lora_changed,
                "lora_execution_mode": lora_execution_mode,
                "lora_compare_strengths": lora_compare_strengths,
                "prompt": prompt_selection_data,
                "prompt_meta_tags": prompt_meta_tags,
                "wildcard_categories": wildcard_categories,
                "wildcard_mode": wildcard_mode,
                "wildcard_rng_mode": wildcard_rng_mode,
                "wildcard_shuffle_nonce": wildcard_shuffle_nonce,
                "wildcard_auto_attach_thumbnail": wildcard_auto_attach_thumbnail,
                "fresh_wildcard_nonce": time.time() if uses_wildcards and wildcard_rng_mode == "fresh" else "",
                "seed": seed if uses_wildcards else "",
            },
            sort_keys=True,
        )

    @classmethod
    def _get_enabled_meta_prompt_parts(cls, prompt_meta_tags):
        meta_tags = parse_json_list(prompt_meta_tags)

        enabled_tags = []
        for index, tag in enumerate(meta_tags):
            if not isinstance(tag, dict) or not tag.get("enabled", False):
                continue
            prompt_text = str(tag.get("prompt_text") or tag.get("prompt") or "").strip()
            if not prompt_text:
                continue
            order = tag.get("order", tag.get("index", index))
            try:
                order = int(order)
            except (TypeError, ValueError):
                order = index
            enabled_tags.append((order, index, tag, prompt_text))

        if not enabled_tags:
            return []

        enabled_tags.sort(key=lambda item: (item[0], item[1]))
        return [prompt_text for _, _, _, prompt_text in enabled_tags]

    def process(
        self,
        model,
        clip,
        seed=0,
        lora_selection_data="[]",
        lora_execution_mode="stack",
        lora_compare_strengths="1.0",
        prompt_selection_data="[]",
        prompt_meta_tags="[]",
        wildcard_categories="",
        wildcard_mode="off",
        wildcard_rng_mode="seed_stable",
        wildcard_shuffle_nonce="0",
        wildcard_auto_attach_thumbnail="off",
        active_tab="prompt",
        **kwargs,
    ):
        prompt_node = LocalPromptGallery()

        execution_mode, lora_compare_strengths = self._get_lora_execution_options(
            lora_selection_data,
            lora_execution_mode,
            lora_compare_strengths,
        )
        if execution_mode == "compare":
            models_out, clips_out, trigger_words_out, variant_metadata = self._get_cached_lora_compare_outputs(
                model,
                clip,
                LocalLoraGallery,
                lora_selection_data or "[]",
                lora_compare_strengths or "1.0",
            )
        else:
            model_out, clip_out, lora_trigger_words = self._get_cached_lora_outputs(
                model,
                clip,
                LocalLoraGallery,
                lora_selection_data or "[]",
            )
            models_out = [model_out]
            clips_out = [clip_out]
            trigger_words_out = [lora_trigger_words]
            variant_metadata = ["stack"]

        prompt_result = prompt_node.process(
            seed=seed,
            selection_data=prompt_selection_data or "[]",
            wildcard_categories=wildcard_categories or "",
            wildcard_mode=wildcard_mode or "off",
            wildcard_rng_mode=wildcard_rng_mode or "seed_stable",
            wildcard_shuffle_nonce=wildcard_shuffle_nonce or "0",
            wildcard_auto_attach_thumbnail=wildcard_auto_attach_thumbnail or "off",
        )
        if isinstance(prompt_result, dict):
            result_values = prompt_result.get("result") or ("",)
            combined_prompt = result_values[0] if result_values else ""
            prompt_ui = prompt_result.get("ui") or {}
            wildcard_prompt_ids = prompt_ui.get("wildcard_prompt_ids") or []
        else:
            combined_prompt = prompt_result[0] if prompt_result else ""
            wildcard_prompt_ids = []

        meta_prompt_parts = self._get_enabled_meta_prompt_parts(prompt_meta_tags or "[]")
        if meta_prompt_parts:
            combined_parts = [part for part in [combined_prompt, *meta_prompt_parts] if part]
            combined_prompt = ", ".join(combined_parts)

        return {
            "ui": {
                "text": [combined_prompt],
                "wildcard_prompt_ids": list(dict.fromkeys(wildcard_prompt_ids)),
            },
            "result": (models_out, clips_out, trigger_words_out, combined_prompt, variant_metadata),
        }


NODE_CLASS_MAPPINGS = {
    "LocalGalleryPromptLora": LocalGalleryPromptLora,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalGalleryPromptLora": "Local Gallery: Prompt + LoRA",
}
