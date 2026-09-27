import { escapeHtml } from "../shared/dom.js";

// Card Insights deliberately reuses the established prompt-term aggregate.  Prompt
// cards do not have a separate structured `tags` field; the backend derives these
// terms from comma-delimited `prompt_text` and documents that distinction in the UI.
const GROUP_LABELS = { all: "All terms", characters: "Characters", franchises: "Franchises", other: "Other terms" };

function createInsightsHtml() {
    return `
        <div class="lg-root localprompt-modal-overlay localprompt-card-insights-overlay">
            <section class="localprompt-modal localprompt-card-insights-dialog" role="dialog" aria-modal="true" aria-labelledby="card-insights-title">
                <header class="localprompt-modal-header">
                    <div><h3 id="card-insights-title">Card Stats</h3><p class="localprompt-stats-subtitle">Inspect library coverage and recurring prompt terms.</p></div>
                    <button type="button" class="localprompt-modal-close" data-insights-close aria-label="Close Card Insights">×</button>
                </header>
                <div class="localprompt-modal-content localprompt-card-insights-content">
                    <section data-insights-panel="stats">
                        <div class="localprompt-stats-summary" data-insights-summary aria-live="polite">Loading card overview…</div>
                        <p class="localprompt-stats-note">Prompt terms are comma-delimited entries from card prompt text. A term is counted once per card.</p>
                        <div class="localprompt-card-insights-overview" data-insights-overview></div>
                        <p class="localprompt-stats-note">Choose any categories to compare them. With none checked, stats include the whole library.</p>
                        <fieldset class="localprompt-card-insights-categories" data-insights-categories><legend>Category scope</legend><div data-insights-category-options>Loading categories…</div></fieldset>
                        <p class="localprompt-card-insights-limit" data-insights-limit aria-live="polite"></p>
                        <div class="localprompt-stats-controls">
                            <div class="localprompt-stats-tabs" role="tablist">${Object.entries(GROUP_LABELS).map(([value, label]) => `<button type="button" class="lg-text-btn${value === "all" ? " active" : ""}" data-stats-group="${value}">${label}</button>`).join("")}</div>
                            <label class="localprompt-stats-search"><span class="sr-only">Filter prompt terms</span><input class="lg-input" type="search" placeholder="Filter terms…" data-stats-search></label>
                            <select class="lg-select" data-stats-sort aria-label="Sort prompt terms"><option value="count">Most common</option><option value="name">A to Z</option></select>
                        </div>
                        <p class="localprompt-stats-note" data-stats-note></p>
                        <div class="localprompt-stats-list" data-stats-list></div>
                        <div class="localprompt-stats-empty" data-stats-empty hidden>No matching prompt terms.</div>
                    </section>
                </div>
                <footer class="localprompt-modal-footer localprompt-stats-footer"><div class="localprompt-stats-pagination" data-stats-pagination><button type="button" class="lg-text-btn" data-stats-prev>Prev</button><span data-stats-page>Page 1 of 1</span><button type="button" class="lg-text-btn" data-stats-next>Next</button></div><button type="button" class="lg-text-btn" data-insights-close>Close</button></footer>
            </section>
        </div>`;
}

function renderEntries(root, result, selectedCategories) {
    const list = root.querySelector("[data-stats-list]");
    const entries = Array.isArray(result?.entries) ? result.entries : [];
    root.querySelector("[data-stats-empty]").hidden = entries.length > 0;
    list.innerHTML = entries.map((entry) => {
        const tag = String(entry.tag || "");
        const count = Number(entry.count || 0);
        const detail = (entry.categories || []).filter(item => selectedCategories.includes(item.category)).map(item => `<span>${escapeHtml(item.category || "Uncategorized")} <strong>${Number(item.count || 0).toLocaleString()}</strong></span>`).join("");
        return `<article class="localprompt-stats-row"><div class="localprompt-stats-tag" title="${escapeHtml(tag)}">${escapeHtml(tag)}</div><div class="localprompt-stats-count"><strong>${count.toLocaleString()}</strong></div>${detail ? `<details class="localprompt-stats-categories"><summary>Category breakdown</summary><div>${detail}</div></details>` : ""}</article>`;
    }).join("");
}

