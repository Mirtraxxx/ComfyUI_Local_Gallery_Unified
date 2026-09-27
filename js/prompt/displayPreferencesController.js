import {
    getActiveDisplayMode as resolveActiveDisplayMode,
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getCardManagerCardSizePx as resolveCardManagerCardSizePx,
    getCardsDisplayMode as resolveCardsDisplayMode,
    getThumbnailSizePx as resolveThumbnailSizePx,
    normalizeDisplayMode,
} from "./preferences.js";
import {
    CARD_MANAGER_CARD_SIZE_DEFAULT,
    CARD_MANAGER_FULLSCREEN_CARD_SIZE_DEFAULT,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js";
import {
    getResponsiveThumbnailSizeBounds,
    getThumbnailVariables,
} from "./helpers.js";

/** Owns Prompt Builder, Card Manager, and Active Stack display preferences and controls. */
export function createDisplayPreferencesController({
    widgetContainer,
    uniqueId,
    nodeInstance,
    activeLibraryTab,
    renderLibraryDrawer,
    renderActiveSidebar,
    applyActiveSidebarPreference,
    saveUiPrefs,
    bindMainSortSelect,
}) {
    let thumbnailSizeSaveTimer = null;
    let responsiveSizingFrame = null;
    let responsiveSizingObserver = null;
    let disposed = false;

    function getThumbnailSizePx() { return resolveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getActiveThumbnailSizePx() { return resolveActiveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getCardManagerCardSizePx() { return resolveCardManagerCardSizePx(nodeInstance.uiPrefs); }
    function getActiveDisplayMode() { return resolveActiveDisplayMode(nodeInstance.uiPrefs); }
    function getCardsDisplayMode() { return resolveCardsDisplayMode(nodeInstance.uiPrefs); }

    function applyThumbnailVariables(target, sizePx) {
        const variables = getThumbnailVariables(sizePx);
        target.style.setProperty('--localprompt-thumb-height', `${variables.height}px`);
        target.style.setProperty('--localprompt-thumb-width', `${variables.width}px`);
        target.style.setProperty('--localprompt-thumb-label-size', `${variables.label}px`);
    }

    function getActiveThumbnailBounds() {
        const grid = widgetContainer.querySelector(`#${uniqueId}-active-chips`);
        return getResponsiveThumbnailSizeBounds({
            availableWidth: grid?.clientWidth,
            nodeWidth: nodeInstance.size?.[0],
            minSize: THUMBNAIL_SIZE_MIN,
            maxSize: THUMBNAIL_SIZE_MAX,
        });
    }

    function getEffectiveThumbnailSize(sizePx, bounds) {
        return Math.max(bounds.min, Math.min(bounds.max, sizePx));
    }

    function syncResponsiveThumbnailBounds() {
        const activeBounds = getActiveThumbnailBounds();
        const activeSize = getEffectiveThumbnailSize(getActiveThumbnailSizePx(), activeBounds);
        const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);

        if (activeSlider) {
            activeSlider.min = String(activeBounds.min);
            activeSlider.max = String(activeBounds.max);
            activeSlider.value = String(activeSize);
        }

        // Keep the persisted size as the user's preferred size. The effective
        // CSS value is capped only while the node/surface is constrained, so a
        // later resize can restore the saved size without another preference write.
        const activeSidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
        if (activeSidebar) applyThumbnailVariables(activeSidebar, activeSize);
    }

    function scheduleResponsiveThumbnailBoundsSync() {
        if (disposed || responsiveSizingFrame != null) return;
        responsiveSizingFrame = requestAnimationFrame(() => {
            responsiveSizingFrame = null;
            syncResponsiveThumbnailBounds();
        });
    }

    function syncDisplayOptionAvailability() {
        [
            [getActiveDisplayMode(), `#${uniqueId}-active-thumbnail-size-slider`],
            [getCardsDisplayMode(), `#${uniqueId}-thumbnail-size-slider`],
        ].forEach(([mode, selector]) => {
            const slider = widgetContainer.querySelector(selector);
            if (!slider) return;
            slider.disabled = mode !== "thumbnails";
            slider.title = slider.disabled ? "Only available in Thumbnails mode" : "Thumbnail size";
        });
        const wideInput = widgetContainer.querySelector(`#${uniqueId}-active-wide`);
        if (wideInput) wideInput.disabled = getActiveDisplayMode() !== "thumbnails";
    }

    function syncThumbnailSizeSliders() {
        const cardSlider = widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`);
        const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);
        const cardManagerSlider = widgetContainer.querySelector(`#${uniqueId}-card-manager-size-slider`);
        const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
        const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
        if (cardSlider) cardSlider.value = String(getThumbnailSizePx());
        syncResponsiveThumbnailBounds();
        if (cardManagerSlider) cardManagerSlider.value = String(getCardManagerCardSizePx());
        if (cardModeSelect) cardModeSelect.value = getCardsDisplayMode();
        if (activeModeSelect) activeModeSelect.value = getActiveDisplayMode();
        const dimInput = widgetContainer.querySelector(`#${uniqueId}-dim-unselected`);
        if (dimInput) dimInput.checked = (nodeInstance.uiPrefs.card_contrast_mode || "off") !== "off";
        const wideInput = widgetContainer.querySelector(`#${uniqueId}-active-wide`);
        if (wideInput) wideInput.checked = nodeInstance.uiPrefs.active_card_size_mode === "large";
        const hoverOpenInput = widgetContainer.querySelector(`#${uniqueId}-active-hover-open`);
        if (hoverOpenInput) hoverOpenInput.checked = nodeInstance.uiPrefs.active_sidebar_hover_open !== false;
        syncDisplayOptionAvailability();
    }

    function applyThumbnailSizePreference(sizePx = getThumbnailSizePx()) {
        nodeInstance.uiPrefs.thumbnail_size_px = sizePx;
        applyThumbnailVariables(widgetContainer, sizePx);
        syncThumbnailSizeSliders();
    }

    function applyActiveThumbnailSizePreference(sizePx = getActiveThumbnailSizePx()) {
        nodeInstance.uiPrefs.active_thumbnail_size_px = sizePx;
        syncResponsiveThumbnailBounds();
        syncThumbnailSizeSliders();
    }

    function applyCardManagerCardSizePreference(sizePx = getCardManagerCardSizePx()) {
        const normalizedSize = resolveCardManagerCardSizePx({ card_manager_card_size_px: sizePx });
        nodeInstance.uiPrefs.card_manager_card_size_px = normalizedSize;
        const fullscreenSize = Math.round(normalizedSize * CARD_MANAGER_FULLSCREEN_CARD_SIZE_DEFAULT / CARD_MANAGER_CARD_SIZE_DEFAULT);
        const ownerSelector = `#browse-gallery-grid[data-card-manager-owner="${CSS.escape(String(uniqueId))}"]`;
        document.querySelectorAll(ownerSelector).forEach((grid) => {
            grid.style.setProperty("--localprompt-card-manager-card-width", `${normalizedSize}px`);
            grid.style.setProperty("--localprompt-card-manager-fullscreen-card-width", `${fullscreenSize}px`);
        });
        syncThumbnailSizeSliders();
    }

    function applyCardContrastModePreference() {
        const mode = nodeInstance.uiPrefs.card_contrast_mode || "off";
        const contrastClasses = ["contrast-off", "contrast-dim-inactive", "contrast-dim-by-default"];
        contrastClasses.forEach(cls => widgetContainer.classList.remove(cls));
        widgetContainer.classList.add(`contrast-${mode.replace(/_/g, "-")}`);
        // Restyle only this node's own surfaces. A document-wide query
        // would restyle other nodes' open dialogs, and a node loading
        // later would overwrite the class on them.
        const owned = `[data-card-manager-owner="${uniqueId}"]`;
        const surfaces = [
            ...widgetContainer.querySelectorAll(".localprompt-modal-overlay, .localprompt-workspace-panel"),
            ...document.body.querySelectorAll(
                `.localprompt-modal-overlay${owned}, .localprompt-workspace-panel${owned}, ${owned} .localprompt-modal-overlay, ${owned} .localprompt-workspace-panel`
            ),
        ];
        surfaces.forEach(modal => {
            contrastClasses.forEach(cls => modal.classList.remove(cls));
            modal.classList.add(`contrast-${mode.replace(/_/g, "-")}`);
        });
    }

    function queueThumbnailSizeSave() {
        if (thumbnailSizeSaveTimer) clearTimeout(thumbnailSizeSaveTimer);
        thumbnailSizeSaveTimer = setTimeout(() => {
            thumbnailSizeSaveTimer = null;
            if (disposed) return;
            saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save thumbnail size", error));
        }, 250);
    }

    function setupThumbnailSizeSliders() {
        const cardSlider = widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`);
        const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);
        const cardManagerSlider = widgetContainer.querySelector(`#${uniqueId}-card-manager-size-slider`);
        const cardManagerResetButton = widgetContainer.querySelector(`#${uniqueId}-card-manager-size-reset`);
        const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
        const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
        if (cardSlider) {
            cardSlider.value = String(getThumbnailSizePx());
            cardSlider.addEventListener('input', () => {
                if (cardSlider.disabled) return;
                applyThumbnailSizePreference(Number(cardSlider.value));
                queueThumbnailSizeSave();
            });
            cardSlider.addEventListener('change', () => {
                if (cardSlider.disabled) return;
                applyThumbnailSizePreference(Number(cardSlider.value));
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save thumbnail size", error));
            });
        }
        if (activeSlider) {
            syncResponsiveThumbnailBounds();
            activeSlider.addEventListener('input', () => {
                if (activeSlider.disabled) return;
                applyActiveThumbnailSizePreference(Number(activeSlider.value));
                queueThumbnailSizeSave();
            });
            activeSlider.addEventListener('change', () => {
                if (activeSlider.disabled) return;
                applyActiveThumbnailSizePreference(Number(activeSlider.value));
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active thumbnail size", error));
            });
        }
        if (cardManagerSlider) {
            cardManagerSlider.value = String(getCardManagerCardSizePx());
            cardManagerSlider.addEventListener('input', () => {
                applyCardManagerCardSizePreference(Number(cardManagerSlider.value));
                queueThumbnailSizeSave();
            });
            cardManagerSlider.addEventListener('change', () => {
                applyCardManagerCardSizePreference(Number(cardManagerSlider.value));
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save Card Manager card size", error));
            });
        }
        if (cardManagerResetButton) {
            cardManagerResetButton.addEventListener('click', () => {
                applyCardManagerCardSizePreference(CARD_MANAGER_CARD_SIZE_DEFAULT);
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to reset Card Manager card size", error));
            });
        }
        if (cardModeSelect) {
            cardModeSelect.value = getCardsDisplayMode();
            cardModeSelect.addEventListener('change', async () => {
                nodeInstance.uiPrefs.cards_display_mode = normalizeDisplayMode(cardModeSelect.value, "thumbnails");
                nodeInstance.uiPrefs.display_mode = nodeInstance.uiPrefs.cards_display_mode;
                syncThumbnailSizeSliders();
                if (activeLibraryTab()) await renderLibraryDrawer(activeLibraryTab());
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save cards display mode", error));
            });
        }
        if (activeModeSelect) {
            activeModeSelect.value = getActiveDisplayMode();
            activeModeSelect.addEventListener('change', async () => {
                nodeInstance.uiPrefs.active_display_mode = normalizeDisplayMode(activeModeSelect.value, "compact");
                syncThumbnailSizeSliders();
                applyActiveSidebarPreference();
                await renderActiveSidebar();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active display mode", error));
            });
        }
        const dimInput = widgetContainer.querySelector(`#${uniqueId}-dim-unselected`);
        if (dimInput) {
            dimInput.addEventListener('change', () => {
                nodeInstance.uiPrefs.card_contrast_mode = dimInput.checked ? "dim_inactive" : "off";
                applyCardContrastModePreference();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save card contrast mode", error));
            });
        }
        const wideInput = widgetContainer.querySelector(`#${uniqueId}-active-wide`);
        if (wideInput) {
            wideInput.addEventListener('change', async () => {
                nodeInstance.uiPrefs.active_card_size_mode = wideInput.checked ? "large" : "default";
                applyActiveSidebarPreference();
                await renderActiveSidebar();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active card size", error));
            });
        }
        widgetContainer.querySelector(`#${uniqueId}-active-hover-open`)?.addEventListener('change', event => {
            nodeInstance.uiPrefs.active_sidebar_hover_open = event.target.checked;
            saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active hover preference", error));
        });
        bindMainSortSelect();
        if (typeof ResizeObserver === "function") {
            responsiveSizingObserver = new ResizeObserver(scheduleResponsiveThumbnailBoundsSync);
            [
                widgetContainer,
                widgetContainer.querySelector(`#${uniqueId}-active-sidebar`),
            ].filter(Boolean).forEach(target => responsiveSizingObserver.observe(target));
        }
        syncThumbnailSizeSliders();
        scheduleResponsiveThumbnailBoundsSync();
        syncDisplayOptionAvailability();
    }

    function dispose() {
        disposed = true;
        if (thumbnailSizeSaveTimer) clearTimeout(thumbnailSizeSaveTimer);
        thumbnailSizeSaveTimer = null;
        if (responsiveSizingFrame != null) cancelAnimationFrame(responsiveSizingFrame);
        responsiveSizingFrame = null;
        responsiveSizingObserver?.disconnect();
        responsiveSizingObserver = null;
    }

    return {
        getThumbnailSizePx,
        getActiveThumbnailSizePx,
        getCardManagerCardSizePx,
        getActiveDisplayMode,
        getCardsDisplayMode,
        syncThumbnailSizeSliders,
        syncResponsiveThumbnailBounds,
        syncDisplayOptionAvailability,
        applyThumbnailSizePreference,
        applyActiveThumbnailSizePreference,
        applyCardManagerCardSizePreference,
        applyCardContrastModePreference,
        queueThumbnailSizeSave,
        setupThumbnailSizeSliders,
        dispose,
    };
}
