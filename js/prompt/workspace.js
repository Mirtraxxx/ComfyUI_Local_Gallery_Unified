export function createPromptWorkspaceController({
    widgetContainer,
    uniqueId,
    closeToolbarPanels,
    closeActiveSidebarForWorkspaceMode,
    clearLibraryNavActiveState,
    syncSelectedSectionVisibility,
    renderPinnedCategoryStrip,
    getActiveLibraryTab,
    setActiveLibraryTab,
    showBrowseWorkspace,
    showPresetsWorkspace,
    showImportWorkspace,
    showExportWorkspace,
}) {
    let workspaceMode = "gallery";
    let disposed = false;
    let libraryShellHost = null;
    let libraryShellClickHandler = null;

    function detachLibraryShellHandler() {
        if (libraryShellHost && libraryShellClickHandler) {
            libraryShellHost.removeEventListener("click", libraryShellClickHandler);
        }
        libraryShellHost = null;
        libraryShellClickHandler = null;
    }

    function getWorkspaceMode() {
        return workspaceMode;
    }

    function getWorkspaceHost() {
        return widgetContainer.querySelector(`#${uniqueId}-workspace-host`);
    }

    function setWorkspaceMode(mode = "gallery") {
        if (disposed && !widgetContainer.isConnected) return null;
        // ComfyUI may transiently invoke node cleanup while retaining/reusing the
        // connected DOM widget. A visible workspace must remain interactive.
        disposed = false;
        workspaceMode = mode;
        closeToolbarPanels();
        const host = getWorkspaceHost();
        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
        if (!host) return null;

        if (mode === "gallery") detachLibraryShellHandler();
        host.innerHTML = "";
        host.classList.toggle("active", mode !== "gallery");
        if (mode !== "gallery") {
            closeActiveSidebarForWorkspaceMode();
            setActiveLibraryTab(null);
            clearLibraryNavActiveState();
            drawer?.classList.remove("active");
        }
        syncSelectedSectionVisibility();
        renderPinnedCategoryStrip();
        return host;
    }

    function returnToGallery() {
        setWorkspaceMode("gallery");
    }

    function toggleWorkspaceMode(mode, openWorkspace) {
        if (workspaceMode === mode) {
            returnToGallery();
            return;
        }
        return openWorkspace();
    }

    function getLibrarySubnavHtml(activePage = "cards") {
        const navItems = [
            { key: "cards", label: "Cards" },
            { key: "presets", label: "Presets" },
            { key: "import", label: "Import TXT" },
            { key: "export", label: "Export TXT" },
        ];

        return `
            <nav class="localprompt-library-subnav" aria-label="Library sections">
                ${navItems.map(item => `
                    <button class="localprompt-library-subnav-item${item.key === activePage ? " active" : ""}" data-library-page="${item.key}" type="button">${item.label}</button>
                `).join("")}
            </nav>
        `;
    }

    function renderLibraryShell(activePage = "cards") {
        if (disposed && !widgetContainer.isConnected) return null;
        const host = setWorkspaceMode(`library_${activePage}`);
        if (!host) return null;

        host.innerHTML = `
            <div class="localprompt-library-shell">
                <header class="localprompt-library-shell-header">
                    <div class="localprompt-library-shell-brand">
                        <strong>Prompt Library</strong>
                        <span>Cards, presets, and wildcard files</span>
                    </div>
                    <button class="localprompt-library-shell-close" data-library-close type="button">Back to gallery</button>
                </header>
                <div class="localprompt-library-shell-content" id="${uniqueId}-library-workspace-content"></div>
            </div>
        `;

        detachLibraryShellHandler();
        const onLibraryShellClick = event => {
            const closeButton = event.target.closest?.("[data-library-close]");
            if (closeButton && host.contains(closeButton)) {
                returnToGallery();
                return;
            }
            const button = event.target.closest?.("[data-library-page]");
            if (!button || !host.contains(button)) return;
            const page = button.dataset.libraryPage;
            if (page === "cards") showBrowseWorkspace();
            if (page === "presets") showPresetsWorkspace();
            if (page === "import") showImportWorkspace();
            if (page === "export") showExportWorkspace();
        };
        host.addEventListener("click", onLibraryShellClick);
        libraryShellHost = host;
        libraryShellClickHandler = onLibraryShellClick;

        return host.querySelector(`#${uniqueId}-library-workspace-content`);
    }

    function renderLibraryWorkspace() {
        if (disposed && !widgetContainer.isConnected) return;
        return showBrowseWorkspace();
    }

    return {
        getWorkspaceMode,
        getWorkspaceHost,
        setWorkspaceMode,
        toggleWorkspaceMode,
        returnToGallery,
        getLibrarySubnavHtml,
        renderLibraryShell,
        renderLibraryWorkspace,
        dispose() {
            disposed = true;
            detachLibraryShellHandler();
            workspaceMode = "gallery";
        },
    };
}
