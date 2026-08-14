import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiMock = { fetchApi: null };
globalThis.__localGalleryApiMock = apiMock;

async function loadApiModule(relativePath) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const isolatedSource = source.replace(
        /^import \{ api \} from "\.\.\/\.\.\/\.\.\/scripts\/api\.js";/,
        "const api = globalThis.__localGalleryApiMock;",
    );
    return await import(`data:text/javascript;base64,${Buffer.from(isolatedSource).toString("base64")}`);
}

function jsonResponse(data, { ok = true, status = 200, statusText = "" } = {}) {
    return {
        ok,
        status,
        statusText,
        async json() {
            return data;
        },
    };
}

const [promptApi, loraApi] = await Promise.all([
    loadApiModule("../js/api/promptApi.js"),
    loadApiModule("../js/api/loraApi.js"),
]);

test("prompt and LoRA APIs reject status:error payloads with response context", async () => {
    for (const [call, message] of [
        [() => promptApi.createPrompt("name", "text"), "Prompt write failed"],
        [() => loraApi.updateMetadata("model.safetensors", {}), "LoRA write failed"],
    ]) {
        const result = { status: "error", message, code: "write_failed" };
        apiMock.fetchApi = async () => jsonResponse(result);

        await assert.rejects(call, error => {
            assert.equal(error.message, message);
            assert.equal(error.status, 200);
            assert.equal(error.result, result);
            return true;
        });
    }
});

test("non-2xx invalid JSON produces a useful HTTP error with status metadata", async () => {
    apiMock.fetchApi = async () => ({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        async json() {
            throw new SyntaxError("not JSON");
        },
    });

    await assert.rejects(() => promptApi.getCategories(), error => {
        assert.equal(error.message, "Service Unavailable");
        assert.equal(error.status, 503);
        assert.deepEqual(error.result, {
            status: "error",
            message: "Service Unavailable",
        });
        return true;
    });
});

test("bulk prompt conflicts retain the payload and HTTP status", async () => {
    const conflict = {
        status: "conflict",
        message: "The gallery changed",
        revision: "new-revision",
    };
    apiMock.fetchApi = async () => jsonResponse(conflict, { status: 200 });

    await assert.rejects(() => promptApi.bulkEdit({ type: "ids", ids: ["one"] }, []), error => {
        assert.equal(error.message, conflict.message);
        assert.equal(error.status, 200);
        assert.equal(error.result, conflict);
        return true;
    });
});

test("fetch AbortError rejections pass through unchanged", async () => {
    const abortError = new Error("cancelled");
    abortError.name = "AbortError";
    apiMock.fetchApi = async () => {
        throw abortError;
    };

    await assert.rejects(() => loraApi.getLoras(), error => error === abortError);
});
