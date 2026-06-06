import {
    buildPromptHoverPreviewHtml,
    getFloatingPreviewPosition,
} from "./helpers.js?v=preview-popover-20260606";
import { escapeHtml } from "../shared/dom.js";

function getPromptPreviewMediaUrl(prompt) {
    return prompt?.preview_url || "";
}

function closeExpandedPreview() {
    document.querySelector(".localprompt-preview-lightbox")?.remove();
}

function showExpandedPreview(prompt) {
    const mediaUrl = getPromptPreviewMediaUrl(prompt);
    if (!mediaUrl) return;

    closeExpandedPreview();
    const overlay = document.createElement("div");
    overlay.className = "localprompt-preview-lightbox";
    const isVideo = prompt.preview_type === "video";
    const safeMediaUrl = escapeHtml(mediaUrl);
    const safeName = escapeHtml(prompt?.name || "");
    overlay.innerHTML = `
        <button class="localprompt-preview-lightbox-close" type="button" title="Close" aria-label="Close">x</button>
        <div class="localprompt-preview-lightbox-media">
            ${isVideo
                ? `<video src="${safeMediaUrl}" controls autoplay loop muted></video>`
                : `<img src="${safeMediaUrl}" alt="${safeName}">`
            }
        </div>
    `;
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeExpandedPreview();
    });
    overlay.querySelector(".localprompt-preview-lightbox-close")?.addEventListener("click", closeExpandedPreview);
    document.addEventListener("keydown", function onKeydown(event) {
        if (event.key === "Escape") {
            closeExpandedPreview();
            document.removeEventListener("keydown", onKeydown);
        }
    });
    document.body.appendChild(overlay);
}

async function copyPromptText(prompt, button) {
    const promptText = String(prompt?.prompt_text || "");
    if (!promptText) return;
    try {
        await navigator.clipboard.writeText(promptText);
        const originalText = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => {
            if (button.isConnected) button.textContent = originalText;
        }, 900);
    } catch (error) {
        console.warn("LocalPromptGallery: Failed to copy prompt text", error);
    }
}

function bindPreviewActions(hoverPreview, prompt) {
    hoverPreview.querySelectorAll("[data-preview-action]").forEach(button => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const action = button.getAttribute("data-preview-action");
            if (action === "toggle-prompt") {
                const textEl = hoverPreview.querySelector(".preview-text");
                if (!textEl) return;
                const willShow = textEl.hidden;
                textEl.hidden = !willShow;
                button.textContent = willShow ? "Hide Prompt" : "Show Prompt";
            } else if (action === "copy-prompt") {
                copyPromptText(prompt, button);
            } else if (action === "expand-image") {
                showExpandedPreview(prompt);
            }
        });
    });
}

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

    const roleColor = getCategoryRoleColor(prompt);
    const previewHTML = buildPromptHoverPreviewHtml(prompt, roleColor);

    hoverPreview.innerHTML = previewHTML;
    hoverPreview.classList.add("active");
    bindPreviewActions(hoverPreview, prompt);

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