export function showWildcardStats({ galleryNode, nodeInstance, category = "", surfaceHost = null }) {
    const previouslyFocused = document.activeElement;
    const host = document.createElement("div");
    host.innerHTML = createInsightsHtml();
    const root = host.firstElementChild;
    (surfaceHost?.isConnected ? surfaceHost : document.body).appendChild(root);
    let group = "all";
    let page = 1;
    let sequence = 0;
    let searchTimer = null;
    const prefs = nodeInstance?.uiPrefs || {};
    let selectedCategories = Array.isArray(prefs.card_insights_categories) ? [...prefs.card_insights_categories] : (category ? [category] : []);

    async function persist() {
        if (!nodeInstance || typeof galleryNode.saveUiPrefs !== "function") return;
        nodeInstance.uiPrefs = nodeInstance.uiPrefs || {};
        nodeInstance.uiPrefs.card_insights_categories = selectedCategories;
        await galleryNode.saveUiPrefs(nodeInstance.uiPrefs, nodeInstance);
    }
    function close() {
        clearTimeout(searchTimer);
        sequence += 1;
        document.removeEventListener("keydown", onKeydown);
        root.remove();
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
    }
    function onKeydown(event) { if (event.key === "Escape") close(); }
    async function loadTerms() {
        const current = ++sequence;
        const list = root.querySelector("[data-stats-list]");
        list.setAttribute("aria-busy", "true");
        try {
            const result = await galleryNode.getPromptStats({ categories: selectedCategories, group, search: root.querySelector("[data-stats-search]").value, sort: root.querySelector("[data-stats-sort]").value, page });
            if (current !== sequence) return;
            page = Number(result.page || 1);
            root.querySelector("[data-insights-summary]").textContent = `${Number(result.card_count || 0).toLocaleString()} cards · ${Number(result.matching_tag_count || 0).toLocaleString()} matching ${GROUP_LABELS[group].toLowerCase()}`;
            root.querySelector("[data-stats-page]").textContent = `Page ${page} of ${Number(result.total_pages || 1)}`;
            root.querySelector("[data-stats-prev]").disabled = page <= 1;
            root.querySelector("[data-stats-next]").disabled = page >= Number(result.total_pages || 1);
            root.querySelector("[data-stats-note]").textContent = ["characters", "franchises"].includes(group) ? "Character and franchise groups use explicit character \\(franchise\\) syntax." : "Each term is counted once per card.";
            renderEntries(root, result, selectedCategories);
            root.querySelector("[data-insights-overview]").innerHTML = `<div><strong>${Number(result.card_count || 0).toLocaleString()}</strong><span>cards in scope</span></div><div><strong>${Number(result.unique_tag_count || 0).toLocaleString()}</strong><span>unique ${GROUP_LABELS[group].toLowerCase()}</span></div><div><strong>${selectedCategories.length || "All"}</strong><span>selected categories</span></div>`;
        } catch (error) { if (current === sequence) root.querySelector("[data-insights-summary]").textContent = error.message || "Failed to load Card Insights."; }
        finally { if (current === sequence) list.removeAttribute("aria-busy"); }
    }
    async function loadCategories() {
        const summary = await galleryNode.getCategorySummary();
        const available = summary?.categories || [];
        selectedCategories = selectedCategories.filter(value => available.includes(value));
        root.querySelector("[data-insights-category-options]").innerHTML = available.length ? available.map(value => `<label><input type="checkbox" value="${escapeHtml(value)}" ${selectedCategories.includes(value) ? "checked" : ""}> ${escapeHtml(value)} <span>(${Number(summary?.counts?.[value] || 0)})</span></label>`).join("") : "No categories yet.";
        const updateLimit = () => { root.querySelector("[data-insights-limit]").textContent = selectedCategories.length ? `${selectedCategories.length} categories selected.` : "All categories included."; };
        updateLimit();
        root.querySelectorAll("[data-insights-category-options] input").forEach(input => input.addEventListener("change", async () => {
            selectedCategories = Array.from(root.querySelectorAll("[data-insights-category-options] input:checked")).map(item => item.value);
            updateLimit(); page = 1; await persist(); loadTerms();
        }));
    }
    root.querySelectorAll("[data-insights-close]").forEach(button => button.addEventListener("click", close));
    root.addEventListener("click", event => { if (event.target === root) close(); });
    root.querySelectorAll("[data-stats-group]").forEach(button => button.addEventListener("click", () => { group = button.dataset.statsGroup; page = 1; root.querySelectorAll("[data-stats-group]").forEach(item => item.classList.toggle("active", item === button)); loadTerms(); }));
    root.querySelector("[data-stats-search]").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; loadTerms(); }, 250); });
    root.querySelector("[data-stats-sort]").addEventListener("change", () => { page = 1; loadTerms(); });
    root.querySelector("[data-stats-prev]").addEventListener("click", () => { page -= 1; loadTerms(); });
    root.querySelector("[data-stats-next]").addEventListener("click", () => { page += 1; loadTerms(); });
    document.addEventListener("keydown", onKeydown);
    root.querySelector("[data-insights-close]")?.focus();
    loadCategories().then(loadTerms);
}
