import { buildPromptPreviewMediaHtml } from "./helpers.js";

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
}) {
    const gallery = document.getElementById(`${uniqueId}-gallery`);
    if (!gallery) return;

    gallery.innerHTML = "";

    const selectedIds = new Set(nodeInstance.promptData.map(prompt => prompt.prompt_id));

    let prompts = nodeInstance.availablePrompts;

    if (nodeInstance.showFavoritesOnly) {
        prompts = prompts.filter(prompt => prompt.favorite);
    }

    prompts.sort((a, b) => {
        const aSelected = selectedIds.has(a.id);
        const bSelected = selectedIds.has(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
    });

    prompts.forEach(prompt => {
        const div = document.createElement("div");
        div.className = "localprompt-item";
        if (selectedIds.has(prompt.id)) {
            div.classList.add("selected");
        }

        const previewHtml = buildPromptPreviewMediaHtml(prompt, {
            wrapperClass: "localprompt-item-preview",
            noPreviewText: "No Preview",
        });

        const categoryText = prompt.category ? ` [${prompt.category}]` : "";
        const isFavorited = prompt.favorite || false;

        div.innerHTML = `
            <button class="localprompt-info-btn" title="View Info">!</button>
            ${previewHtml}
            <button class="localprompt-favorite-star ${isFavorited ? "favorited" : ""}" data-prompt-id="${prompt.id}">*</button>
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
            if (selectedIds.has(prompt.id)) {
                nodeInstance.promptData = nodeInstance.promptData.filter(item => item.prompt_id !== prompt.id);
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
