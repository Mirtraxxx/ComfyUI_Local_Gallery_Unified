import {
    buildPromptPreviewMediaHtml,
    createPromptActionButton,
    promotePromptsById,
} from "./helpers.js?v=unified-icons-20260606";
import { escapeHtml } from "../shared/dom.js";

function getPromptCreatedAtValue(prompt) {
    const rawValue = prompt?.created_at || prompt?.date_added || prompt?.createdAt;
    if (typeof rawValue === "number") return rawValue;
    if (typeof rawValue === "string" && rawValue.trim()) {
        const numericValue = Number(rawValue);
        if (Number.isFinite(numericValue)) return numericValue;
        const parsedDate = Date.parse(rawValue);
        if (Number.isFinite(parsedDate)) return parsedDate;
    }
    return 0;
}

function sortPromptsForDisplay(prompts, sortMode = "manual") {
    const mode = String(sortMode || "manual");
    const sorted = [...prompts];
    if (mode === "az") {
        sorted.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }));
    } else if (mode === "za") {
        sorted.sort((a, b) => String(b?.name || "").localeCompare(String(a?.name || ""), undefined, { sensitivity: "base" }));
    } else if (mode === "newest") {
        sorted.sort((a, b) => (getPromptCreatedAtValue(b) - getPromptCreatedAtValue(a)) || String(b?.id || "").localeCompare(String(a?.id || "")));
    } else if (mode === "oldest") {
        sorted.sort((a, b) => (getPromptCreatedAtValue(a) - getPromptCreatedAtValue(b)) || String(a?.id || "").localeCompare(String(b?.id || "")));
    }
    return sorted;
}

export async function loadCategories({
    widgetContainer,
    uniqueId,
    galleryNode,
    isCurrent = () => true,
}) {
    const categories = await galleryNode.getCategories();
    if (!isCurrent()) return;
    const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
    if (!categorySelect) return;

    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '<option value="">All Categories</option>';

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });

    if (currentValue && categories.includes(currentValue)) {
        categorySelect.value = currentValue;
    }
}

export function promptMatchesCurrentGallery({
    prompt,
    widgetContainer,
    uniqueId,
    nodeInstance,
}) {
    const filterInput = widgetContainer.querySelector(`#${uniqueId}-filter-input`);
    const modeSelect = widgetContainer.querySelector(`#${uniqueId}-filter-mode`);
    const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

    if (nodeInstance.showFavoritesOnly && !prompt.favorite) {
        return false;
    }

    const selectedCategory = categorySelect ? categorySelect.value : "";
    if (selectedCategory && prompt.category !== selectedCategory) {
        return false;
    }

    const filterName = filterInput ? filterInput.value.trim().toLowerCase() : "";
    if (!filterName) {
        return true;
    }

    const haystack = `${prompt.name || ""} ${prompt.prompt_text || ""}`.toLowerCase();
    const terms = filterName.split(/\s+/).filter(Boolean);
    if (!terms.length) {
        return true;
    }

    const mode = modeSelect ? modeSelect.value : "OR";
    return mode === "AND"
        ? terms.every(term => haystack.includes(term))
        : terms.some(term => haystack.includes(term));
}

