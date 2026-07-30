import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    normalizeLoraLotteryConfig,
    readLoraLotteryConfig,
} from "../js/lora/lotteryState.js";

const uiSource = await readFile(new URL("../js/lora/ui.js", import.meta.url), "utf8");
const unifiedSource = await readFile(new URL("../Local_Gallery_Unified.py", import.meta.url), "utf8");

test("LoRA lottery config normalizes legacy and malformed values", () => {
    assert.deepEqual(normalizeLoraLotteryConfig(), {
        enabled: false,
        folder: "",
        strength: 1,
        strength_clip: 1,
    });
    assert.deepEqual(readLoraLotteryConfig(JSON.stringify({
        version: 1,
        items: [],
        lottery: {
            enabled: true,
            folder: "Styles",
            strength: "0.75",
            strength_clip: "bad",
        },
    })), {
        enabled: true,
        folder: "Styles",
        strength: 0.75,
        strength_clip: 0.75,
    });
});

test("LoRA lottery controls persist in the selection envelope", () => {
    assert.match(uiSource, /selectionEnvelope\.lottery = getLotteryConfig\(\)/);
    assert.match(uiSource, /liveEnvelope\.lottery = getLotteryConfig\(\)/);
    assert.match(uiSource, /syncLotteryControls\(readLoraLotteryConfig\(savedSelection\)\)/);
    assert.match(uiSource, /One random LoRA will be added to each run/);
});

test("unified execution resolves the lottery before building cache keys", () => {
    assert.match(
        unifiedSource,
        /resolved_selection = lora_cls\.resolve_lottery_selection\(lora_selection_data\)[\s\S]*?lora_signature = cls\._get_lora_model_signature\(lora_cls, resolved_selection\)/,
    );
    assert.match(
        unifiedSource,
        /load_loras\([\s\S]*?resolved_selection or "\[\]"/,
    );
});

