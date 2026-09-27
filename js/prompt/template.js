import {
    CARD_MANAGER_CARD_SIZE_MAX,
    CARD_MANAGER_CARD_SIZE_MIN,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js";
import { icon } from "../shared/icons.js";

const DISPLAY_MODE_OPTIONS = `
    <option value="thumbnails">Thumbnails</option>
    <option value="compact">Compact</option>`;

export function getPromptTemplate(uniqueId) {
    return `
<div class="localprompt-container lg-shell">
    <div class="localprompt-workspace">
        <div class="localprompt-top-row lg-bar lg-top">
            <button class="lg-count empty" id="${uniqueId}-active-toggle" type="button" title="Active prompts" aria-label="Active prompts" aria-pressed="false">
                ${icon("stack")}<span id="${uniqueId}-active-tab-count">0</span>
            </button>
            <div class="lg-strip" id="${uniqueId}-pinned-category-strip"></div>
            <button class="lg-icon-btn" id="${uniqueId}-category-pull-tab" type="button" hidden title="All categories" aria-label="All categories">${icon("chevronDown")}</button>
            <span class="lg-sep"></span>
            <button class="lg-icon-btn" id="${uniqueId}-meta-tags-btn" type="button" title="Hidden prompts" aria-label="Hidden prompts">${icon("tag")}</button>
            <button class="lg-icon-btn lg-favorite" id="${uniqueId}-fav-toggle-btn" type="button" title="Favorites" aria-label="Favorites">${icon("star")}</button>
            <div class="lg-overflow" id="${uniqueId}-category-overflow" hidden></div>
            <div class="lg-popover lg-drop localprompt-meta-panel" id="${uniqueId}-meta-tags-panel" hidden>
                <div class="lg-popover-head">
                    <div class="lg-row">
                        <span class="lg-popover-title">Hidden prompts</span>
                        <span class="lg-spacer"></span>
                        <span class="localprompt-meta-save-status" id="${uniqueId}-meta-save-status" aria-live="polite"></span>
                    </div>
                    <p class="lg-note">Added to the output without showing in the active stack.</p>
                </div>
                <div class="localprompt-meta-list" id="${uniqueId}-meta-tags-list"></div>
                <button class="lg-text-btn" id="${uniqueId}-add-meta-tag-btn" type="button">${icon("plus")}Add hidden prompt</button>
            </div>
        </div>
        <div class="localprompt-body-shell">
            <aside class="localprompt-active-sidebar lg-side" id="${uniqueId}-active-sidebar">
                <div class="lg-side-head">
                    <div class="lg-side-title">
                        <span>Active prompts</span>
                        <span id="${uniqueId}-active-count">0 selected</span>
                    </div>
                    <button class="lg-text-btn danger" id="${uniqueId}-active-clear-btn" type="button">Clear</button>
                </div>
                <div class="localprompt-active-sidebar-content">
                    <div class="localprompt-chip-container" id="${uniqueId}-active-chips"></div>
                </div>
            </aside>
            <div class="localprompt-library-pane">
                <div class="localprompt-workspace-host" id="${uniqueId}-workspace-host"></div>
                <div class="localprompt-library-drawer" id="${uniqueId}-library-drawer">
                    <div class="localprompt-chip-container" id="${uniqueId}-library-chips"></div>
                </div>
            </div>
        </div>
    </div>
    <div class="localprompt-bottom-bar lg-bar lg-bottom">
        <button class="lg-icon-btn" id="${uniqueId}-library-btn" type="button" title="Library" aria-label="Library">${icon("library")}</button>
        <button class="lg-icon-btn" id="${uniqueId}-add-prompt-btn" type="button" title="New prompt" aria-label="New prompt">${icon("plus")}</button>
        <button class="lg-icon-btn" id="${uniqueId}-import-btn" type="button" title="Import" aria-label="Import">${icon("import")}</button>
        <span class="lg-sep"></span>
        <div class="lg-anchor">
            <button class="lg-icon-btn" id="${uniqueId}-wildcard-toggle-btn" type="button" title="Wildcards" aria-label="Wildcards">${icon("dice")}</button>
            <div class="lg-popover" id="${uniqueId}-wildcard-controls" hidden>
                <div class="lg-popover-head">
                    <label class="lg-check"><input id="${uniqueId}-wildcard-enabled" type="checkbox"><span class="lg-popover-title">Wildcard mode</span></label>
                    <p class="lg-note">Each run picks one card from every wildcard category.</p>
                </div>
                <section class="lg-section">
                    <div class="lg-row">
                        <button class="lg-text-btn" id="${uniqueId}-wildcards-btn" type="button">${icon("stack")}Categories</button>
                        <button class="lg-text-btn" id="${uniqueId}-wildcard-shuffle-btn" type="button" title="Reshuffle the pick order">${icon("shuffle")}Reshuffle</button>
                    </div>
                    <label class="lg-field">Pick order
                        <select class="lg-select" id="${uniqueId}-wildcard-rng-select">
                            <option value="seed_stable">Follow the seed</option>
                            <option value="shuffle">Shuffled order</option>
                            <option value="fresh">Fresh every run</option>
                        </select>
                    </label>
                </section>
                <section class="lg-section">
                    <div class="lg-label">Seed</div>
                    <div class="lg-row">
                        <button class="lg-icon-btn" id="${uniqueId}-seed-dec" type="button" aria-label="Previous seed">&lsaquo;</button>
                        <input class="lg-input" id="${uniqueId}-seed-input" type="number" value="0" aria-label="Seed">
                        <button class="lg-icon-btn" id="${uniqueId}-seed-inc" type="button" aria-label="Next seed">&rsaquo;</button>
                    </div>
                    <label class="lg-field">After each run
                        <select class="lg-select" id="${uniqueId}-control-select">
                            <option value="fixed">Keep seed</option>
                            <option value="increment">Increment</option>
                            <option value="decrement">Decrement</option>
                            <option value="randomize">Randomize</option>
                        </select>
                    </label>
                </section>
                <section class="lg-section">
                    <label class="lg-check"><input id="${uniqueId}-wildcard-auto-attach" type="checkbox"><span>Use the output as the picked card's thumbnail</span></label>
                </section>
            </div>
        </div>
        <span class="lg-spacer"></span>
        <div class="lg-anchor">
            <button class="lg-icon-btn" id="${uniqueId}-size-toggle-btn" type="button" title="Display" aria-label="Display">${icon("sliders")}</button>
            <div class="lg-popover lg-align-end" id="${uniqueId}-size-controls" hidden>
                <section class="lg-section">
                    <div class="lg-label">Active stack</div>
                    <div class="lg-row">
                        <select class="lg-select" id="${uniqueId}-active-display-mode" aria-label="Active stack layout">${DISPLAY_MODE_OPTIONS}</select>
                        <input class="lg-range" id="${uniqueId}-active-thumbnail-size-slider" type="range" min="${THUMBNAIL_SIZE_MIN}" max="${THUMBNAIL_SIZE_MAX}" step="1" aria-label="Active thumbnail size">
                    </div>
                    <label class="lg-check"><input id="${uniqueId}-active-wide" type="checkbox"><span>Wide stack for large thumbnails</span></label>
                    <label class="lg-check"><input id="${uniqueId}-active-hover-open" type="checkbox"><span>Open on hover</span></label>
                </section>
                <section class="lg-section">
                    <div class="lg-label">Cards</div>
                    <div class="lg-row">
                        <select class="lg-select" id="${uniqueId}-cards-display-mode" aria-label="Card layout">${DISPLAY_MODE_OPTIONS}</select>
                        <input class="lg-range" id="${uniqueId}-thumbnail-size-slider" type="range" min="${THUMBNAIL_SIZE_MIN}" max="${THUMBNAIL_SIZE_MAX}" step="1" aria-label="Card thumbnail size">
                    </div>
                    <select class="lg-select" id="${uniqueId}-main-sort-select" aria-label="Sort cards">
                        <option value="manual">Manual order</option>
                        <option value="az">A to Z</option>
                        <option value="za">Z to A</option>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                </section>
                <section class="lg-section">
                    <div class="lg-label">Card manager</div>
                    <div class="lg-row">
                        <input class="lg-range" id="${uniqueId}-card-manager-size-slider" type="range" min="${CARD_MANAGER_CARD_SIZE_MIN}" max="${CARD_MANAGER_CARD_SIZE_MAX}" step="1" aria-label="Card manager card size">
                        <button class="lg-text-btn" id="${uniqueId}-card-manager-size-reset" type="button">Reset</button>
                    </div>
                </section>
                <section class="lg-section">
                    <label class="lg-check"><input id="${uniqueId}-promote-selected" type="checkbox"><span>Selected cards first</span></label>
                    <label class="lg-check"><input id="${uniqueId}-dim-unselected" type="checkbox"><span>Dim unselected cards</span></label>
                    <label class="lg-check"><input id="${uniqueId}-auto-hide-bar" type="checkbox"><span>Auto-hide bottom bar</span></label>
                </section>
                <section class="lg-section">
                    <div class="lg-label">Prompt source</div>
                    <select class="lg-select" id="${uniqueId}-prompt-source-select" aria-label="Prompt source"></select>
                    <p class="lg-note">Show Text node that "From Last Output" reads the prompt from.</p>
                </section>
            </div>
        </div>
    </div>
</div>
    `;
}
