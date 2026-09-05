import { collapseWidget, hideWidget } from "../shared/widgets.js";
import { ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT } from "./constants.js";

export function setupPromptPreDomStateWidgets({ nodeInstance }) {
    if (!nodeInstance.properties || !nodeInstance.properties.prompt_gallery_unique_id) {
        if (!nodeInstance.properties) {
            nodeInstance.properties = {};
        }
        nodeInstance.properties.prompt_gallery_unique_id = "prompt-gallery-" + Math.random().toString(36).substring(2, 11);
    }
    if (typeof nodeInstance.properties.active_sidebar_width !== 'number') {
        nodeInstance.properties.active_sidebar_width = ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT;
    }

    const galleryIdWidget = nodeInstance.addWidget(
        "text",
        "prompt_gallery_unique_id_widget",
        nodeInstance.properties.prompt_gallery_unique_id,
        () => { },
        {}
    );

    galleryIdWidget.serializeValue = () => {
        return nodeInstance.properties.prompt_gallery_unique_id;
    };

    collapseWidget(galleryIdWidget);

    const selectionWidget = nodeInstance.addWidget(
        "text",
        "prompt_selection_data",
        nodeInstance.properties.prompt_selection_data || "[]",
        () => { },
        { multiline: true }
    );

    selectionWidget.serializeValue = () => {
        return nodeInstance.properties["prompt_selection_data"] || "[]";
    };

    collapseWidget(selectionWidget);

    const metaTagsWidget = nodeInstance.addWidget(
        "text",
        "prompt_meta_tags",
        nodeInstance.properties.prompt_meta_tags || "[]",
        () => { },
        { multiline: true }
    );

    metaTagsWidget.serializeValue = () => {
        return nodeInstance.properties["prompt_meta_tags"] || "[]";
    };

    collapseWidget(metaTagsWidget);

    const activeSidebarWidthWidget = nodeInstance.addWidget(
        "number",
        "active_sidebar_width",
        nodeInstance.properties.active_sidebar_width || ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
        () => { },
        {}
    );
    activeSidebarWidthWidget.serializeValue = () => {
        return Number(nodeInstance.properties.active_sidebar_width) || ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT;
    };
    hideWidget(activeSidebarWidthWidget);

    return {
        galleryIdWidget,
        selectionWidget,
        metaTagsWidget,
        activeSidebarWidthWidget,
    };
}

