import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { bindBackdropClose, createModalSurface } = await importModuleSource(
    new URL("../js/shared/modalSurfaces.js", import.meta.url),
);

function createElement() {
    const listeners = new Map();
    return {
        className: "",
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
