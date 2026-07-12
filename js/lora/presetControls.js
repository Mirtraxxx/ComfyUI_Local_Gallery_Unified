/**
 * Binds trigger-preset controls for either a browser card or an active-stack item.
 * The node owns selection persistence; this module owns only the preset interaction state.
 */
export function setupLoraPresetControls(
    element,
    lora,
    { nodeInstance, widgetContainer, uniqueId, updateSelection },
) {
    const presetSelect = element.querySelector('.lora-card-preset-select');
    if (!presetSelect) return;

    const presetStackCheckbox = element.querySelector('.lora-card-preset-stack-checkbox');
    const presetChecklist = element.querySelector('.lora-card-preset-checklist');
    const presetChecks = Array.from(element.querySelectorAll('.lora-card-preset-check'));
    const picker = element.querySelector('.lora-trigger-preset-picker');
    const pickerButton = element.querySelector('.lora-trigger-preset-button');
    const pickerLabel = element.querySelector('.lora-trigger-preset-label');
    const pickerCount = element.querySelector('.lora-trigger-preset-count');
    const pickerPopover = element.querySelector('.lora-trigger-preset-popover');
    const presetOptions = Array.from(element.querySelectorAll('.lora-trigger-preset-option'));
    const presetSearch = element.querySelector('.lora-trigger-preset-search');
    const loraName = element.dataset.loraName || lora.name;
    const getSelectionItem = () => nodeInstance.loraData.find(item => item.lora === loraName) || null;
    const getPresetNamesFromItem = (item) => item && Array.isArray(item.selected_presets)
        ? item.selected_presets.filter(Boolean)
        : (item && item.selected_preset ? [item.selected_preset] : []);
    const existingItem = getSelectionItem();
    const existingPresetNames = getPresetNamesFromItem(existingItem);
    const useStackedTriggerPresets = Boolean(existingItem?.stack_trigger_presets || existingPresetNames.length > 1);

    const getSelectedPresetNames = () => {
        if (presetStackCheckbox.checked) {
            return presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
        }
        return presetSelect.value ? [presetSelect.value] : [];
    };

    const syncPresetPickerUi = (selectedNamesOverride = null, stackingOverride = null) => {
        let selectedPresetNames = selectedNamesOverride;
        let stacking = stackingOverride;
        if (!selectedPresetNames || stacking === null) {
            const currentItem = getSelectionItem();
            if (currentItem) {
                selectedPresetNames = getPresetNamesFromItem(currentItem);
                stacking = Boolean(currentItem.stack_trigger_presets || selectedPresetNames.length > 1);
            } else {
                selectedPresetNames = getSelectedPresetNames();
                stacking = presetStackCheckbox.checked;
            }
        }
        presetStackCheckbox.checked = stacking;
        if (stacking) {
            presetChecks.forEach(checkbox => {
                checkbox.checked = selectedPresetNames.includes(checkbox.value);
            });
        } else {
            presetSelect.value = selectedPresetNames[0] || "";
            presetChecks.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        picker?.classList.toggle("stacking", stacking);
        presetChecklist.classList.toggle("visible", false);
        const selectedLabel = stacking
            ? (selectedPresetNames.length ? `${selectedPresetNames.length} presets` : "Stack presets")
            : (presetSelect.value || "Default Triggers");
        const hasSelectedPreset = selectedPresetNames.length > 0;
        if (pickerLabel) pickerLabel.textContent = selectedLabel;
        if (pickerCount) pickerCount.textContent = hasSelectedPreset
            ? (stacking ? selectedPresetNames.length : 1)
            : "";
        picker?.classList.toggle("has-selection", hasSelectedPreset);
        pickerButton?.classList.toggle("has-selection", hasSelectedPreset);
        pickerButton?.setAttribute("aria-pressed", String(hasSelectedPreset));
        if (pickerButton) {
            pickerButton.title = hasSelectedPreset
                ? `Trigger preset: ${selectedLabel}`
                : "Choose trigger preset";
            pickerButton.setAttribute("aria-label", hasSelectedPreset
                ? `Trigger preset: ${selectedLabel}`
                : "Choose trigger preset");
        }
        presetOptions.forEach(option => {
            const presetName = option.dataset.presetName || "";
            const isSelected = stacking
                ? selectedPresetNames.includes(presetName)
                : presetName === presetSelect.value;
            option.classList.toggle("selected", isSelected);
        });
    };

    presetStackCheckbox.checked = useStackedTriggerPresets;
    if (useStackedTriggerPresets) {
        presetChecks.forEach(checkbox => {
            checkbox.checked = existingPresetNames.includes(checkbox.value);
        });
    } else if (existingPresetNames.length > 0) {
        presetSelect.value = existingPresetNames[0];
    }
    syncPresetPickerUi();

    const applyPresetSelection = ({ selectedPresetsOverride = null, stackingOverride = null } = {}) => {
        const item = getSelectionItem();
        const stacking = stackingOverride ?? presetStackCheckbox.checked;
        const selectedPresets = selectedPresetsOverride ?? (stacking
            ? presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value)
            : (presetSelect.value ? [presetSelect.value] : []));
        if (item) {
            if (stacking) {
                item.stack_trigger_presets = true;
                item.selected_presets = selectedPresets;
                item.selected_preset = selectedPresets.length === 1 ? selectedPresets[0] : "";
            } else {
                item.selected_preset = selectedPresets[0] || "";
                delete item.selected_presets;
                delete item.stack_trigger_presets;
            }
            updateSelection();
        }
        syncPresetPickerUi(selectedPresets, stacking);
    };

    presetSelect.addEventListener('click', (event) => event.stopPropagation());
    presetSelect.addEventListener('mousedown', (event) => event.stopPropagation());
    presetSelect.addEventListener('change', () => applyPresetSelection());
    presetChecklist.addEventListener('click', (event) => event.stopPropagation());
    presetChecks.forEach(checkbox => {
        checkbox.addEventListener('change', () => applyPresetSelection());
    });
    presetStackCheckbox.addEventListener('click', (event) => event.stopPropagation());
    presetStackCheckbox.addEventListener('change', () => {
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
            pickerPopover.classList.remove("lora-trigger-preset-popover-portal", "lora-trigger-preset-popover-portal-active", "open");
            pickerPopover.style.left = "";
            pickerPopover.style.top = "";
            window.removeEventListener("resize", positionPortaledPopover);
            widgetContainer.querySelector(".locallora-active-sidebar-content")?.removeEventListener("scroll", positionPortaledPopover);
        }
        picker?.classList.remove("open");
        element.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
    };
    if (picker) picker._closeLoraPresetPopover = restorePortaledPopover;
    if (pickerPopover) pickerPopover._restoreLoraPresetPopover = restorePortaledPopover;

    pickerButton?.addEventListener("click", (event) => {
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
            pickerPopover.classList.add("lora-trigger-preset-popover-portal", "lora-trigger-preset-popover-portal-active", "open");
            document.body.appendChild(pickerPopover);
            positionPortaledPopover();
            window.addEventListener("resize", positionPortaledPopover);
            widgetContainer.querySelector(".locallora-active-sidebar-content")?.addEventListener("scroll", positionPortaledPopover);
        }
        presetSearch?.focus();
    });

    pickerPopover?.addEventListener("click", (event) => {
        const option = event.target.closest?.(".lora-trigger-preset-option");
        event.stopPropagation();
        if (!option || !pickerPopover.contains(option)) return;
        event.preventDefault();
        const presetName = option.dataset.presetName || "";
        let selectedPresets = [];
        const stacking = presetStackCheckbox.checked;
        if (stacking) {
            if (!presetName) {
                presetChecks.forEach(checkbox => checkbox.checked = false);
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
        presetOptions.forEach(option => {
            const optionText = option.textContent.toLowerCase();
            option.hidden = query && !optionText.includes(query);
        });
    });
}
