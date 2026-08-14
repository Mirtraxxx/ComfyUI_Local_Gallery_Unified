import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const jsRoot = fileURLToPath(new URL("../js/", import.meta.url));

async function listJavaScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
            ? listJavaScriptFiles(target)
            : (entry.isFile() && entry.name.endsWith(".js") ? [target] : []);
    }));
    return nested.flat();
}

test("each internal module uses one consolidated cache URL", async () => {
    const files = await listJavaScriptFiles(jsRoot);
    const urlsByModule = new Map();

    for (const file of files) {
        const source = await readFile(file, "utf8");
        const specifiers = source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+\.js(?:\?[^"']*)?)["']/g);
        for (const [, specifier] of specifiers) {
            if (!specifier.startsWith(".")) continue;
            const [modulePath, query = ""] = specifier.split("?");
            const normalized = path.normalize(path.resolve(path.dirname(file), modulePath));
            const urls = urlsByModule.get(normalized) || new Set();
            urls.add(`${normalized}${query ? `?${query}` : ""}`);
            urlsByModule.set(normalized, urls);

        }
    }

    const duplicates = [...urlsByModule]
        .filter(([, urls]) => urls.size > 1)
        .map(([modulePath, urls]) => `${path.relative(jsRoot, modulePath)}: ${[...urls].join(", ")}`);
    assert.deepEqual(duplicates, []);
});
