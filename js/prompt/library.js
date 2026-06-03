export function getUtilityLibraryTabs() {
    return ["most_used", "pinned"];
}

export function isUtilityLibraryTab(tabName) {
    return getUtilityLibraryTabs().includes(tabName);
}

export function applyLibraryTabLayoutPreference({ widgetContainer, uniqueId, layoutMode }) {
    const barContainer = widgetContainer.querySelector(".localprompt-library-bar-container");
    const tabStrip = widgetContainer.querySelector(".localprompt-library-tab-strip");
    const tabsScroll = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
    const isWrapMode = layoutMode === "wrap";
    if (barContainer) barContainer.classList.toggle("wrap-mode", isWrapMode);
    if (tabStrip) tabStrip.classList.toggle("wrap-mode", isWrapMode);
    if (tabsScroll) tabsScroll.classList.toggle("wrap-mode", isWrapMode);
}

export async function renderLibraryBar({
    widgetContainer,
    uniqueId,
    getLibraryTabs,
    getActiveLibraryTab,
    setActiveLibraryTab,
    saveLibraryTabs,
    applyLibraryTabLayoutPreference,
    applyLibraryTabRoleStyling,
    clearLibraryNavActiveState,
    renderLibraryDrawer,
    syncSelectedSectionVisibility,
    rerenderLibraryBar,
}) {
    const tabsContainer = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
    const utilityContainer = widgetContainer.querySelector(`#${uniqueId}-utility-tabs`);
    if (!tabsContainer || !utilityContainer) return;

    const utilityTabs = getUtilityLibraryTabs();
    const categoryTabs = getLibraryTabs();
    let draggedLibraryTab = null;

    tabsContainer.innerHTML = "";
    utilityContainer.innerHTML = "";
    applyLibraryTabLayoutPreference();

    const renderTabButton = (tabContent, targetContainer, role = "category") => {
        const tabBtn = document.createElement("button");
        const isActive = getActiveLibraryTab() === tabContent;
        tabBtn.className = `localprompt-library-tab${role === "utility" ? " localprompt-utility-tab" : ""}${isActive ? " active" : ""}`;
        if (tabContent === "most_used") {
            tabBtn.innerHTML = "&#128293;";
            tabBtn.title = "Most Used";
        } else if (tabContent === "pinned") {
            tabBtn.innerHTML = "&#11088;";
            tabBtn.title = "Pinned";
        } else {
            tabBtn.innerHTML = tabContent;
        }
        if (!isUtilityLibraryTab(tabContent)) {
            applyLibraryTabRoleStyling(tabBtn, tabContent, isActive);
            tabBtn.draggable = true;
            tabBtn.style.cursor = "grab";
        }

        tabBtn.addEventListener("click", async () => {
            const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
            const resizeHandle = widgetContainer.querySelector(`#${uniqueId}-resize`);
            if (getActiveLibraryTab() === tabContent) {
                setActiveLibraryTab(null);
                clearLibraryNavActiveState();
                drawer.classList.remove("active");
                if (resizeHandle) resizeHandle.classList.add("hidden");
            } else {
                setActiveLibraryTab(tabContent);
                clearLibraryNavActiveState();
                tabBtn.classList.add("active");
                drawer.classList.add("active");
                if (resizeHandle) resizeHandle.classList.remove("hidden");
                await renderLibraryDrawer(tabContent);
            }
            syncSelectedSectionVisibility();
        });

        tabBtn.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            if (isUtilityLibraryTab(tabContent)) {
                alert("Cannot remove default tabs.");
                return;
            }
            if (confirm(`Remove "${tabContent}" from library bar?`)) {
                await saveLibraryTabs(getLibraryTabs().filter(tab => tab !== tabContent));
                if (getActiveLibraryTab() === tabContent) {
                    setActiveLibraryTab(null);
                    widgetContainer.querySelector(`#${uniqueId}-library-drawer`).classList.remove("active");
                }
                syncSelectedSectionVisibility();
                rerenderLibraryBar();
            }
        });

        if (!isUtilityLibraryTab(tabContent)) {
            tabBtn.addEventListener("dragstart", (event) => {
                draggedLibraryTab = tabContent;
                tabBtn.style.opacity = "0.45";
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", tabContent);
                }
            });
            tabBtn.addEventListener("dragover", (event) => {
                if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                event.preventDefault();
                tabBtn.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,0.28)";
            });
            tabBtn.addEventListener("dragleave", () => {
                tabBtn.style.boxShadow = "";
                applyLibraryTabRoleStyling(tabBtn, tabContent, getActiveLibraryTab() === tabContent);
            });
            tabBtn.addEventListener("drop", async (event) => {
                if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                event.preventDefault();
                const currentTabs = getLibraryTabs();
                const fromIndex = currentTabs.indexOf(draggedLibraryTab);
                const toIndex = currentTabs.indexOf(tabContent);
                if (fromIndex < 0 || toIndex < 0) return;
                const reorderedTabs = [...currentTabs];
                const [movedTab] = reorderedTabs.splice(fromIndex, 1);
                reorderedTabs.splice(toIndex, 0, movedTab);
                await saveLibraryTabs(reorderedTabs);
                draggedLibraryTab = null;
                rerenderLibraryBar();
                const activeLibraryTab = getActiveLibraryTab();
                if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
            });
            tabBtn.addEventListener("dragend", () => {
                draggedLibraryTab = null;
                tabBtn.style.opacity = "";
                tabBtn.style.boxShadow = "";
                applyLibraryTabRoleStyling(tabBtn, tabContent, getActiveLibraryTab() === tabContent);
            });
        }

        targetContainer.appendChild(tabBtn);
    };

    utilityTabs.forEach(tabContent => renderTabButton(tabContent, utilityContainer, "utility"));
    categoryTabs.forEach(tabContent => renderTabButton(tabContent, tabsContainer, "category"));
}
