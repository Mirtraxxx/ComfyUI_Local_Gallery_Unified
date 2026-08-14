import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const presetControlsUrl = new URL("../js/lora/presetControls.js", import.meta.url);
const uiUrl = new URL("../js/lora/ui.js", import.meta.url);
const activeStackUrl = new URL("../js/lora/activeStackController.js", import.meta.url);
const backendUrl = new URL("../backend/Local_Lora_Gallery.py", import.meta.url);
const stylesUrl = new URL("../js/lora/styles.js", import.meta.url);
const entryUrl = new URL("../js/Local_Gallery_Unified.js", import.meta.url);

test("trigger preset apply persists selected_preset/selected_presets and rebuilds visual state", async () => {
    const [presetControls, ui, activeStack, styles, entry] = await Promise.all([
        readFile(presetControlsUrl, "utf8"),
        readFile(uiUrl, "utf8"),
        readFile(activeStackUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
        readFile(entryUrl, "utf8"),
    ]);

    assert.match(presetControls, /getSelectedTriggerPresetNames/);
    assert.match(presetControls, /item\.selected_presets = \[single\]/);
    assert.match(presetControls, /onPresetApplied\?\./);
    assert.match(presetControls, /Could not find selection item for trigger preset/);
    assert.match(presetControls, /lora-trigger-preset-popover-portal/);
    assert.match(presetControls, /pickerPopover\?\.querySelectorAll\("\.lora-trigger-preset-option"\)/);
    assert.match(presetControls, /option\.setAttribute\("aria-pressed", String\(isSelected\)\)/);
    assert.match(presetControls, /syncPresetPickerUi\(normalized, stacking\);[\s\S]*?try \{[\s\S]*?updateSelection\?\.\(\)/);
    assert.match(presetControls, /Failed to persist trigger preset selection/);
    assert.match(presetControls, /event\.stopPropagation\(\)/);

    assert.match(ui, /hitPortaledPresetMenu/);
    assert.match(ui, /lora-trigger-preset-popover-portal/);
    assert.match(ui, /from "\.\/activeStackController\.js"/);
    assert.match(ui, /from "\.\/styles\.js"/);
    assert.match(entry, /lora\/ui\.js\?[^\n"]*preset=lora-trigger-preset-feedback-20260726-2/);
    assert.match(ui, /widget\.serializeValue = \(\) => \{/);
    assert.match(ui, /toSerializableLoraSelection\(this\.loraData/);
    assert.match(ui, /app\.graph\?\.change\?\.\(\)/);
    assert.doesNotMatch(ui, /app\.graph\.setDirty\(/);

    assert.match(activeStack, /onPresetApplied:\s*\(\{\s*stacking\s*\}\)\s*=>/);
    assert.match(activeStack, /if \(!stacking\) \{\s*renderSelectedList\(\);/);
    assert.match(activeStack, /from "\.\/renderers\.js"/);

    assert.match(styles, /\.lora-trigger-preset-button\.has-selection/);
    assert.match(styles, /\.lora-trigger-preset-option\.selected::after/);
    assert.match(styles, /content: "✓"/);
    assert.doesNotMatch(styles, /content: "\\2713"/);
    assert.match(
        styles,
        /\.locallora-selected-preset \.lora-trigger-preset-button\.has-selection/,
    );
});

test("backend falls through empty selected_presets to selected_preset", async () => {
    const backend = await readFile(backendUrl, "utf8");
    assert.match(backend, /Empty list must fall through to selected_preset/);
    assert.match(
        backend,
        /if isinstance\(selected_presets, list\):[\s\S]*?if names:[\s\S]*?return names[\s\S]*?selected_preset = config\.get\('selected_preset'\)/,
    );
});
