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

    function getLibrarySubnavHtml(activePage = "overview") {
        const navItems = [
            { key: "overview", label: "Overview" },
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

    function renderLibraryShell(activePage = "overview") {
        if (disposed && !widgetContainer.isConnected) return null;
        const host = setWorkspaceMode(`library_${activePage}`);
        if (!host) return null;

        host.innerHTML = `
            <div class="localprompt-library-shell">
                <div class="localprompt-library-shell-content" id="${uniqueId}-library-workspace-content"></div>
            </div>
        `;

        detachLibraryShellHandler();
        const onLibraryShellClick = event => {
            const button = event.target.closest?.("[data-library-page]");
            if (!button || !host.contains(button)) return;
            const page = button.dataset.libraryPage;
            if (page === "overview") renderLibraryWorkspace();
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
        const content = renderLibraryShell("overview");
        if (!content) return;
        content.innerHTML = `
            <div class="localprompt-workspace-panel">
                <div class="localprompt-workspace-page">
                    <div class="localprompt-workspace-header">
                        <div class="localprompt-workspace-title">
                            <h3>Library <span class="localprompt-title-status" aria-hidden="true"></span></h3>
                            <p>Manage cards, reusable stacks, and wildcard text files.</p>
                        </div>
                    </div>
                    ${getLibrarySubnavHtml("overview")}
                    <div class="localprompt-workspace-body">
                        <div class="localprompt-library-landing">
                            <button class="localprompt-library-choice" data-workspace-target="library_cards" style="--library-accent: #58d66a;">
                                <span class="localprompt-library-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9h10M7 13h7"></path><path d="M1 8v8M23 8v8"></path></svg></span>
                                <strong>Cards <span class="localprompt-library-choice-arrow" aria-hidden="true">›</span></strong>
                                <span>Browse, search, pin, add, and manage prompt cards.</span>
                            </button>
                            <button class="localprompt-library-choice" data-workspace-target="library_presets" style="--library-accent: #9b62ff;">
                                <span class="localprompt-library-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Z"></path><path d="m4 12 8 4 8-4M4 17l8 4 8-4"></path></svg></span>
                                <strong>Presets <span class="localprompt-library-choice-arrow" aria-hidden="true">›</span></strong>
                                <span>Save, load, edit, and create prompt preset stacks.</span>
                            </button>
                            <button class="localprompt-library-choice" data-workspace-target="import_txt" style="--library-accent: #4f93ff;">
                                <span class="localprompt-library-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5M12 11v7M9 15l3 3 3-3"></path></svg></span>
                                <strong>Import TXT <span class="localprompt-library-choice-arrow" aria-hidden="true">›</span></strong>
                                <span>Create a new category from a wildcard-style text file.</span>
                            </button>
                            <button class="localprompt-library-choice" data-workspace-target="export_txt" style="--library-accent: #4f93ff;">
                                <span class="localprompt-library-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V3M8 7l4-4 4 4"></path><path d="M5 12v9h14v-9"></path></svg></span>
                                <strong>Export TXT <span class="localprompt-library-choice-arrow" aria-hidden="true">›</span></strong>
                                <span>Export a category to a ComfyUI wildcard .txt file.</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        content.querySelector('[data-workspace-target="library_cards"]')?.addEventListener("click", () => showBrowseWorkspace());
        content.querySelector('[data-workspace-target="library_presets"]')?.addEventListener("click", () => showPresetsWorkspace());
        content.querySelector('[data-workspace-target="import_txt"]')?.addEventListener("click", () => showImportWorkspace());
        content.querySelector('[data-workspace-target="export_txt"]')?.addEventListener("click", () => showExportWorkspace());
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
