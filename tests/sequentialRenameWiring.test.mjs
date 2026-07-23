import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const backendUrl = new URL("../backend/Local_Prompt_Gallery.py", import.meta.url);
const promptApiUrl = new URL("../js/api/promptApi.js", import.meta.url);
const promptUiUrl = new URL("../js/prompt/ui.js", import.meta.url);
const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);

test("Card Insights management exposes an explicit sequential rename action", async () => {
    const [backend, api, ui, browse] = await Promise.all([
        readFile(backendUrl, "utf8"),
        readFile(promptApiUrl, "utf8"),
        readFile(promptUiUrl, "utf8"),
        readFile(browseUrl, "utf8"),
    ]);

    assert.match(browse, /id="browse-rename-sequential"/);
    assert.match(browse, /Rename Sequentially/);
    assert.match(browse, /valid wildcard import order are numbered first/);
    assert.doesNotMatch(browse, /renameSequentialBtn\.disabled = selectedCount === 0 \|\| !!bulkQuerySelection/);
    assert.match(browse, /This affects all current results, including cards not loaded on this page/);
    assert.match(browse, /const selection = getBulkSelectionDescriptor\(\)/);
    assert.match(browse, /galleryNode\.renamePromptsSequential\(selection, \{/);
    assert.match(browse, /baseRevision: preview\.revision/);
    assert.match(browse, /result\.active_prompts/);
    assert.match(api, /renamePromptsSequential\(selection, \{/);
    assert.match(api, /selection\?\.type === "ids"/);
    assert.match(api, /\{ selection \}/);
    assert.match(api, /\/localgalleryunified\/prompt\/rename_prompts_sequential/);
    assert.match(ui, /promptApi\.renamePromptsSequential\(selection, options\)/);
    assert.match(backend, /@server\.PromptServer\.instance\.routes\.post\("\/localgalleryunified\/prompt\/rename_prompts_sequential"\)/);
    assert.match(backend, /resolve_sequential_rename_ids\(metadata, data\)/);
    assert.match(backend, /_resolve_bulk_selection\(metadata, selection\)/);
    assert.match(backend, /base_revision is required when applying a sequential rename/);
    assert.match(backend, /build_sequential_rename_plan\(metadata, prompt_ids\)/);
    assert.match(backend, /metadata\[prompt_id\]\["name"\] = name/);
});
