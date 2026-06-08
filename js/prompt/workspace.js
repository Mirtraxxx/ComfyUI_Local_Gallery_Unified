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
}) {
    let workspaceMode = "gallery";

    function getWorkspaceMode() {
        return workspaceMode;
    }

    function getWorkspaceHost() {
        return widgetContainer.querySelector(`#${uniqueId}-workspace-host`);
    }

    function setWorkspaceMode(mode = "gallery") {
        workspaceMode = mode;
        closeToolbarPanels();
        const host = getWorkspaceHost();
        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
        if (!host) return null;

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
        const host = setWorkspaceMode(`library_${activePage}`);
        if (!host) return null;

        host.innerHTML = `
            <div class="localprompt-library-shell">
                <div class="localprompt-library-shell-content" id="${uniqueId}-library-workspace-content"></div>
            </div>
        `;

        host.addEventListener("click", event => {
            const button = event.target.closest?.("[data-library-page]");
            if (!button || !host.contains(button)) return;
            const page = button.dataset.libraryPage;
            if (page === "overview") renderLibraryWorkspace();
            if (page === "cards") showBrowseWorkspace();
            if (page === "presets") showPresetsWorkspace();
            if (page === "import") showImportWorkspace();
        });

        return host.querySelector(`#${uniqueId}-library-workspace-content`);
    }

    function renderLibraryWorkspace() {
        const content = renderLibraryShell("overview");
        if (!content) return;
        content.innerHTML = `
            <div class="localprompt-workspace-panel">
                <div class="localprompt-workspace-page">
                    <div class="localprompt-workspace-header">
                        <div class="localprompt-workspace-title">
                            <h3>Library</h3>
                            <p>Choose what you want to manage.</p>
                        </div>
                    </div>
                    ${getLibrarySubnavHtml("overview")}
                    <div class="localprompt-workspace-body">
                        <div class="localprompt-library-landing">
                            <button class="localprompt-library-choice" data-workspace-target="library_cards" style="--library-accent: #58d66a;">
                                <span class="localprompt-library-choice-icon">C</span>
                                <strong>Cards</strong>
                                <span>Browse, search, pin, add, and manage prompt cards.</span>
                            </button>
                            <button class="localprompt-library-choice" data-workspace-target="library_presets" style="--library-accent: #9b62ff;">
                                <span class="localprompt-library-choice-icon">P</span>
                                <strong>Presets</strong>
                                <span>Save, load, edit, and create prompt preset stacks.</span>
                            </button>
                            <button class="localprompt-library-choice" data-workspace-target="import_txt" style="--library-accent: #4f93ff;">
                                <span class="localprompt-library-choice-icon">I</span>
                                <strong>Import TXT</strong>
                                <span>Create a new category from a wildcard-style text file.</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        content.querySelector('[data-workspace-target="library_cards"]')?.addEventListener("click", () => showBrowseWorkspace());
        content.querySelector('[data-workspace-target="library_presets"]')?.addEventListener("click", () => showPresetsWorkspace());
        content.querySelector('[data-workspace-target="import_txt"]')?.addEventListener("click", () => showImportWorkspace());
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
    };
}
