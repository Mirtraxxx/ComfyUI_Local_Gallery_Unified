// Category/folder pill strip shared by both galleries. The strip shows as many
// pills as fit on one line; the overflow list always holds every pill.

export function fitPillStrip(strip) {
    const pills = [...strip.children];
    pills.forEach(pill => { pill.hidden = false; });
    const limit = strip.clientWidth;
    let overflowing = false;
    for (const pill of pills) {
        if (!overflowing && pill.offsetLeft + pill.offsetWidth > limit) overflowing = true;
        pill.hidden = overflowing;
    }
}

export function observePillStrip(strip) {
    const observer = new ResizeObserver(() => fitPillStrip(strip));
    observer.observe(strip);
    return observer;
}

export function makePill({ label, color, active, pinned }) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `lg-pill${active ? " active" : ""}`;
    pill.textContent = label;
    pill.title = label;
    pill.dataset.pinned = String(Boolean(pinned));
    if (color) pill.style.setProperty("--pill", color);
    return pill;
}

/**
 * Fill `container` with a search field and a grid of `pills`.
 * `state.query` persists the search text across re-renders.
 */
export function renderPillOverflow(container, pills, { state, placeholder, emptyText, onPick, onClose }) {
    const search = document.createElement("input");
    search.type = "search";
    search.className = "lg-input";
    search.placeholder = placeholder;
    search.autocomplete = "off";
    search.spellcheck = false;
    search.value = state.query;

    const grid = document.createElement("div");
    grid.className = "lg-pill-grid";
    pills.forEach(pill => grid.appendChild(pill));

    const empty = document.createElement("div");
    empty.className = "lg-empty";
    empty.textContent = emptyText;
    empty.setAttribute("role", "status");

    const applySearch = () => {
        const query = state.query.trim().toLocaleLowerCase();
        let visible = 0;
        pills.forEach(pill => {
            const matches = !query || pill.textContent.toLocaleLowerCase().includes(query);
            pill.hidden = !matches;
            if (matches) visible += 1;
        });
        empty.hidden = visible !== 0;
    };
    search.addEventListener("input", () => {
        state.query = search.value;
        applySearch();
    });
    search.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            const first = pills.find(pill => !pill.hidden);
            if (first) onPick(first);
        } else if (event.key === "Escape") {
            event.stopPropagation();
            event.preventDefault();
            if (search.value) {
                search.value = "";
                state.query = "";
                applySearch();
            } else {
                onClose();
            }
        }
    });
    container.replaceChildren(search, grid, empty);
    applySearch();
}
