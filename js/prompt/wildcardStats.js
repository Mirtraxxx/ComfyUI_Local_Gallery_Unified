import { escapeHtml } from "../shared/dom.js";


const GROUP_LABELS = {
    all: "All tags",
    characters: "Characters",
    franchises: "Franchises",
    other: "Other tags",
};


function createStatsHtml(category) {
    const scopeLabel = category === null ? "All categories" : (category || "Uncategorized");
    return `
        <div class="localprompt-modal-overlay localprompt-stats-overlay">
            <div class="localprompt-modal localprompt-stats-dialog" role="dialog" aria-modal="true" aria-labelledby="prompt-stats-title">
                <div class="localprompt-modal-header">
                    <div>
                        <h3 id="prompt-stats-title">Prompt stats</h3>
                        <p class="localprompt-stats-subtitle">${escapeHtml(scopeLabel)}</p>
                    </div>
                    <button type="button" class="localprompt-modal-close" data-stats-close title="Close">×</button>
                </div>
                <div class="localprompt-modal-content localprompt-stats-content">
                    <div class="localprompt-stats-summary" aria-live="polite">Loading prompt tags…</div>
                    <div class="localprompt-stats-controls">
                        <div class="localprompt-stats-tabs" role="tablist">
                            ${Object.entries(GROUP_LABELS).map(([value, label]) => `<button type="button" class="localprompt-btn${value === "all" ? " active" : ""}" data-stats-group="${value}">${label}</button>`).join("")}
                        </div>
                        <label class="localprompt-stats-search">
                            <span class="sr-only">Filter prompt tags</span>
                            <input type="search" placeholder="Filter tags…" data-stats-search>
                        </label>
                        <select data-stats-sort title="Sort prompt stats">
                            <option value="count">Most common</option>
                            <option value="name">A to Z</option>
                        </select>
                    </div>
                    <p class="localprompt-stats-note" data-stats-note></p>
                    <div class="localprompt-stats-list" data-stats-list></div>
                    <div class="localprompt-stats-empty" data-stats-empty hidden>No matching tags.</div>
                </div>
                <div class="localprompt-modal-footer localprompt-stats-footer">
                    <button type="button" class="localprompt-btn" data-stats-prev>Prev</button>
                    <span data-stats-page>Page 1 of 1</span>
                    <button type="button" class="localprompt-btn" data-stats-next>Next</button>
                    <button type="button" class="localprompt-btn" data-stats-close>Close</button>
                </div>
            </div>
        </div>
    `;
}


function renderEntries(root, result, category) {
    const list = root.querySelector("[data-stats-list]");
    const empty = root.querySelector("[data-stats-empty]");
    const entries = Array.isArray(result?.entries) ? result.entries : [];
    empty.hidden = entries.length > 0;
    list.innerHTML = entries.map((entry) => {
        const count = Number(entry.count || 0);
        const percent = result.card_count ? Math.round((count / result.card_count) * 1000) / 10 : 0;
        const categoryDetails = category === null
            ? (entry.categories || []).map((item) => {
                const name = item.category || "Uncategorized";
                return `<span>${escapeHtml(name)} <strong>${Number(item.count || 0).toLocaleString()}</strong></span>`;
            }).join("")
            : "";
        return `
            <article class="localprompt-stats-row">
                <div class="localprompt-stats-tag" title="${escapeHtml(entry.tag)}">${escapeHtml(entry.tag)}</div>
                <div class="localprompt-stats-count"><strong>${count.toLocaleString()}</strong><span>${percent}% of cards</span></div>
                ${categoryDetails ? `<details class="localprompt-stats-categories"><summary>Used in ${(entry.categories || []).length} wildcard${(entry.categories || []).length === 1 ? "" : "s"}</summary><div>${categoryDetails}</div></details>` : ""}
            </article>
        `;
    }).join("");
}


export function showWildcardStats({ galleryNode, category = null, surfaceHost = null }) {
    const host = document.createElement("div");
    host.innerHTML = createStatsHtml(category);
    const root = host.firstElementChild;
    (surfaceHost?.isConnected ? surfaceHost : document.body).appendChild(root);
    let group = "all";
    let page = 1;
    let sequence = 0;
    let searchTimer = null;

    function close() {
        clearTimeout(searchTimer);
        sequence += 1;
        document.removeEventListener("keydown", onKeydown);
        root.remove();
    }

    function onKeydown(event) {
        if (event.key === "Escape") close();
    }

    async function load() {
        const currentSequence = ++sequence;
        const summary = root.querySelector(".localprompt-stats-summary");
        const list = root.querySelector("[data-stats-list]");
        summary.textContent = "Loading prompt tags…";
        list.setAttribute("aria-busy", "true");
        try {
            const result = await galleryNode.getPromptStats({
                category,
                group,
                search: root.querySelector("[data-stats-search]").value,
                sort: root.querySelector("[data-stats-sort]").value,
                page,
            });
            if (currentSequence !== sequence) return;
            page = Number(result.page || 1);
            summary.textContent = `${Number(result.card_count || 0).toLocaleString()} cards · ${Number(result.matching_tag_count || 0).toLocaleString()} matching ${GROUP_LABELS[group].toLowerCase()}`;
            root.querySelector("[data-stats-page]").textContent = `Page ${page} of ${Number(result.total_pages || 1)}`;
            root.querySelector("[data-stats-prev]").disabled = page <= 1;
            root.querySelector("[data-stats-next]").disabled = page >= Number(result.total_pages || 1);
            root.querySelector("[data-stats-note]").textContent = ["characters", "franchises"].includes(group)
                ? "Detected from explicit character \\(franchise\\) prompt syntax."
                : "Each tag is counted once per card, even if repeated inside that card.";
            renderEntries(root, result, category);
        } catch (error) {
            if (currentSequence !== sequence) return;
            summary.textContent = error.message || "Failed to load prompt stats.";
            list.innerHTML = "";
        } finally {
            if (currentSequence === sequence) list.removeAttribute("aria-busy");
        }
    }

    root.querySelectorAll("[data-stats-close]").forEach((button) => button.addEventListener("click", close));
    root.addEventListener("click", (event) => { if (event.target === root) close(); });
    root.querySelectorAll("[data-stats-group]").forEach((button) => button.addEventListener("click", () => {
        group = button.dataset.statsGroup;
        page = 1;
        root.querySelectorAll("[data-stats-group]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
        load();
    }));
    root.querySelector("[data-stats-search]").addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { page = 1; load(); }, 250);
    });
    root.querySelector("[data-stats-sort]").addEventListener("change", () => { page = 1; load(); });
    root.querySelector("[data-stats-prev]").addEventListener("click", () => { page -= 1; load(); });
    root.querySelector("[data-stats-next]").addEventListener("click", () => { page += 1; load(); });
    document.addEventListener("keydown", onKeydown);
    load();
}
