import { parseJsonOr, stringifyJsonOr } from "../shared/json.js";

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
            autoAttach: item.auto_attach !== false,
        };
    });
    return categoryMap;
}

function createWeightButton(className, label) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = label;
    button.style.cssText = "width: 20px; height: 20px; background: #3a3a3a; border: 1px solid #555; color: #ddd; border-radius: 3px; cursor: pointer;";
    return button;
}

function createExportButton(onExport) {
    const button = document.createElement("button");
    button.className = "wc-export-btn";
    button.type = "button";
    button.title = "Export category to wildcard .txt";
    button.textContent = "Export";
    button.style.cssText = "padding: 2px 6px; font-size: 10px; background: #2f4f2f; border: 1px solid #4a7c4a; color: #ddd; border-radius: 3px; cursor: pointer;";
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        onExport();
    });
    return button;
}

function createCategoryRow(category, categoryMap, onChange, onExport) {
    const savedCategory = categoryMap[category];
    const isChecked = Boolean(savedCategory);
    const weight = isChecked ? savedCategory.weight : 1.0;
    const autoAttach = isChecked ? savedCategory.autoAttach : true;

    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 4px 0;";
    row.dataset.category = category;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isChecked;
    checkbox.style.cursor = "pointer";

    const autoAttachLabel = document.createElement("label");
    autoAttachLabel.title = "Update this category's selected card with the generated image";
    autoAttachLabel.style.cssText = "display: inline-flex; align-items: center; gap: 3px; color: #aaa; font-size: 10px; white-space: nowrap; cursor: pointer;";
    const autoAttachCheckbox = document.createElement("input");
    autoAttachCheckbox.type = "checkbox";
    autoAttachCheckbox.className = "wc-auto-attach";
    autoAttachCheckbox.checked = autoAttach;
    autoAttachCheckbox.disabled = !isChecked;
    autoAttachCheckbox.style.cssText = "margin: 0; accent-color: #55a66b; cursor: pointer;";
    const autoAttachText = document.createElement("span");
    autoAttachText.textContent = "Update";
    autoAttachLabel.append(autoAttachCheckbox, autoAttachText);

    const label = document.createElement("span");
    label.textContent = category;
    label.style.cssText = "flex: 1; font-size: 11px; color: #ddd;";

    const weightControls = document.createElement("div");
    weightControls.className = "weight-controls";
    weightControls.style.cssText = `display: ${isChecked ? "flex" : "none"}; align-items: center; gap: 4px;`;

    const minus = createWeightButton("wc-minus", "-");
    const weightLabel = document.createElement("span");
    weightLabel.className = "wc-weight";
    weightLabel.textContent = weight.toFixed(1);
    weightLabel.style.cssText = "font-size: 10px; color: #aaa; min-width: 24px; text-align: center;";
    const plus = createWeightButton("wc-plus", "+");

    weightControls.append(minus, weightLabel, plus);
    row.append(checkbox, label, autoAttachLabel, weightControls);
    if (typeof onExport === "function") {
        row.appendChild(createExportButton(() => onExport(category)));
    }

    checkbox.addEventListener("change", () => {
        weightControls.style.display = checkbox.checked ? "flex" : "none";
        autoAttachCheckbox.disabled = !checkbox.checked;
        onChange();
    });

    autoAttachCheckbox.addEventListener("change", onChange);

    minus.addEventListener("click", () => {
        let nextWeight = parseFloat(weightLabel.textContent);
        nextWeight = Math.max(0.1, Math.round((nextWeight - 0.1) * 10) / 10);
        weightLabel.textContent = nextWeight.toFixed(1);
        onChange();
    });

    plus.addEventListener("click", () => {
        let nextWeight = parseFloat(weightLabel.textContent);
        nextWeight = Math.min(2.0, Math.round((nextWeight + 0.1) * 10) / 10);
        weightLabel.textContent = nextWeight.toFixed(1);
        onChange();
    });

    return row;
}

function collectSelectedCategories(categoryList) {
    const selected = [];
    categoryList.querySelectorAll("[data-category]").forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
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
    const overlay = document.createElement("div");
    overlay.className = "localprompt-modal-overlay";
    overlay.innerHTML = `
        <div class="localprompt-modal" style="width: 450px;">
            <div class="localprompt-modal-header">
                <h3>Select Categories</h3>
                <button class="localprompt-modal-close">x</button>
            </div>
            <div class="localprompt-modal-content">
                <div style="margin-bottom: 8px; color: #aaa; font-size: 11px;">Select wildcard categories and choose which selected categories update their cards with the generated image.</div>
                <div id="wc-categories-section">
                    <div id="wc-category-list" style="max-height: 300px; overflow-y: auto; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; padding: 8px;"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".localprompt-modal-close");
    const categoryList = overlay.querySelector("#wc-category-list");

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

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
