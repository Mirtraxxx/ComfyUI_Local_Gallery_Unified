import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js";
import { registerLoraGalleryUi } from "./lora/ui.js";
import { registerPromptGalleryUi } from "./prompt/ui.js?v=browse-workspace-load-20260608";

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

