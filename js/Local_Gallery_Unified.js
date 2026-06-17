import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js";
import { registerLoraGalleryUi } from "./lora/ui.js?v=lora-active-thumb-hydration-20260617";
import { registerPromptGalleryUi } from "./prompt/ui.js?v=cache-stable-wildcard-seed-20260616";

app.registerExtension({
    name: "LocalGalleryPromptLora.Tabs",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "LocalGalleryPromptLora") {
            setupUnifiedGalleryTabs(nodeType);
        }
    },
});

registerLoraGalleryUi(app);

registerPromptGalleryUi(app, api);

