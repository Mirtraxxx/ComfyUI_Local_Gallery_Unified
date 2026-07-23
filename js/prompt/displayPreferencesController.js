import {
    getActiveDisplayMode as resolveActiveDisplayMode,
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getBarsSizeScale as resolveBarsSizeScale,
    getCardManagerCardSizePx as resolveCardManagerCardSizePx,
    getCardsDisplayMode as resolveCardsDisplayMode,
    getThumbnailSizePx as resolveThumbnailSizePx,
    normalizeDisplayMode,
} from "./preferences.js?v=card-manager-size-settings-20260722-1";
import {
    CARD_MANAGER_CARD_SIZE_DEFAULT,
    CARD_MANAGER_FULLSCREEN_CARD_SIZE_DEFAULT,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js?v=card-manager-size-settings-20260722-1";
import {
    getResponsiveThumbnailSizeBounds,
    getThumbnailVariables,
} from "./helpers.js?v=responsive-thumbnail-bounds-20260723-1";

/** Owns Prompt Builder, Card Manager, and Active Stack display preferences and controls. */
export function createDisplayPreferencesController({
    widgetContainer,
    uniqueId,
    nodeInstance,
    activeLibraryTab,
    renderLibraryDrawer,
    renderGallery,
    renderActiveSidebar,
    saveUiPrefs,
    bindMainSortSelect,
}) {
    let thumbnailSizeSaveTimer = null;
    let responsiveSizingFrame = null;
    let responsiveSizingObserver = null;
    let disposed = false;

    function getThumbnailSizePx() { return resolveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getActiveThumbnailSizePx() { return resolveActiveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getBarsSizeScale() { return resolveBarsSizeScale(nodeInstance.uiPrefs); }
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
        const sections = [
            {
                mode: getActiveDisplayMode(),
                slider: widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`),
                control: widgetContainer.querySelector(`#${uniqueId}-active-size-control`),
            },
            {
                mode: getCardsDisplayMode(),
                slider: widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`),
                control: widgetContainer.querySelector(`#${uniqueId}-cards-size-control`),
            },
        ];
        sections.forEach(({ mode, slider, control }) => {
            const enabled = mode === "thumbnails";
            if (slider) slider.disabled = !enabled;
            if (control) {
                control.classList.toggle("disabled", !enabled);
                control.title = enabled ? "Thumbnail size" : "Only available in Thumbnails mode";
            }
        });
    }

    function syncThumbnailSizeSliders() {
        const cardSlider = widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`);
        const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);
        const barsSlider = widgetContainer.querySelector(`#${uniqueId}-bars-size-slider`);
        const cardManagerSlider = widgetContainer.querySelector(`#${uniqueId}-card-manager-size-slider`);
        const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
        const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
        if (cardSlider) cardSlider.value = String(getThumbnailSizePx());
        syncResponsiveThumbnailBounds();
        if (barsSlider) barsSlider.value = String(getBarsSizeScale());
        if (cardManagerSlider) cardManagerSlider.value = String(getCardManagerCardSizePx());
        if (cardModeSelect) cardModeSelect.value = getCardsDisplayMode();
        if (activeModeSelect) activeModeSelect.value = getActiveDisplayMode();
        const contrastSelect = widgetContainer.querySelector(`#${uniqueId}-card-contrast-select`);
        if (contrastSelect) contrastSelect.value = nodeInstance.uiPrefs.card_contrast_mode || "off";
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

    function applyBarsSizeScalePreference(scale = getBarsSizeScale()) {
        nodeInstance.uiPrefs.bars_size_scale = scale;
        if (widgetContainer) {
            widgetContainer.style.setProperty('--localprompt-bar-scale', `${scale / 100}`);
        }
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

    function applyActiveBorderThemePreference() {
        const theme = nodeInstance.uiPrefs.active_border_theme || "default";
        const themeClasses = [
            "zip-theme-default", "zip-theme-cyberpunk", "zip-theme-sunset", "zip-theme-aurora",
            "zip-theme-ice", "zip-theme-fire-ice", "zip-theme-golden-mint", "zip-theme-rainbow-sync",
            "zip-theme-rainbow-split", "zip-theme-custom",
        ];
        themeClasses.forEach(cls => widgetContainer.classList.remove(cls));
        widgetContainer.classList.add(`zip-theme-${theme}`);
        if (theme === "custom") {
            widgetContainer.style.setProperty('--localprompt-zip-color-1', nodeInstance.uiPrefs.active_border_custom_1 || "#ff0000");
            widgetContainer.style.setProperty('--localprompt-zip-color-2', nodeInstance.uiPrefs.active_border_custom_2 || "#0000ff");
        } else {
            widgetContainer.style.removeProperty('--localprompt-zip-color-1');
            widgetContainer.style.removeProperty('--localprompt-zip-color-2');
        }
    }

    function applyCardContrastModePreference() {
        const mode = nodeInstance.uiPrefs.card_contrast_mode || "off";
        const contrastClasses = ["contrast-off", "contrast-dim-inactive", "contrast-dim-by-default"];
        contrastClasses.forEach(cls => widgetContainer.classList.remove(cls));
        widgetContainer.classList.add(`contrast-${mode.replace(/_/g, "-")}`);
        document.querySelectorAll(".localprompt-modal-overlay, .localprompt-workspace-panel").forEach(modal => {
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
        const barsSlider = widgetContainer.querySelector(`#${uniqueId}-bars-size-slider`);
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
        if (barsSlider) {
            barsSlider.value = String(getBarsSizeScale());
            barsSlider.addEventListener('input', () => {
                applyBarsSizeScalePreference(Number(barsSlider.value));
                queueThumbnailSizeSave();
            });
            barsSlider.addEventListener('change', () => {
                applyBarsSizeScalePreference(Number(barsSlider.value));
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save bars size scale", error));
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
                renderGallery();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save cards display mode", error));
            });
        }
        if (activeModeSelect) {
            activeModeSelect.value = getActiveDisplayMode();
            activeModeSelect.addEventListener('change', async () => {
                nodeInstance.uiPrefs.active_display_mode = normalizeDisplayMode(activeModeSelect.value, "compact");
                syncThumbnailSizeSliders();
                await renderActiveSidebar();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active display mode", error));
            });
        }
        const contrastSelect = widgetContainer.querySelector(`#${uniqueId}-card-contrast-select`);
        if (contrastSelect) {
            contrastSelect.value = nodeInstance.uiPrefs.card_contrast_mode || "off";
            contrastSelect.addEventListener('change', () => {
                nodeInstance.uiPrefs.card_contrast_mode = contrastSelect.value;
                applyCardContrastModePreference();
                saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save card contrast mode", error));
            });
        }
        bindMainSortSelect();
        if (typeof ResizeObserver === "function") {
            responsiveSizingObserver = new ResizeObserver(scheduleResponsiveThumbnailBoundsSync);
            [
                widgetContainer,
                widgetContainer.querySelector(`#${uniqueId}-active-sidebar`),
            ].filter(Boolean).forEach(target => responsiveSizingObserver.observe(target));
        }
        applyBarsSizeScalePreference();
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
        getBarsSizeScale,
        getCardManagerCardSizePx,
        getActiveDisplayMode,
        getCardsDisplayMode,
        syncThumbnailSizeSliders,
        syncResponsiveThumbnailBounds,
        syncDisplayOptionAvailability,
        applyThumbnailSizePreference,
        applyActiveThumbnailSizePreference,
        applyBarsSizeScalePreference,
        applyCardManagerCardSizePreference,
        applyActiveBorderThemePreference,
        applyCardContrastModePreference,
        queueThumbnailSizeSave,
        setupThumbnailSizeSliders,
        dispose,
    };
}
