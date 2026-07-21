import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js?v=unified-lifecycle-20260721-1";
import { createLoraGalleryLifecycle } from "./lora/ui.js?v=selection-envelope-v1-20260721";
import { createPromptGalleryLifecycle } from "./prompt/ui.js?v=selection-envelope-v1-20260721";

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
