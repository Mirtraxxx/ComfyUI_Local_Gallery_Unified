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
    const weightMap = {};
    savedData.forEach(item => {
        weightMap[item.category] = Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1.0;
    });
    return weightMap;
}

function createWeightButton(className, label) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = label;
    button.style.cssText = "width: 20px; height: 20px; background: #3a3a3a; border: 1px solid #555; color: #ddd; border-radius: 3px; cursor: pointer;";
    return button;
}

function createCategoryRow(category, weightMap, onChange) {
    const isChecked = Object.prototype.hasOwnProperty.call(weightMap, category);
    const weight = isChecked ? weightMap[category] : 1.0;

    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 4px 0;";
    row.dataset.category = category;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isChecked;
    checkbox.style.cursor = "pointer";

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
    row.append(checkbox, label, weightControls);

    checkbox.addEventListener("change", () => {
        weightControls.style.display = checkbox.checked ? "flex" : "none";
        onChange();
    });

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
            selected.push({ category: row.dataset.category, weight });
        }
    });
    return selected;
}

export async function showWildcardsModal({
    getCategories,
    categoriesWidget,
    getCurrentWildcardMode,
    saveWildcardState,
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
        categoryList.appendChild(createCategoryRow(category, weightMap, updateCategoriesWidget));
    });
}
