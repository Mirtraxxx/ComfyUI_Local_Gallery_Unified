/**
 * Binds trigger-preset controls for either a browser card or an active-stack item.
 * The node owns selection persistence; this module owns only the preset interaction state.
 */
import { getSelectedTriggerPresetNames } from "./selectionState.js?v=lora-trigger-preset-fix-20260724-1";

export function setupLoraPresetControls(
    element,
    lora,
    { nodeInstance, widgetContainer, uniqueId, updateSelection, onPresetApplied = null },
) {
    const presetSelect = element.querySelector(".lora-card-preset-select");
    if (!presetSelect) return;

    const presetStackCheckbox = element.querySelector(".lora-card-preset-stack-checkbox");
    const presetChecklist = element.querySelector(".lora-card-preset-checklist");
    const presetChecks = Array.from(element.querySelectorAll(".lora-card-preset-check"));
    const picker = element.querySelector(".lora-trigger-preset-picker");
    const pickerButton = element.querySelector(".lora-trigger-preset-button");
    const pickerLabel = element.querySelector(".lora-trigger-preset-label");
    const pickerCount = element.querySelector(".lora-trigger-preset-count");
    const pickerPopover = element.querySelector(".lora-trigger-preset-popover");
    const presetSearch = element.querySelector(".lora-trigger-preset-search");
    const loraName = element.dataset.loraName || lora.name;

    const getSelectionItem = () => {
        const byName = nodeInstance.loraData.find(item => item.lora === loraName);
        if (byName) return byName;
        const index = Number.parseInt(element.dataset.index, 10);
        if (Number.isInteger(index) && index >= 0 && nodeInstance.loraData[index]) {
            return nodeInstance.loraData[index];
        }
        return null;
    };

    const getOptionButtons = () => Array.from(
        picker?.querySelectorAll(".lora-trigger-preset-option")
        || element.querySelectorAll(".lora-trigger-preset-option"),
    );

    const existingItem = getSelectionItem();
    const existingPresetNames = getSelectedTriggerPresetNames(existingItem);
    const useStackedTriggerPresets = Boolean(existingItem?.stack_trigger_presets || existingPresetNames.length > 1);

    const getSelectedPresetNamesFromDom = () => {
        if (presetStackCheckbox?.checked) {
            return presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value).filter(Boolean);
        }
        return presetSelect.value ? [presetSelect.value] : [];
    };

    const syncPresetPickerUi = (selectedNamesOverride = null, stackingOverride = null) => {
        let selectedPresetNames = selectedNamesOverride;
        let stacking = stackingOverride;
        if (selectedPresetNames == null || stacking === null || stacking === undefined) {
            const currentItem = getSelectionItem();
            if (currentItem) {
                if (selectedPresetNames == null) {
                    selectedPresetNames = getSelectedTriggerPresetNames(currentItem);
                }
                if (stacking === null || stacking === undefined) {
                    stacking = Boolean(currentItem.stack_trigger_presets || selectedPresetNames.length > 1);
                }
            } else {
                if (selectedPresetNames == null) {
                    selectedPresetNames = getSelectedPresetNamesFromDom();
                }
                if (stacking === null || stacking === undefined) {
                    stacking = Boolean(presetStackCheckbox?.checked);
                }
            }
        }

        selectedPresetNames = Array.isArray(selectedPresetNames)
            ? selectedPresetNames.filter(Boolean)
            : [];
        stacking = Boolean(stacking);

        if (presetStackCheckbox) presetStackCheckbox.checked = stacking;
        if (stacking) {
            presetChecks.forEach(checkbox => {
                checkbox.checked = selectedPresetNames.includes(checkbox.value);
            });
        } else {
            const single = selectedPresetNames[0] || "";
            // Setting select.value only sticks when an option matches.
            presetSelect.value = single;
            if (presetSelect.value !== single && single) {
                // Ensure the option exists so value + visual state stay aligned.
                let option = Array.from(presetSelect.options).find(entry => entry.value === single);
                if (!option) {
                    option = document.createElement("option");
                    option.value = single;
                    option.textContent = single;
                    presetSelect.appendChild(option);
                }
                presetSelect.value = single;
            }
            presetChecks.forEach(checkbox => {
                checkbox.checked = false;
            });
        }

        picker?.classList.toggle("stacking", stacking);
        presetChecklist?.classList.toggle("visible", false);

        const selectedLabel = stacking
            ? (selectedPresetNames.length ? `${selectedPresetNames.length} presets` : "Stack presets")
            : (selectedPresetNames[0] || "Default Triggers");
        const hasSelectedPreset = selectedPresetNames.length > 0;

        if (pickerLabel) pickerLabel.textContent = selectedLabel;
        if (pickerCount) {
            pickerCount.textContent = hasSelectedPreset
                ? String(stacking ? selectedPresetNames.length : 1)
                : "";
        }
        picker?.classList.toggle("has-selection", hasSelectedPreset);
        pickerButton?.classList.toggle("has-selection", hasSelectedPreset);
        pickerButton?.setAttribute("aria-pressed", String(hasSelectedPreset));
        if (pickerButton) {
            const title = hasSelectedPreset
                ? `Trigger preset: ${selectedLabel}`
                : "Choose trigger preset";
            pickerButton.title = title;
            pickerButton.setAttribute("aria-label", title);
        }

        getOptionButtons().forEach(option => {
            const presetName = option.dataset.presetName || "";
            const isSelected = stacking
                ? Boolean(presetName) && selectedPresetNames.includes(presetName)
                : presetName === (selectedPresetNames[0] || "");
            option.classList.toggle("selected", isSelected);
        });
    };

    if (presetStackCheckbox) presetStackCheckbox.checked = useStackedTriggerPresets;
    if (useStackedTriggerPresets) {
        presetChecks.forEach(checkbox => {
            checkbox.checked = existingPresetNames.includes(checkbox.value);
        });
    } else if (existingPresetNames.length > 0) {
        presetSelect.value = existingPresetNames[0];
    }
    syncPresetPickerUi(existingPresetNames, useStackedTriggerPresets);

    const applyPresetSelection = ({ selectedPresetsOverride = null, stackingOverride = null } = {}) => {
        const item = getSelectionItem();
        const stacking = stackingOverride ?? Boolean(presetStackCheckbox?.checked);
        const selectedPresets = selectedPresetsOverride ?? getSelectedPresetNamesFromDom();
        const normalized = Array.isArray(selectedPresets) ? selectedPresets.filter(Boolean) : [];

        if (item) {
            if (stacking) {
                item.stack_trigger_presets = true;
                item.selected_presets = normalized;
                item.selected_preset = normalized.length === 1 ? normalized[0] : "";
            } else {
                const single = normalized[0] || "";
                item.selected_preset = single;
                if (single) {
                    // Keep both fields in sync so backend/readers never miss the choice.
                    item.selected_presets = [single];
                } else {
                    delete item.selected_presets;
                }
                delete item.stack_trigger_presets;
            }
            updateSelection?.();
            onPresetApplied?.({ item, selectedPresets: normalized, stacking });
        } else {
            console.warn("LocalLoraGallery: Could not find selection item for trigger preset", loraName);
        }
        syncPresetPickerUi(normalized, stacking);
    };

    presetSelect.addEventListener("click", (event) => event.stopPropagation());
    presetSelect.addEventListener("mousedown", (event) => event.stopPropagation());
    presetSelect.addEventListener("change", () => applyPresetSelection());
    presetChecklist?.addEventListener("click", (event) => event.stopPropagation());
    presetChecks.forEach(checkbox => {
        checkbox.addEventListener("change", () => applyPresetSelection());
    });
    presetStackCheckbox?.addEventListener("click", (event) => event.stopPropagation());
    presetStackCheckbox?.addEventListener("change", () => {
        if (presetStackCheckbox.checked && presetSelect.value) {
            presetChecks.forEach(checkbox => {
                checkbox.checked = checkbox.value === presetSelect.value;
            });
        }
        if (!presetStackCheckbox.checked) {
            const firstSelected = presetChecks.find(checkbox => checkbox.checked);
            presetSelect.value = firstSelected ? firstSelected.value : "";
        }
        applyPresetSelection();
    });

    const isActiveStackPicker = Boolean(element.closest(".locallora-lora-item"));
    const positionPortaledPopover = () => {
        if (!pickerPopover?.classList.contains("lora-trigger-preset-popover-portal")) return;
        const buttonRect = pickerButton.getBoundingClientRect();
        const popoverRect = pickerPopover.getBoundingClientRect();
        const margin = 8;
        const maxLeft = Math.max(margin, window.innerWidth - popoverRect.width - margin);
        const left = Math.max(margin, Math.min(buttonRect.right - popoverRect.width, maxLeft));
        const spaceBelow = window.innerHeight - buttonRect.bottom - margin;
        const top = spaceBelow >= popoverRect.height + 6
            ? buttonRect.bottom + 6
            : Math.max(margin, buttonRect.top - popoverRect.height - 6);
        pickerPopover.style.left = `${Math.round(left)}px`;
        pickerPopover.style.top = `${Math.round(top)}px`;
    };
    const restorePortaledPopover = () => {
        if (pickerPopover?.classList.contains("lora-trigger-preset-popover-portal")) {
            picker?.appendChild(pickerPopover);
            pickerPopover.classList.remove(
                "lora-trigger-preset-popover-portal",
                "lora-trigger-preset-popover-portal-active",
                "open",
            );
            pickerPopover.style.left = "";
            pickerPopover.style.top = "";
            window.removeEventListener("resize", positionPortaledPopover);
            widgetContainer.querySelector(".locallora-active-sidebar-content")
                ?.removeEventListener("scroll", positionPortaledPopover);
        }
        picker?.classList.remove("open");
        element.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
    };
    if (picker) picker._closeLoraPresetPopover = restorePortaledPopover;
    if (pickerPopover) pickerPopover._restoreLoraPresetPopover = restorePortaledPopover;

    pickerButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = !picker?.classList.contains("open");
        widgetContainer.querySelectorAll(".lora-trigger-preset-picker.open").forEach(openPicker => {
            openPicker._closeLoraPresetPopover?.();
            openPicker.classList.remove("open");
            openPicker.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
        });
        if (!shouldOpen) {
            restorePortaledPopover();
            return;
        }
        picker?.classList.add("open");
        element.closest(".locallora-lora-card, .locallora-lora-item")?.classList.add("preset-open");
        if (isActiveStackPicker && pickerPopover) {
            pickerPopover.dataset.loraPortalOwner = uniqueId;
            pickerPopover.classList.add(
                "lora-trigger-preset-popover-portal",
                "lora-trigger-preset-popover-portal-active",
                "open",
            );
            document.body.appendChild(pickerPopover);
            positionPortaledPopover();
            window.addEventListener("resize", positionPortaledPopover);
            widgetContainer.querySelector(".locallora-active-sidebar-content")
                ?.addEventListener("scroll", positionPortaledPopover);
        }
        presetSearch?.focus();
    });

    pickerPopover?.addEventListener("mousedown", (event) => {
        // Keep document-level outside handlers from treating the portaled menu as
        // a "click outside" before the option click is handled.
        event.stopPropagation();
    });
    pickerPopover?.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
    });
    pickerPopover?.addEventListener("click", (event) => {
        // Always stop bubbling so document "outside" handlers do not close the
        // active stack when the menu is portaled onto document.body.
        event.stopPropagation();
        const option = event.target.closest?.(".lora-trigger-preset-option");
        if (!option || !pickerPopover.contains(option)) return;
        event.preventDefault();

        const presetName = option.dataset.presetName || "";
        let selectedPresets = [];
        const stacking = Boolean(presetStackCheckbox?.checked);
        if (stacking) {
            if (!presetName) {
                presetChecks.forEach(checkbox => { checkbox.checked = false; });
            } else {
                const matchingCheck = presetChecks.find(checkbox => checkbox.value === presetName);
                if (matchingCheck) matchingCheck.checked = !matchingCheck.checked;
            }
            selectedPresets = presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
        } else {
            presetSelect.value = presetName;
            selectedPresets = presetName ? [presetName] : [];
            restorePortaledPopover();
        }
        applyPresetSelection({ selectedPresetsOverride: selectedPresets, stackingOverride: stacking });
    });

    presetSearch?.addEventListener("input", () => {
        const query = presetSearch.value.trim().toLowerCase();
        getOptionButtons().forEach(option => {
            const optionText = option.textContent.toLowerCase();
            option.hidden = Boolean(query) && !optionText.includes(query);
        });
    });
    presetSearch?.addEventListener("click", (event) => event.stopPropagation());
}
