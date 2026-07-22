import {
    buildPromptHoverPreviewHtml,
    getFloatingPreviewPosition,
} from "./helpers.js?v=preview-popover-20260606";
import { escapeHtml } from "../shared/dom.js";

let disposePreviewOutsideClick = null;

function getPromptPreviewMediaUrl(prompt) {
    return prompt?.preview_url || "";
}

function closeExpandedPreview() {
    const overlay = document.querySelector(".localprompt-preview-lightbox");
    overlay?._disposePromptPreview?.();
    overlay?.remove();
}

export function closePromptPreviews() {
    disposePreviewOutsideClick?.();
    disposePreviewOutsideClick = null;
    closeExpandedPreview();
}

function mountPreviewSurface(surface, surfaceHost = null) {
    const target = surfaceHost?.isConnected ? surfaceHost : document.body;
    target.appendChild(surface);
}

function showExpandedPreview(prompt, surfaceHost = null) {
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
    const onKeydown = (event) => {
        if (event.key === "Escape") closeExpandedPreview();
    };
    overlay._disposePromptPreview = () => {
        document.removeEventListener("keydown", onKeydown);
    };
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeExpandedPreview();
    });
    overlay.querySelector(".localprompt-preview-lightbox-close")?.addEventListener("click", closeExpandedPreview);
    document.addEventListener("keydown", onKeydown);
    overlay._localpromptSurfaceHost = surfaceHost || null;
    mountPreviewSurface(overlay, surfaceHost);
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
                showExpandedPreview(prompt, hoverPreview._localpromptSurfaceHost);
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
    getSurfaceHost = null,
}) {
    const infoBtn = element.querySelector(".localprompt-info-btn, .localprompt-active-preview-target");
    if (!infoBtn) return;

    const togglePreview = (event) => {
        event.stopPropagation();
        const hoverPreview = document.getElementById(`${uniqueId}-hover-preview`);
        const isShowing = hoverPreview && hoverPreview.classList.contains("active");

        if (isShowing) {
            hideHoverPreview();
            disposePreviewOutsideClick?.();
            disposePreviewOutsideClick = null;
        } else {
            disposePreviewOutsideClick?.();
            const surfaceHost = getSurfaceHost?.() || null;
            const hoverPreview = document.getElementById(`${uniqueId}-hover-preview`);
            if (hoverPreview) {
                hoverPreview._localpromptSurfaceHost = surfaceHost;
                mountPreviewSurface(hoverPreview, surfaceHost);
            }
            showHoverPreview(prompt, event, element);

            let timer = null;
            const closePreview = (closeEvent) => {
                if (!hoverPreview.contains(closeEvent.target) && closeEvent.target !== infoBtn) {
                    hideHoverPreview();
                    disposePreviewOutsideClick?.();
                }
            };
            disposePreviewOutsideClick = () => {
                if (timer !== null) clearTimeout(timer);
                timer = null;
                document.removeEventListener("click", closePreview);
                disposePreviewOutsideClick = null;
            };
            timer = setTimeout(() => {
                timer = null;
                document.addEventListener("click", closePreview);
            }, 10);
        }
    };

    infoBtn.addEventListener("click", togglePreview);
    infoBtn.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        togglePreview(event);
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
    if (roleColor) {
        hoverPreview.style.setProperty("--role-color", roleColor);
    } else {
        hoverPreview.style.removeProperty("--role-color");
    }
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
        hoverPreview.style.removeProperty("--role-color");
    }
}
