import { parseJsonOr, stringifyJsonOr } from "../shared/json.js";
import { bindBackdropClose, createModalSurface } from "../shared/modalSurfaces.js";

function readWildcardCategoryData(value) {
    let savedData = parseJsonOr(value || "[]", []);
    if (!Array.isArray(savedData)) {
        return [];
    }
    if (savedData.length > 0 && typeof savedData[0] === "string") {
        savedData = savedData.map(category => ({ category, weight: 1.0 }));
    }
    return savedData.filter(item => item && typeof item.category === "string");
}

function buildWeightMap(savedData) {
    const categoryMap = {};
    savedData.forEach(item => {
        categoryMap[item.category] = {
            weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1.0,
            autoAttach: item.auto_attach === true,
        };
    });
    return categoryMap;
}

function createCategoryRow(category, categoryMap, onChange, onExport) {
    const savedCategory = categoryMap[category];
    const isChecked = Boolean(savedCategory);
    const weight = isChecked ? savedCategory.weight : 1.0;
    const autoAttach = isChecked ? savedCategory.autoAttach : false;

    const row = document.createElement("div");
    row.className = "localprompt-wc-row";
    row.dataset.category = category;
    row.innerHTML = `
        <label class="lg-check localprompt-wc-name"><input type="checkbox" class="wc-enabled"><span></span></label>
        <label class="lg-check localprompt-wc-update" title="Update this category's selected card with the generated image"><input type="checkbox" class="wc-auto-attach"><span>Update</span></label>
        <div class="localprompt-wc-weight">
            <button class="lg-icon-btn wc-minus" type="button" aria-label="Lower weight">&minus;</button>
            <span class="wc-weight"></span>
            <button class="lg-icon-btn wc-plus" type="button" aria-label="Raise weight">+</button>
        </div>
        ${typeof onExport === "function" ? '<button class="lg-text-btn wc-export-btn" type="button" title="Export category to wildcard .txt">Export</button>' : ""}
    `;
    row.querySelector(".localprompt-wc-name span").textContent = category;

    const checkbox = row.querySelector(".wc-enabled");
    const autoAttachCheckbox = row.querySelector(".wc-auto-attach");
    const weightControls = row.querySelector(".localprompt-wc-weight");
    const weightLabel = row.querySelector(".wc-weight");
    checkbox.checked = isChecked;
    autoAttachCheckbox.checked = autoAttach;
    autoAttachCheckbox.disabled = !isChecked;
    weightControls.hidden = !isChecked;
    weightLabel.textContent = weight.toFixed(1);

    checkbox.addEventListener("change", () => {
        weightControls.hidden = !checkbox.checked;
        autoAttachCheckbox.disabled = !checkbox.checked;
        onChange();
    });
    autoAttachCheckbox.addEventListener("change", onChange);

    const stepWeight = (delta) => {
        const nextWeight = Math.min(2.0, Math.max(0.1, Math.round((parseFloat(weightLabel.textContent) + delta) * 10) / 10));
        weightLabel.textContent = nextWeight.toFixed(1);
        onChange();
    };
    row.querySelector(".wc-minus").addEventListener("click", () => stepWeight(-0.1));
    row.querySelector(".wc-plus").addEventListener("click", () => stepWeight(0.1));
    row.querySelector(".wc-export-btn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        onExport(category);
    });

    return row;
}

function collectSelectedCategories(categoryList) {
    const selected = [];
    categoryList.querySelectorAll("[data-category]").forEach(row => {
        const checkbox = row.querySelector(".wc-enabled");
        if (checkbox?.checked) {
            const weight = parseFloat(row.querySelector(".wc-weight")?.textContent) || 1.0;
            selected.push({
                category: row.dataset.category,
                weight,
                auto_attach: row.querySelector(".wc-auto-attach")?.checked !== false,
            });
        }
    });
    return selected;
}

export async function showWildcardsModal({
    getCategories,
    categoriesWidget,
    getCurrentWildcardMode,
    saveWildcardState,
    onExportCategory = null,
}) {
    const { root: overlay, close } = createModalSurface({ overlayClassName: "lg-root localprompt-modal-overlay" });
    overlay.innerHTML = `
        <div class="localprompt-modal localprompt-wc-modal">
            <div class="localprompt-modal-header">
                <h3>Wildcard categories</h3>
                <button class="localprompt-modal-close" type="button" aria-label="Close">&times;</button>
            </div>
            <div class="localprompt-modal-content lg-form">
                <p class="lg-note">Checked categories each contribute one card per run. "Update" also saves the generated image as that card's thumbnail.</p>
                <div id="wc-category-list" class="localprompt-wc-list"></div>
            </div>
        </div>
    `;
    const categoryList = overlay.querySelector("#wc-category-list");

    overlay.querySelector(".localprompt-modal-close").addEventListener("click", close);
    bindBackdropClose(overlay, close);

    const categories = await getCategories();
    const savedData = readWildcardCategoryData(categoriesWidget?.value);
    const weightMap = buildWeightMap(savedData);

    const updateCategoriesWidget = () => {
        const selected = collectSelectedCategories(categoryList);
        saveWildcardState(getCurrentWildcardMode(), stringifyJsonOr(selected));
    };

    categoryList.innerHTML = "";
    categories.forEach(category => {
        categoryList.appendChild(createCategoryRow(category, weightMap, updateCategoriesWidget, onExportCategory));
    });
}
