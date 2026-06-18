import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js";
import { registerLoraGalleryUi } from "./lora/ui.js?v=lora-active-name-span-20260618";
import { registerPromptGalleryUi } from "./prompt/ui.js?v=prompt-category-swap-reorder-20260617";

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

