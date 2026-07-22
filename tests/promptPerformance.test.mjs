import assert from "node:assert/strict";
import test from "node:test";
import { importModuleSource } from "./importModuleSource.mjs";

const { createDebouncedCommitter } = await importModuleSource(
    new URL("../js/prompt/performance.js", import.meta.url)
);

test("Hidden Prompt persistence debounce coalesces bursts and flushes safely", async () => {
    let commits = 0;
    const committer = createDebouncedCommitter(() => { commits += 1; }, 20);

    committer.schedule();
    committer.schedule();
    committer.schedule();
    assert.equal(committer.pending, true);
    assert.equal(committer.flush(), true);
    assert.equal(commits, 1);
    assert.equal(committer.pending, false);

    committer.schedule();
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(commits, 2);
});

test("disposed debouncer can discard a pending non-destructive UI update", () => {
    let commits = 0;
    const committer = createDebouncedCommitter(() => { commits += 1; }, 100);
    committer.schedule();
    committer.dispose({ flushPending: false });
    assert.equal(commits, 0);
    assert.equal(committer.pending, false);
});