export function renderGallery({
    uniqueId,
    nodeInstance,
    galleryNode,
    syncPinnedOrderForFavorite,
    loadPromptsForGallery,
    attachInfoPopup,
    showPromptContextMenu,
    saveSelectionData,
    renderPrompts,
    preservePromptOrder = false,
    sortMode = "manual",
    manualOrderScope = "all",
    persistManualOrder = null,
    setSortMode = null,
}) {
    const gallery = document.getElementById(`${uniqueId}-gallery`);
    if (!gallery) return;

    gallery.__localpromptManualOrderCleanup?.();
    gallery.__localpromptManualOrderCleanup = null;
    gallery.innerHTML = "";

    const selectedPromptIds = nodeInstance.promptData.map(prompt => String(prompt.prompt_id));
    const selectedIds = new Set(selectedPromptIds);
    const isPromptSelected = prompt => selectedIds.has(String(prompt.id));

    let prompts = nodeInstance.availablePrompts;

    if (nodeInstance.showFavoritesOnly) {
        prompts = prompts.filter(prompt => prompt.favorite);
    }

    prompts = sortPromptsForDisplay(prompts, sortMode);

    if (!preservePromptOrder && nodeInstance.uiPrefs?.promote_selected_prompts !== false) {
        prompts = promotePromptsById(prompts, selectedPromptIds);
    }

    const canDragManualOrder = typeof persistManualOrder === "function";
    let suppressNextClick = false;

    prompts.forEach(prompt => {
        const promptId = String(prompt.id);
        const div = document.createElement("div");
        div.className = "localprompt-item";
        div.dataset.promptId = promptId;
        if (isPromptSelected(prompt)) {
            div.classList.add("selected");
        }

        const previewHtml = buildPromptPreviewMediaHtml(prompt, {
            wrapperClass: "localprompt-item-preview",
            noPreviewText: "No Preview",
        });

        const safeName = escapeHtml(prompt.name || "");
        const categoryText = prompt.category ? ` [${escapeHtml(prompt.category)}]` : "";
        const safePromptId = escapeHtml(prompt.id);
        const isFavorited = prompt.favorite || false;

        div.innerHTML = `
            ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
            ${previewHtml}
            ${createPromptActionButton({ icon: "star", className: `localprompt-favorite-star ${isFavorited ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `data-prompt-id="${safePromptId}"`, pressed: isFavorited })}
            <div class="localprompt-item-info">
                <div class="localprompt-item-name">${safeName}${categoryText}</div>
            </div>
        `;

        const video = div.querySelector("video");
        if (video) {
            div.addEventListener("mouseenter", () => video.play());
            div.addEventListener("mouseleave", () => {
                video.pause();
                video.currentTime = 0;
            });
        }

        const starBtn = div.querySelector(".localprompt-favorite-star");
        starBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            const result = await galleryNode.toggleFavorite(prompt.id);
            if (result.status === "ok") {
                await syncPinnedOrderForFavorite(prompt.id, result.favorite);
                await loadPromptsForGallery(galleryNode.currentPage);
            }
        });

        attachInfoPopup(div, prompt);

        div.addEventListener("click", () => {
            if (suppressNextClick) {
                suppressNextClick = false;
                return;
            }
            if (isPromptSelected(prompt)) {
                nodeInstance.promptData = nodeInstance.promptData.filter(item => String(item.prompt_id) !== String(prompt.id));
                div.classList.remove("selected");
            } else {
                nodeInstance.promptData.push({
                    prompt_id: prompt.id,
                    name: prompt.name,
                    on: true,
                    weight: 1.0,
                });
                div.classList.add("selected");
            }
            saveSelectionData();
            renderPrompts();
        });

        div.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            showPromptContextMenu(event, prompt);
        });

        gallery.appendChild(div);
    });

    if (canDragManualOrder) {
        let pointerDrag = null;

        const clearDropTargets = () => {
            gallery.querySelectorAll(".localprompt-item.pinned-drop-target").forEach(item => {
                item.classList.remove("pinned-drop-target");
            });
        };

        const getPromptCardAtPoint = (clientX, clientY) => {
            const element = document.elementFromPoint(clientX, clientY);
            const card = element?.closest?.(".localprompt-item[data-prompt-id]");
            return card && gallery.contains(card) ? card : null;
        };

        gallery.querySelectorAll(".localprompt-item[data-prompt-id]").forEach(card => {
            card.classList.add("manual-order-draggable");
            card.querySelectorAll("img, video").forEach(media => {
                media.draggable = false;
            });
            card.addEventListener("pointerdown", event => {
                if (event.button !== 0) return;
                if (event.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
                pointerDrag = {
                    card,
                    promptId: card.dataset.promptId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                };
            });
        });

        const onPointerMove = event => {
            if (!pointerDrag) return;
            const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
            if (!pointerDrag.active && distance < 8) return;

            if (!pointerDrag.active) {
                pointerDrag.active = true;
                suppressNextClick = true;
                pointerDrag.card.classList.add("pinned-dragging");
            }

            event.preventDefault();
            clearDropTargets();
            const targetCard = getPromptCardAtPoint(event.clientX, event.clientY);
            if (targetCard && targetCard !== pointerDrag.card) {
                targetCard.classList.add("pinned-drop-target");
            }
        };

        const onPointerUp = async event => {
            if (!pointerDrag) return;
            const dragState = pointerDrag;
            pointerDrag = null;

            dragState.card.classList.remove("pinned-dragging");
            const targetCard = getPromptCardAtPoint(event.clientX, event.clientY)
                || gallery.querySelector(".localprompt-item.pinned-drop-target");
            clearDropTargets();

            if (!dragState.active) return;
            event.preventDefault();
            suppressNextClick = true;

            if (!targetCard || targetCard === dragState.card) {
                setTimeout(() => {
                    suppressNextClick = false;
                }, 0);
                return;
            }

            const targetRect = targetCard.getBoundingClientRect();
            const placeAfter = event.clientY > targetRect.top + targetRect.height / 2;
            if (placeAfter) {
                targetCard.after(dragState.card);
            } else {
                targetCard.before(dragState.card);
            }

            const nextOrder = Array.from(gallery.querySelectorAll(".localprompt-item[data-prompt-id]"))
                .map(card => card.dataset.promptId)
                .filter(Boolean);
            if (sortMode !== "manual" && typeof setSortMode === "function") {
                await setSortMode("manual", { scope: { key: manualOrderScope }, reload: false });
            }
            await persistManualOrder(manualOrderScope, nextOrder);
            setTimeout(() => {
                suppressNextClick = false;
            }, 0);
        };

        const onPointerCancel = () => {
            if (pointerDrag) {
                pointerDrag.card.classList.remove("pinned-dragging");
                pointerDrag = null;
            }
            clearDropTargets();
            suppressNextClick = false;
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
        gallery.__localpromptManualOrderCleanup = () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
        };
    }
}
