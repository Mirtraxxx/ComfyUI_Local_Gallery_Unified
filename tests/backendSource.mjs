import { readdir, readFile } from "node:fs/promises";

const backendDir = new URL("../backend/", import.meta.url);

// Source-wiring tests grep the backend text, which is split across `<prefix>_*.py` modules.
export async function readBackendSource(prefix) {
    const names = (await readdir(backendDir)).filter((name) => name.endsWith(".py") && name.startsWith(`${prefix}_`)).sort();
    const sources = await Promise.all(names.map((name) => readFile(new URL(name, backendDir), "utf8")));
    return sources.join("\n");
}
