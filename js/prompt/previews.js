import {
    buildPromptHoverPreviewHtml,
    getFloatingPreviewPosition,
} from "./helpers.js";

export function attachInfoPopup({
    element,
    prompt,
    uniqueId,
    showHoverPreview,
    hideHoverPreview,
}) {
    const infoBtn = element.querySelector(".localprompt-info-btn");
    if (!infoBtn) return;

    infoBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const hoverPreview = document.getElementById(`${uniqueId}-hover-preview`);
        const isShowing = hoverPreview && hoverPreview.classList.contains("active");

        if (isShowing) {
            hideHoverPreview();
        } else {
            showHoverPreview(prompt, event, element);

            const closePreview = (closeEvent) => {
                if (!hoverPreview.contains(closeEvent.target) && closeEvent.target !== infoBtn) {
                    hideHoverPreview();
                    document.removeEventListener("click", closePreview);
                }
            };
            setTimeout(() => document.addEventListener("click", closePreview), 10);
        }
    });
}

export function showHoverPreview({
    prompt,
    event,
    anchorElement = null,
    uniqueId,
    getCategoryRoleColor,
}) {
    const hoverPreview = document.getElementById(`${uniqueId}-hover-preview`);
    if (!hoverPreview) return;
    if (anchorElement && !anchorElement.isConnected) return;

    if (!prompt.preview_url || !prompt.preview_type) {
        return null;
    }

    const roleColor = getCategoryRoleColor(prompt);
    const previewHTML = buildPromptHoverPreviewHtml(prompt, roleColor);

    hoverPreview.innerHTML = previewHTML;
    hoverPreview.classList.add("active");

    const previewRect = hoverPreview.getBoundingClientRect();
    const anchorRect = anchorElement?.getBoundingClientRect?.();
    const { x, y } = getFloatingPreviewPosition({
        event,
        previewRect,
        anchorRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    });
    hoverPreview.style.left = `${x}px`;
    hoverPreview.style.top = `${y}px`;
}

export function hideHoverPreview({ uniqueId }) {
    const hoverPreview = document.getElementById(`${uniqueId}-hover-preview`);
    if (hoverPreview) {
        hoverPreview.classList.remove("active");
    }
}
