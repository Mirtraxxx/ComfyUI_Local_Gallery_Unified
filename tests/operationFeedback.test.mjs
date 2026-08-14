import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { createOperationFeedback } = await importModuleSource(
    new URL("../js/shared/operationFeedback.js", import.meta.url),
);

function createElement() {
    const listeners = new Map();
    const classes = new Set();
    return {
        children: [],
        dataset: {},
        parentNode: null,
        textContent: "",
        title: "",
        className: "",
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle(name, force) {
                const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
                if (shouldAdd) classes.add(name);
                else classes.delete(name);
                return shouldAdd;
            },
        },
        setAttribute(name, value) {
            this[name] = String(value);
        },
        append(...children) {
            children.forEach(child => {
                child.parentNode = this;
                this.children.push(child);
            });
        },
        appendChild(child) {
            this.append(child);
            return child;
        },
        insertBefore(child, before) {
            child.parentNode = this;
            const index = this.children.indexOf(before);
            this.children.splice(index < 0 ? this.children.length : index, 0, child);
            return child;
        },
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        removeEventListener(type, listener) {
            if (listeners.get(type) === listener) listeners.delete(type);
        },
        async emit(type) {
            return await listeners.get(type)?.({ preventDefault() {} });
        },
        remove() {
            if (!this.parentNode) return;
            const index = this.parentNode.children.indexOf(this);
            if (index >= 0) this.parentNode.children.splice(index, 1);
            this.parentNode = null;
        },
    };
}

function createDocument() {
    return {
        head: createElement(),
        createElement,
        getElementById: () => null,
    };
}

test("operation feedback exposes pending, success, failure, retry, and cleanup states", async () => {
    const documentRef = createDocument();
    const host = createElement();
    const trailingControl = createElement();
    host.appendChild(trailingControl);
    const feedback = createOperationFeedback({
        host,
        before: trailingControl,
        documentRef,
        successDuration: 0,
    });

    assert.equal(host.children[0], feedback.root);
    const feedbackStyles = documentRef.head.children[0].textContent;
    assert.match(feedbackStyles, /> \.localgallery-operation-feedback/);
    assert.doesNotMatch(feedbackStyles, /min-height:\s*42px/);
    feedback.pending("Saving...");
    assert.equal(feedback.root.dataset.state, "pending");
    assert.equal(feedback.root.children[1].textContent, "Saving...");
    assert.equal(host.classList.contains("localgallery-operation-feedback-active"), true);

    let attempts = 0;
    const operation = async () => {
        attempts += 1;
        return attempts === 1
            ? { status: "error", message: "Write rejected" }
            : { status: "ok" };
    };
    await assert.rejects(
        feedback.run(operation, {
            pendingMessage: "Saving...",
            successMessage: "Saved to gallery",
            retry: true,
        }),
        /Write rejected/,
    );
    assert.equal(feedback.root.dataset.state, "error");
    assert.equal(feedback.root["aria-live"], "assertive");
    assert.equal(feedback.root.children[1].textContent, "Write rejected");
    assert.equal(feedback.root.children[2].textContent, "Retry");

    await feedback.root.children[2].emit("click");
    assert.equal(attempts, 2);
    assert.equal(feedback.root.dataset.state, "success");
    assert.equal(feedback.root.children[1].textContent, "Saved to gallery");

    feedback.ready();
    assert.equal(host.classList.contains("localgallery-operation-feedback-active"), false);
    feedback.dispose();
    assert.equal(host.children.includes(feedback.root), false);
});
