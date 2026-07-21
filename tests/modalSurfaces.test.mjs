import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { bindBackdropClose, createModalSurface, createWorkspaceDialogSurface } = await importModuleSource(
    new URL("../js/shared/modalSurfaces.js", import.meta.url),
);

function createElement() {
    const listeners = new Map();
    return {
        className: "",
        style: {},
        children: [],
        innerHTML: "",
        removed: false,
        appendChild(child) { this.children.push(child); },
        remove() { this.removed = true; },
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type, listener) {
            if (listeners.get(type) === listener) listeners.delete(type);
        },
        dispatch(type, event) { listeners.get(type)?.(event); },
    };
}

test("modal surface creates a document overlay", () => {
    const body = createElement();
    const surface = createModalSurface({
        documentRef: { body, createElement },
    });

    assert.equal(surface.isWorkspace, false);
    assert.equal(surface.root.className, "localprompt-modal-overlay");
    assert.equal(body.children[0], surface.root);
    surface.close();
    assert.equal(surface.root.removed, true);
});

test("dialog surface composes centered and workspace variants", () => {
    const body = createElement();
    const documentRef = { body, createElement };
    const centered = createWorkspaceDialogSurface({ width: 420, documentRef });
    assert.equal(centered.isWorkspace, false);
    assert.match(centered.dialog.style.cssText, /width: 420px/);
    assert.equal(body.children.length, 1);

    const workspace = createElement();
    const embedded = createWorkspaceDialogSurface({ workspaceContainer: workspace, width: 520, documentRef });
    assert.equal(embedded.isWorkspace, true);
    assert.equal(embedded.dialog.className, "localprompt-workspace-page");
    assert.equal(embedded.dialog.style.width, "520px");
});

test("workspace surface closes once and backdrop binding ignores child clicks", () => {
    const workspace = createElement();
    let closes = 0;
    const surface = createModalSurface({
        workspaceContainer: workspace,
        onWorkspaceClose: () => closes++,
        documentRef: { createElement },
    });
    const unbind = bindBackdropClose(surface.root, surface.close);

    surface.root.dispatch("click", { target: {} });
    assert.equal(closes, 0);
    surface.root.dispatch("click", { target: surface.root });
    surface.close();
    assert.equal(closes, 1);
    unbind();
});
