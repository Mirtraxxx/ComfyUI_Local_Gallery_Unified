export function bindBackdropClose(overlay, close = () => overlay.remove()) {
    const onBackdropClick = event => {
        if (event.target === overlay) close();
    };
    overlay.addEventListener("click", onBackdropClick);
    return () => overlay.removeEventListener("click", onBackdropClick);
}

export function createModalSurface({
    workspaceContainer = null,
    onWorkspaceClose = null,
    overlayClassName = "localprompt-modal-overlay",
    workspaceClassName = "localprompt-workspace-panel",
    documentRef = globalThis.document,
}) {
    if (!workspaceContainer) {
        const root = documentRef.createElement("div");
        root.className = overlayClassName;
        documentRef.body.appendChild(root);
        return { root, close: () => root.remove(), isWorkspace: false };
    }

    workspaceContainer.innerHTML = "";
    const root = documentRef.createElement("div");
    root.className = workspaceClassName;
    workspaceContainer.appendChild(root);
    let closed = false;
    return {
        root,
        close: () => {
            if (closed) return;
            closed = true;
            root.remove();
            onWorkspaceClose?.();
        },
        isWorkspace: true,
    };
}
