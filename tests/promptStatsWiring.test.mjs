import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const promptUiUrl = new URL("../js/prompt/ui.js", import.meta.url);
const promptApiUrl = new URL("../js/api/promptApi.js", import.meta.url);

test("Prompt Stats is exposed through the Prompt gallery node API", async () => {
    const [uiSource, apiSource] = await Promise.all([
        readFile(promptUiUrl, "utf8"),
        readFile(promptApiUrl, "utf8"),
    ]);

    assert.match(uiSource, /async getPromptStats\(options = \{\}\)\s*\{[\s\S]*?promptApi\.getPromptStats\(options\)/);
    assert.match(apiSource, /\/localgalleryunified\/prompt\/get_prompt_stats/);
});
