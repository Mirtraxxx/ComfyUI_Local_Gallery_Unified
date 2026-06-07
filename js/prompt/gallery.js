import {
    buildPromptPreviewMediaHtml,
    createPromptActionButton,
    promotePromptsById,
} from "./helpers.js?v=unified-icons-20260606";

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
}) {
    const categories = await galleryNode.getCategories();
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
}) {
    const gallery = document.getElementById(`${uniqueId}-gallery`);
    if (!gallery) return;

    gallery.innerHTML = "";

    const selectedPromptIds = nodeInstance.promptData.map(prompt => String(prompt.prompt_id));
    const selectedIds = new Set(selectedPromptIds);
    const isPromptSelected = prompt => selectedIds.has(String(prompt.id));

    let prompts = nodeInstance.availablePrompts;

    if (nodeInstance.showFavoritesOnly) {
        prompts = prompts.filter(prompt => prompt.favorite);
    }

    prompts = sortPromptsForDisplay(prompts, sortMode);

    if (!preservePromptOrder) {
        prompts = promotePromptsById(prompts, selectedPromptIds);
    }

    prompts.forEach(prompt => {
        const div = document.createElement("div");
        div.className = "localprompt-item";
        if (isPromptSelected(prompt)) {
            div.classList.add("selected");
        }

        const previewHtml = buildPromptPreviewMediaHtml(prompt, {
            wrapperClass: "localprompt-item-preview",
            noPreviewText: "No Preview",
        });

        const categoryText = prompt.category ? ` [${prompt.category}]` : "";
        const isFavorited = prompt.favorite || false;

        div.innerHTML = `
            ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
            ${previewHtml}
            ${createPromptActionButton({ icon: "star", className: `localprompt-favorite-star ${isFavorited ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `data-prompt-id="${prompt.id}"`, pressed: isFavorited })}
            <div class="localprompt-item-info">
                <div class="localprompt-item-name">${prompt.name}${categoryText}</div>
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
}
