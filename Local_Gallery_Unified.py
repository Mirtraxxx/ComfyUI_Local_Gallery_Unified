import json


class LocalGalleryPromptLora:
    _LORA_CACHE_KEY = None
    _LORA_CACHE_VALUE = None

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
                "wildcard_categories": "STRING",
                "wildcard_mode": "STRING",
                "active_tab": "STRING",
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "lora_trigger_words", "combined_prompt")
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
    def _get_cached_lora_outputs(cls, model, clip, lora_cls, lora_selection_data):
        lora_signature = cls._get_lora_change_signature(lora_cls, lora_selection_data)
        cache_key = (id(model), id(clip), lora_signature)
        if cls._LORA_CACHE_KEY == cache_key and cls._LORA_CACHE_VALUE is not None:
            print("LocalGalleryPromptLora: Reusing cached LoRA stack.")
            return cls._LORA_CACHE_VALUE

        lora_outputs = lora_cls().load_loras(
            model,
            clip,
            "unified-gallery",
            lora_selection_data or "[]",
        )
        cls._LORA_CACHE_KEY = cache_key
        cls._LORA_CACHE_VALUE = lora_outputs
        return lora_outputs

    @classmethod
    def IS_CHANGED(
        cls,
        model,
        clip,
        seed=0,
        lora_selection_data="[]",
        prompt_selection_data="[]",
        wildcard_categories="",
        wildcard_mode="off",
        active_tab="prompt",
        **kwargs,
    ):
        try:
            from nodes import NODE_CLASS_MAPPINGS

            lora_cls = NODE_CLASS_MAPPINGS.get("LocalLoraGallery")
            lora_changed = cls._get_lora_change_signature(lora_cls, lora_selection_data)
        except Exception:
            lora_changed = lora_selection_data

        return json.dumps(
            {
                "lora": lora_changed,
                "prompt": prompt_selection_data,
                "wildcard_categories": wildcard_categories,
                "wildcard_mode": wildcard_mode,
                "seed": seed,
            },
            sort_keys=True,
        )

    def process(
        self,
        model,
        clip,
        seed=0,
        lora_selection_data="[]",
        prompt_selection_data="[]",
        wildcard_categories="",
        wildcard_mode="off",
        active_tab="prompt",
        **kwargs,
    ):
        from nodes import NODE_CLASS_MAPPINGS

        lora_cls = NODE_CLASS_MAPPINGS.get("LocalLoraGallery")
        prompt_cls = NODE_CLASS_MAPPINGS.get("LocalPromptGallery")
        if lora_cls is None:
            raise RuntimeError("LocalGalleryPromptLora requires the legacy Local LoRA Gallery node to be enabled.")
        if prompt_cls is None:
            raise RuntimeError("LocalGalleryPromptLora requires the legacy Local Prompt Gallery node to be enabled.")

        prompt_node = prompt_cls()

        model_out, clip_out, lora_trigger_words = self._get_cached_lora_outputs(
            model,
            clip,
            lora_cls,
            lora_selection_data or "[]",
        )

        prompt_result = prompt_node.process(
            seed=seed,
            selection_data=prompt_selection_data or "[]",
            wildcard_categories=wildcard_categories or "",
            wildcard_mode=wildcard_mode or "off",
        )
        if isinstance(prompt_result, dict):
            result_values = prompt_result.get("result") or ("",)
            combined_prompt = result_values[0] if result_values else ""
        else:
            combined_prompt = prompt_result[0] if prompt_result else ""

        return {
            "ui": {"text": [combined_prompt]},
            "result": (model_out, clip_out, lora_trigger_words, combined_prompt),
        }


NODE_CLASS_MAPPINGS = {
    "LocalGalleryPromptLora": LocalGalleryPromptLora,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalGalleryPromptLora": "Local Gallery: Prompt + LoRA",
}
