import { collapseWidget } from "../shared/widgets.js";

export function setupLoraStateWidgets({ nodeInstance }) {
    if (!nodeInstance.properties || !nodeInstance.properties.lora_gallery_unique_id) {
        if (!nodeInstance.properties) {
            nodeInstance.properties = {};
        }
        nodeInstance.properties.lora_gallery_unique_id = "lora-gallery-" + Math.random().toString(36).substring(2, 11);
    }

    const galleryIdWidget = nodeInstance.addWidget(
        "text",
        "lora_gallery_unique_id_widget",
        nodeInstance.properties.lora_gallery_unique_id,
        () => {},
        {}
    );

    galleryIdWidget.serializeValue = () => {
        return nodeInstance.properties.lora_gallery_unique_id;
    };

    collapseWidget(galleryIdWidget);

    const selectionWidget = nodeInstance.addWidget(
        "text",
        "lora_selection_data",
        nodeInstance.properties.lora_selection_data || "[]",
        () => {},
        { multiline: true }
    );

    selectionWidget.serializeValue = () => {
        return nodeInstance.properties["lora_selection_data"] || "[]";
    };

    collapseWidget(selectionWidget);

    return {
        galleryIdWidget,
        selectionWidget,
    };
}
