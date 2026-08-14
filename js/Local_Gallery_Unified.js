import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js?v=gallery-edge-stable-20260722-8";
import { createLoraGalleryLifecycle } from "./lora/ui.js?v=lora-stepped-browser-cards-20260724-4&compare=lora-compare-mark-20260728-1&profile=workflow-v1-20260725-1&preset=lora-trigger-preset-feedback-20260726-2&metadata=lora-thumbnail-20260728-4&icons=browser-active-match-20260728-1&modules=single-url-20260809-4";
import { createPromptGalleryLifecycle } from "./prompt/ui.js?v=card-manager-compact-align-20260727-3&icons=active-builder-match-20260728-2&library=direct-cards-20260728-2&modules=single-url-20260809-4";

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