export function setupPromptPostDomStateWidgets({ nodeInstance }) {
    const hasWildcardCategories = () => {
        const categoriesValue = nodeInstance.properties?.wildcard_categories;
        if (typeof categoriesValue !== 'string') {
            return Boolean(categoriesValue);
        }
        const value = categoriesValue.trim();
        return Boolean(value && value !== "[]" && value !== "{}");
    };

    const usesWildcards = () => {
        return (nodeInstance.properties?.wildcard_mode || "off") !== "off" && hasWildcardCategories();
    };

    // Wildcard Mode
    let wildcardWidget = nodeInstance.widgets?.find(w => w.name === 'wildcard_mode');
    if (!wildcardWidget) {
        wildcardWidget = nodeInstance.addWidget("text", "wildcard_mode", "off", () => { }, {});
    }
    if (typeof nodeInstance.properties.wildcard_mode === 'string') {
        wildcardWidget.value = nodeInstance.properties.wildcard_mode;
    } else if (typeof wildcardWidget.value === 'string') {
        nodeInstance.properties.wildcard_mode = wildcardWidget.value;
    }
    wildcardWidget.serializeValue = () => {
        return nodeInstance.properties["wildcard_mode"] || "off";
    };
    hideWidget(wildcardWidget);

    let wildcardRngModeWidget = nodeInstance.widgets?.find(w => w.name === 'wildcard_rng_mode');
    if (!wildcardRngModeWidget) {
        wildcardRngModeWidget = nodeInstance.addWidget("text", "wildcard_rng_mode", "seed_stable", () => { }, {});
    }
    if (typeof nodeInstance.properties.wildcard_rng_mode === 'string') {
        wildcardRngModeWidget.value = nodeInstance.properties.wildcard_rng_mode;
    } else if (typeof wildcardRngModeWidget.value === 'string') {
        nodeInstance.properties.wildcard_rng_mode = wildcardRngModeWidget.value;
    }
    wildcardRngModeWidget.serializeValue = () => {
        return nodeInstance.properties["wildcard_rng_mode"] || "seed_stable";
    };
    hideWidget(wildcardRngModeWidget);

    let wildcardShuffleNonceWidget = nodeInstance.widgets?.find(w => w.name === 'wildcard_shuffle_nonce');
    if (!wildcardShuffleNonceWidget) {
        wildcardShuffleNonceWidget = nodeInstance.addWidget("text", "wildcard_shuffle_nonce", "0", () => { }, {});
    }
    if (typeof nodeInstance.properties.wildcard_shuffle_nonce === 'string') {
        wildcardShuffleNonceWidget.value = nodeInstance.properties.wildcard_shuffle_nonce;
    } else if (typeof wildcardShuffleNonceWidget.value === 'string') {
        nodeInstance.properties.wildcard_shuffle_nonce = wildcardShuffleNonceWidget.value;
    }
    wildcardShuffleNonceWidget.serializeValue = () => {
        return nodeInstance.properties["wildcard_shuffle_nonce"] || "0";
    };
    hideWidget(wildcardShuffleNonceWidget);

    let wildcardAutoAttachThumbnailWidget = nodeInstance.widgets?.find(w => w.name === 'wildcard_auto_attach_thumbnail');
    if (!wildcardAutoAttachThumbnailWidget) {
        wildcardAutoAttachThumbnailWidget = nodeInstance.addWidget("text", "wildcard_auto_attach_thumbnail", "off", () => { }, {});
    }
    if (typeof nodeInstance.properties.wildcard_auto_attach_thumbnail === 'string') {
        wildcardAutoAttachThumbnailWidget.value = nodeInstance.properties.wildcard_auto_attach_thumbnail;
    } else if (typeof wildcardAutoAttachThumbnailWidget.value === 'string') {
        nodeInstance.properties.wildcard_auto_attach_thumbnail = wildcardAutoAttachThumbnailWidget.value;
    }
    wildcardAutoAttachThumbnailWidget.serializeValue = () => {
        return nodeInstance.properties["wildcard_auto_attach_thumbnail"] || "off";
    };
    hideWidget(wildcardAutoAttachThumbnailWidget);

    // Wildcard Categories
    let categoriesWidget = nodeInstance.widgets?.find(w => w.name === 'wildcard_categories');
    if (!categoriesWidget) {
        categoriesWidget = nodeInstance.addWidget("text", "wildcard_categories", "", () => { }, {});
    }
    if (typeof nodeInstance.properties.wildcard_categories === 'string') {
        categoriesWidget.value = nodeInstance.properties.wildcard_categories;
    } else if (typeof categoriesWidget.value === 'string') {
        nodeInstance.properties.wildcard_categories = categoriesWidget.value;
    }
    categoriesWidget.serializeValue = () => {
        return nodeInstance.properties["wildcard_categories"] || "[]";
    };
    hideWidget(categoriesWidget);

    // Seed
    let seedWidget = nodeInstance.widgets?.find(w => w.name === 'seed');
    if (!seedWidget) {
        seedWidget = nodeInstance.addWidget("number", "seed", 0, (v) => { }, { min: 0, max: 0xffffffffffffffff });
    }
    seedWidget.serializeValue = () => {
        if (!usesWildcards()) {
            return 0;
        }
        const value = Number(seedWidget.value);
        return Number.isFinite(value) ? value : 0;
    };
    hideWidget(seedWidget);

    // Control After Generate
    let controlWidget = nodeInstance.widgets?.find(w => w.name === 'control_after_generate');
    if (!controlWidget) {
        controlWidget = nodeInstance.addWidget("combo", "control_after_generate", "fixed",
            (v) => { },
            { values: ["fixed", "increment", "decrement", "randomize"] }
        );
    }
    hideWidget(controlWidget);

    return {
        wildcardWidget,
        wildcardRngModeWidget,
        wildcardShuffleNonceWidget,
        wildcardAutoAttachThumbnailWidget,
        categoriesWidget,
        seedWidget,
        controlWidget,
    };
}
