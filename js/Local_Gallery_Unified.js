import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js?v=gallery-edge-stable-20260722-8";
import { createLoraGalleryLifecycle } from "./lora/ui.js?v=lora-stepped-browser-cards-20260724-4&compare=lora-compare-mode-20260727-1&profile=workflow-v1-20260725-1&preset=lora-trigger-preset-feedback-20260726-2";
import { createPromptGalleryLifecycle } from "./prompt/ui.js?v=card-manager-compact-align-20260727-3";

const loraLifecycle = createLoraGalleryLifecycle(app);
const promptLifecycle = createPromptGalleryLifecycle(app, api);

app.registerExtension({
    name: "LocalGalleryPromptLora.Unified",
    async setup() {
        await loraLifecycle.setup?.();
        await promptLifecycle.setup?.();
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "LocalGalleryPromptLora") return;

        setupUnifiedGalleryTabs(nodeType, app);
        await loraLifecycle.beforeRegisterNodeDef?.(nodeType, nodeData);
        await promptLifecycle.beforeRegisterNodeDef?.(nodeType, nodeData);
    },
});
