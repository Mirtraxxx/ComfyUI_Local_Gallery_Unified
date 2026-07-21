import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { setupUnifiedGalleryTabs } from "./tabs.js?v=density-80-20260714-3";
import { registerLoraGalleryUi } from "./lora/ui.js?v=bottom-bar-search-20260718-1";
import { registerPromptGalleryUi } from "./prompt/ui.js?v=auto-attach-idle-only-20260720-2";

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

