import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);
const preferencesUrl = new URL("../js/prompt/preferences.js", import.meta.url);
const backendUrl = new URL("../backend/Local_Prompt_Gallery.py", import.meta.url);
const templateUrl = new URL("../js/prompt/template.js", import.meta.url);
const controllerUrl = new URL("../js/prompt/displayPreferencesController.js", import.meta.url);
const workspaceActionsUrl = new URL("../js/prompt/workspaceActions.js", import.meta.url);

test("the existing display popover owns an independent, persisted Card Manager card-size control", async () => {
    const [browseSource, preferencesSource, backendSource, templateSource, controllerSource, workspaceActionsSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(preferencesUrl, "utf8"),
        readFile(backendUrl, "utf8"),
        readFile(templateUrl, "utf8"),
        readFile(controllerUrl, "utf8"),
        readFile(workspaceActionsUrl, "utf8"),
    ]);

    assert.match(templateSource, /id="\$\{uniqueId\}-size-controls"[\s\S]*?Card manager[\s\S]*?id="\$\{uniqueId\}-card-manager-size-slider"/);
    assert.match(templateSource, /id="\$\{uniqueId\}-card-manager-size-reset"/);
    assert.doesNotMatch(browseSource, /browse-display-toggle|browse-card-size-slider|browse-card-size-reset/);
    assert.match(browseSource, /grid\.style\.setProperty\("--localprompt-card-manager-card-width"/);
    assert.match(browseSource, /root\.dataset\.cardManagerOwner = String\(ownerId\)/);
    assert.match(browseSource, /grid\.dataset\.cardManagerOwner = String\(ownerId\)/);
    assert.match(workspaceActionsSource, /ownerId: uniqueId/);
    assert.match(controllerSource, /nodeInstance\.uiPrefs\.card_manager_card_size_px = normalizedSize/);
    assert.match(controllerSource, /data-card-manager-owner="\$\{CSS\.escape\(String\(uniqueId\)\)\}"/);
    assert.match(controllerSource, /document\.querySelectorAll\(ownerSelector\)/);
    assert.doesNotMatch(controllerSource, /querySelectorAll\("#browse-gallery-grid"\)/);
    assert.match(controllerSource, /saveUiPrefs\(\)\.catch\(error => console\.warn\("LocalPromptGallery: Failed to save Card Manager card size"/);
    assert.match(preferencesSource, /card_manager_card_size_px: CARD_MANAGER_CARD_SIZE_DEFAULT/);
    assert.match(preferencesSource, /export function getCardManagerCardSizePx/);
    assert.match(backendSource, /"card_manager_card_size_px": 150/);
    assert.match(backendSource, /"card_manager_card_size_px": lambda value, prefs: _normalize_int\([^,]+, UI_PREF_DEFAULTS\["card_manager_card_size_px"\], 100, 320\)/);
});

test("Card Manager card size normalizes independently of Prompt Builder thumbnail size", async () => {
    const source = await readFile(preferencesUrl, "utf8");
    const functionSource = source.match(/export function getCardManagerCardSizePx\([\s\S]*?\n\}/)?.[0];
    assert.ok(functionSource);

    const getCardManagerCardSizePx = new Function(
        "CARD_MANAGER_CARD_SIZE_DEFAULT",
        "CARD_MANAGER_CARD_SIZE_MIN",
        "CARD_MANAGER_CARD_SIZE_MAX",
        `${functionSource.replace("export ", "")}; return getCardManagerCardSizePx;`
    )(150, 100, 320);

    assert.equal(getCardManagerCardSizePx({}), 150);
    assert.equal(getCardManagerCardSizePx({ card_manager_card_size_px: 77, thumbnail_size_px: 320 }), 100);
    assert.equal(getCardManagerCardSizePx({ card_manager_card_size_px: 999, thumbnail_size_px: 40 }), 320);
    assert.equal(getCardManagerCardSizePx({ card_manager_card_size_px: "not a size" }), 150);
});
