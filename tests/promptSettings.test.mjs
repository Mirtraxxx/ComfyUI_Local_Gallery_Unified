import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsUrl = new URL("../js/prompt/settings.js", import.meta.url);

async function loadPreviewColorResolver() {
    const source = await readFile(settingsUrl, "utf8");
    const isolatedSource = source
        .replace(/^import .*?;\r?\n/gm, "")
        .replace("function getCategoryPreviewColor", "export function getCategoryPreviewColor");
    return import(`data:text/javascript;base64,${Buffer.from(isolatedSource).toString("base64")}`);
}

test("reset category colors override the saved color while settings are still open", async () => {
    const { getCategoryPreviewColor } = await loadPreviewColorResolver();
    const savedRoleColor = () => "#ef4444";

    assert.equal(
        getCategoryPreviewColor("Portrait", { Portrait: "#ef4444" }, savedRoleColor, new Set(["Portrait"])),
        "#6c757d",
    );
    assert.equal(
        getCategoryPreviewColor("Portrait", { Portrait: "#22c55e" }, savedRoleColor, new Set()),
        "#22c55e",
    );
});
