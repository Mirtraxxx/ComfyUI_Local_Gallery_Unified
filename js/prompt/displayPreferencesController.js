import {
    getActiveDisplayMode as resolveActiveDisplayMode,
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getCardsDisplayMode as resolveCardsDisplayMode,
    getThumbnailSizePx as resolveThumbnailSizePx,
    normalizeDisplayMode,
} from "./preferences.js?v=prefs-schema-20260611";
import { getThumbnailVariables } from "./helpers.js?v=unified-icons-20260606";

/** Owns Prompt Builder/Card/Active Stack display preferences and controls. */
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
    let disposed = false;

    function getThumbnailSizePx() { return resolveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getActiveThumbnailSizePx() { return resolveActiveThumbnailSizePx(nodeInstance.uiPrefs); }
    function getActiveDisplayMode() { return resolveActiveDisplayMode(nodeInstance.uiPrefs); }
    function getCardsDisplayMode() { return resolveCardsDisplayMode(nodeInstance.uiPrefs); }

    function applyThumbnailVariables(target, sizePx) {
        const variables = getThumbnailVariables(sizePx);
        target.style.setProperty('--localprompt-thumb-height', `${variables.height}px`);
        target.style.setProperty('--localprompt-thumb-width', `${variables.width}px`);
        target.style.setProperty('--localprompt-thumb-label-size', `${variables.label}px`);
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
        const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
        const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
        if (cardSlider) cardSlider.value = String(getThumbnailSizePx());
        if (activeSlider) activeSlider.value = String(getActiveThumbnailSizePx());
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
        const activeSidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
        if (activeSidebar) applyThumbnailVariables(activeSidebar, sizePx);
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
        const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
        const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
        if (cardSlider) {
            cardSlider.value = String(getThumbnailSizePx());
            cardSlider.addEventListener('input', () => {
                if (cardSlider.disabled) return;
                applyThumbnailSizePreference(Number(cardSlider.value));
                queueThumbnailSizeSave();
            });
        }
        if (activeSlider) {
            activeSlider.value = String(getActiveThumbnailSizePx());
            activeSlider.addEventListener('input', () => {
                if (activeSlider.disabled) return;
                applyActiveThumbnailSizePreference(Number(activeSlider.value));
                queueThumbnailSizeSave();
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
        syncDisplayOptionAvailability();
    }

    function dispose() {
        disposed = true;
        if (thumbnailSizeSaveTimer) clearTimeout(thumbnailSizeSaveTimer);
        thumbnailSizeSaveTimer = null;
    }

    return {
        getThumbnailSizePx,
        getActiveThumbnailSizePx,
        getActiveDisplayMode,
        getCardsDisplayMode,
        syncThumbnailSizeSliders,
        syncDisplayOptionAvailability,
        applyThumbnailSizePreference,
        applyActiveThumbnailSizePreference,
        applyActiveBorderThemePreference,
        applyCardContrastModePreference,
        queueThumbnailSizeSave,
        setupThumbnailSizeSliders,
        dispose,
    };
}

