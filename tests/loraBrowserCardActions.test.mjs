import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/lora/styles.js", import.meta.url);

test("LoRA browser card names and actions reveal only on hover, focus, or selection", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(
        styles,
        /\.locallora-lora-card-info \{[\s\S]*?opacity: 0;/,
    );
    assert.match(
        styles,
        /\.locallora-lora-card:hover \.locallora-lora-card-info,[\s\S]*?\.locallora-lora-card:focus-within \.locallora-lora-card-info,[\s\S]*?\.locallora-lora-card\.selected-flow \.locallora-lora-card-info,[\s\S]*?\.locallora-lora-card\.selected-edit \.locallora-lora-card-info/,
    );
    assert.match(
        styles,
        /\.card-btn \{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/,
    );
    assert.match(
        styles,
        /\.locallora-lora-card:hover \.card-btn,[\s\S]*?\.locallora-lora-card:focus-within \.card-btn,[\s\S]*?\.locallora-lora-card\.selected-flow \.card-btn,[\s\S]*?\.locallora-lora-card\.selected-edit \.card-btn/,
    );
    // Contact theme may restyle the caption gradient, but must not force it always-visible.
    const contactInfoRule = styles.match(
        /\/\* Keep default hidden; reveal only on hover \/ focus \/ selection \*\//,
    );
    assert.ok(contactInfoRule, "missing contact-theme note that preserves hover/select reveal");
    assert.doesNotMatch(
        styles,
        /\/\* Keep default hidden; reveal only on hover \/ focus \/ selection \*\/[\s\S]{0,40}opacity:\s*1/,
    );
});

test("LoRA thumbnail cards use larger action buttons with edit stacked under the Civitai link", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.card-btn \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
    assert.match(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.card-btn svg \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/,
    );
    assert.match(styles, /\.lora-card-link-btn \{ top: 4px; right: 4px; \}/);
    assert.match(styles, /\.edit-tags-btn \{ top: 4px; right: 4px; \}/);
    assert.match(
        styles,
        /\.locallora-lora-card:has\(\.lora-card-link-btn\) \.edit-tags-btn \{[\s\S]*?top: calc\(4px \+ 24px \+ 4px\);/,
    );
    assert.match(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.locallora-lora-card:has\(\.lora-card-link-btn\) \.edit-tags-btn \{[\s\S]*?top: calc\(4px \+ 44px \+ 4px\);/,
    );
    assert.doesNotMatch(styles, /\.edit-tags-btn \{ bottom: 4px; right: 4px; \}/);
});
