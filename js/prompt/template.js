import { getPromptStyles } from "./styles.js";
import { THUMBNAIL_SIZE_MIN, THUMBNAIL_SIZE_MAX } from "./constants.js";

export function getPromptTemplate(uniqueId) {
    return `
                ${getPromptStyles(uniqueId)}
                <div class="localprompt-container" style="height: 100%;">
                    <div class="localprompt-workspace">
                        <div class="localprompt-top-row">
                            <div class="localprompt-toolbar">
                                <button class="localprompt-active-side-tab empty" id="${uniqueId}-active-toggle" type="button" title="Active Prompts" aria-label="Active Prompts" aria-pressed="false">
                                    <span class="localprompt-active-side-tab-count" id="${uniqueId}-active-tab-count">0</span>
                                </button>
                                <div class="localprompt-pinned-categories" id="${uniqueId}-pinned-categories">
                                    <div class="localprompt-pinned-first-row" id="${uniqueId}-pinned-first-row">
                                        <div class="localprompt-pinned-category-wrapper" id="${uniqueId}-pinned-category-wrapper">
                                            <div class="localprompt-pinned-category-strip" id="${uniqueId}-pinned-category-strip"></div>
                                        </div>
                                        <div class="localprompt-more-category-group align-right" id="${uniqueId}-more-category-group">
                                            <button class="localprompt-toolbar-button localprompt-icon-btn" id="${uniqueId}-meta-tags-btn" type="button" title="Meta Tags / Hidden Prompts" aria-label="Meta Tags / Hidden Prompts">
                                                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><path d="M7 7h.01"></path></svg>
                                            </button>
                                            <div class="localprompt-dropdown-panel localprompt-meta-panel" id="${uniqueId}-meta-tags-panel">
                                                <div class="localprompt-meta-header">
                                                    <span class="localprompt-meta-title">Hidden Prompts</span>
                                                    <span class="localprompt-meta-save-status" id="${uniqueId}-meta-save-status" aria-live="polite"></span>
                                                </div>
                                                <div class="localprompt-dropdown-note" style="padding: 2px 0 6px; font-size: 9px; line-height: 1.3; color: rgba(225, 237, 245, 0.45);">
                                                    Injected into output, hidden from Active Prompts.
                                                </div>
                                                <div class="localprompt-meta-list" id="${uniqueId}-meta-tags-list"></div>
                                                <div class="localprompt-dropdown-divider"></div>
                                                <button class="localprompt-btn localprompt-meta-add-btn" id="${uniqueId}-add-meta-tag-btn" type="button">+ Add Hidden Prompt</button>
                                            </div>
                                            <button class="localprompt-favorite-toggle-btn localprompt-icon-btn" id="${uniqueId}-fav-toggle-btn" type="button" title="Favorites" aria-label="Favorites">
                                                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.19L12 17.18l-5.56 2.93 1.06-6.19L3 9.53l6.22-.9L12 3z"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="localprompt-category-overflow-wrapper" id="${uniqueId}-category-overflow-wrapper">
                                        <div class="localprompt-category-overflow" id="${uniqueId}-category-overflow">
                                            <div class="localprompt-category-overflow-chips" id="${uniqueId}-category-overflow-chips"></div>
                                        </div>
                                        <button class="localprompt-category-pull-tab" id="${uniqueId}-category-pull-tab" type="button" aria-expanded="false" aria-controls="${uniqueId}-category-overflow" title="Show all categories">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>
                                </div>
                                <select id="${uniqueId}-category-select" style="display: none;"><option value="">All Categories</option></select>
                            </div>
                        </div>
                        <div class="localprompt-body-shell">
                            <aside class="localprompt-active-sidebar" id="${uniqueId}-active-sidebar">
                                <div class="localprompt-active-sidebar-header">
                                    <div class="localprompt-active-sidebar-title">
                                        <span>Active</span>
                                        <span id="${uniqueId}-active-count">0 selected</span>
                                    </div>
                                    <button class="localprompt-btn localprompt-clear-btn" id="${uniqueId}-active-clear-btn" style="padding: 2px 6px; font-size: 9px; background: #4a2a2a; border-color: #6a3a3a;">Clear All</button>
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
                    <!-- BOTTOM BAR -->
                    <div class="localprompt-bottom-bar localprompt-action-bar">
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-library-btn" title="Library" aria-label="Library">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-from-last-output-btn" title="From Last Output" aria-label="From Last Output">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-import-btn" title="Import" aria-label="Import">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-settings-btn" title="Settings" aria-label="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"></path><path d="M4 10V3"></path><path d="M12 21v-9"></path><path d="M12 8V3"></path><path d="M20 21v-5"></path><path d="M20 12V3"></path><path d="M2 14h4"></path><path d="M10 8h4"></path><path d="M18 16h4"></path></svg>
                        </button>
                        <div class="localprompt-display-options-anchor">
                            <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-size-toggle-btn" title="Display options" aria-label="Display options">
                                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"></path><path d="M18 7h2"></path><path d="M4 17h2"></path><path d="M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle></svg>
                            </button>
                            <div class="localprompt-display-options-popover" id="${uniqueId}-size-controls" style="display: none;">
                                <div class="localprompt-display-options-panel">
                                    <section class="localprompt-display-section">
                                        <div class="localprompt-display-section-title">ACTIVE</div>
                                        <select id="${uniqueId}-active-display-mode" class="localprompt-display-mode-select" title="Active display mode">
                                            <option value="compact">Compact</option>
                                            <option value="thumbnails">Thumbnails</option>
                                        </select>
                                        <label class="localprompt-thumbnail-size-control" id="${uniqueId}-active-size-control" title="Active prompt thumbnail size">
                                            <span>-</span>
                                            <input id="${uniqueId}-active-thumbnail-size-slider" type="range" min="${THUMBNAIL_SIZE_MIN}" max="${THUMBNAIL_SIZE_MAX}" step="1">
                                            <span>+</span>
                                        </label>
                                    </section>
                                    <section class="localprompt-display-section">
                                        <div class="localprompt-display-section-title">CARDS</div>
                                        <select id="${uniqueId}-cards-display-mode" class="localprompt-display-mode-select" title="Cards display mode">
                                            <option value="thumbnails">Thumbnails</option>
                                            <option value="compact">Compact</option>
                                        </select>
                                        <label class="localprompt-thumbnail-size-control" id="${uniqueId}-cards-size-control" title="Cards thumbnail size">
                                            <span>-</span>
                                            <input id="${uniqueId}-thumbnail-size-slider" type="range" min="${THUMBNAIL_SIZE_MIN}" max="${THUMBNAIL_SIZE_MAX}" step="1">
                                            <span>+</span>
                                        </label>
                                    </section>
                                    <section class="localprompt-display-section">
                                        <div class="localprompt-display-section-title">CONTRAST</div>
                                        <select id="${uniqueId}-card-contrast-select" class="localprompt-display-mode-select" title="Card contrast mode">
                                            <option value="off">Off (Default)</option>
                                            <option value="dim_inactive">Dim Inactive</option>
                                            <option value="dim_by_default">Dim by Default</option>
                                        </select>
                                    </section>
                                    <section class="localprompt-display-section">
                                        <div class="localprompt-display-section-title">SORT CARDS</div>
                                        <select id="${uniqueId}-main-sort-select" class="localprompt-display-mode-select" title="Sort cards">
                                            <option value="manual">Manual / stored order</option>
                                            <option value="newest">Newest first</option>
                                            <option value="oldest">Oldest first</option>
                                            <option value="az">A to Z</option>
                                            <option value="za">Z to A</option>
                                        </select>
                                    </section>
                                </div>
                            </div>
                        </div>
                        <button class="localprompt-btn localprompt-icon-btn localprompt-wildcard-toggle" id="${uniqueId}-wildcard-toggle-btn" title="Wildcard Mode" aria-label="Wildcard Mode">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"></path><path d="M8 8h.01"></path><path d="M16 8h.01"></path><path d="M8 16h.01"></path><path d="M16 16h.01"></path><path d="M12 12h.01"></path></svg>
                        </button>
                        <div class="localprompt-config-bar collapsed" id="${uniqueId}-config-bar">
                            <div class="seed-group localprompt-wildcard-row" id="${uniqueId}-wildcard-controls" style="display: none;">
                                <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-wildcards-btn" title="Wildcard Categories" aria-label="Wildcard Categories">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 8 4-8 4-8-4 8-4z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 18 8 4 8-4"></path></svg>
                                </button>
                                <div class="comfyui-seed-style">
                                    <button id="${uniqueId}-seed-dec" class="seed-btn">&lt;</button>
                                    <span class="seed-label">seed</span>
                                    <input type="number" id="${uniqueId}-seed-input" class="seed-input" value="0">
                                    <button id="${uniqueId}-seed-inc" class="seed-btn">&gt;</button>
                                </div>
                                <select id="${uniqueId}-control-select" style="padding: 4px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px; font-size: 11px; margin-left: 4px;">
                                    <option value="fixed">fixed</option>
                                    <option value="increment">increment</option>
                                    <option value="decrement">decrement</option>
                                    <option value="randomize">randomize</option>
                                </select>
                                <label class="localprompt-wildcard-rng-control" title="Wildcard RNG mode">
                                    <span>RNG</span>
                                    <select id="${uniqueId}-wildcard-rng-select">
                                        <option value="seed_stable">Seed-stable</option>
                                        <option value="shuffle">Shuffle order</option>
                                        <option value="fresh">Fresh every run</option>
                                    </select>
                                </label>
                                <button class="localprompt-btn localprompt-wildcard-shuffle-btn" id="${uniqueId}-wildcard-shuffle-btn" type="button" title="Shuffle wildcard picks" aria-label="Shuffle wildcard picks">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M16 3h5v5"></path>
                                        <path d="M4 20 21 3"></path>
                                        <path d="M21 16v5h-5"></path>
                                        <path d="m15 15 6 6"></path>
                                        <path d="m4 4 5 5"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="localprompt-bottom-spacer"></div>
                        <div class="localprompt-utility-bar">
                            <div class="localprompt-utility-buttons" id="${uniqueId}-utility-tabs"></div>
                        </div>
                    </div>
                </div>
    `;
}
