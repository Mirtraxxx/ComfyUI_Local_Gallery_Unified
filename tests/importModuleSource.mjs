import { readFile } from "node:fs/promises";

export async function importModuleSource(url) {
    const source = await readFile(url, "utf8");
    const encoded = Buffer.from(source).toString("base64");
    return import(`data:text/javascript;base64,${encoded}`);
}
