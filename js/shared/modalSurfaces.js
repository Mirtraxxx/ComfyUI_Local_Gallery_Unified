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

export function createCenteredOverlay(documentRef = globalThis.document) {
    const overlay = documentRef.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 110000;
    `;
    return overlay;
}

export function createDialogPanel(width = 500, documentRef = globalThis.document) {
    const dialog = documentRef.createElement("div");
    dialog.style.cssText = `
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 8px;
        padding: 20px;
        width: ${width}px;
        max-width: 90%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    return dialog;
}

export function createWorkspaceDialogSurface({
    workspaceContainer = null,
    onWorkspaceClose = null,
    onClose = null,
    width = 500,
    documentRef = globalThis.document,
}) {
    if (!workspaceContainer) {
        const overlay = createCenteredOverlay(documentRef);
        const dialog = createDialogPanel(width, documentRef);
        overlay.appendChild(dialog);
        documentRef.body.appendChild(overlay);
        return { dialog, close: () => overlay.remove(), isWorkspace: false };
    }

    const surface = createModalSurface({
        workspaceContainer,
        onWorkspaceClose: onWorkspaceClose || onClose,
        documentRef,
    });
    const dialog = documentRef.createElement("div");
    dialog.className = "localprompt-workspace-page";
    dialog.style.width = `${width}px`;
    surface.root.appendChild(dialog);
    return { dialog, close: surface.close, isWorkspace: true };
}
