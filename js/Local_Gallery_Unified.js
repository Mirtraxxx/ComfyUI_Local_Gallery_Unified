import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js";
import { registerLoraGalleryUi } from "./lora/ui.js?v=repository-review-20260712";
import { registerPromptGalleryUi } from "./prompt/ui.js?v=prompt-decomposition-20260712";

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

