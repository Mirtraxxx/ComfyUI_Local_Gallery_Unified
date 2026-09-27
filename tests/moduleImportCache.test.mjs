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

// A query string makes the browser load a second, separate instance of a module
// whenever two importers disagree on it, so internal imports use plain paths.
test("internal module imports have no cache-busting query strings", async () => {
    const files = await listJavaScriptFiles(jsRoot);
    const offenders = [];

    for (const file of files) {
        const source = await readFile(file, "utf8");
        const specifiers = source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+\.js\?[^"']*)["']/g);
        for (const [, specifier] of specifiers) {
            if (specifier.startsWith(".")) offenders.push(`${path.relative(jsRoot, file)}: ${specifier}`);
        }
    }

    assert.deepEqual(offenders, []);
});
