import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
    WORKFLOW_PROFILE_PROPERTY,
    readWorkflowProfileSection,
    writeWorkflowProfileSection,
} from "../js/shared/workflowProfile.js";

function makeNode() {
    let changes = 0;
    return {
        id: 650,
        properties: {
            lora_gallery_unique_id: "lora-gallery-shared",
            prompt_gallery_unique_id: "prompt-gallery-shared",
        },
        graph: {
            change() {
                changes += 1;
            },
        },
        get changes() {
            return changes;
        },
    };
}

test("copied node identities keep independent workflow profile objects", () => {
    const firstWorkflowNode = makeNode();
    const secondWorkflowNode = makeNode();

    writeWorkflowProfileSection(firstWorkflowNode, "prompt_ui", {
        library_tabs: ["pinned", "Anima", "Styles"],
    });
    writeWorkflowProfileSection(secondWorkflowNode, "prompt_ui", {
        library_tabs: ["pinned", "Wan Low", "Wan High"],
    });

    assert.deepEqual(
        readWorkflowProfileSection(firstWorkflowNode, "prompt_ui").library_tabs,
        ["pinned", "Anima", "Styles"],
    );
    assert.deepEqual(
        readWorkflowProfileSection(secondWorkflowNode, "prompt_ui").library_tabs,
        ["pinned", "Wan Low", "Wan High"],
    );
});

test("profile sections are cloned and preserve sibling gallery state", () => {
    const node = makeNode();
    const loraState = { folder_order: ["Anima", "Styles"] };
    writeWorkflowProfileSection(node, "lora_ui", loraState);
    loraState.folder_order.push("Mutated outside");

    writeWorkflowProfileSection(node, "prompt_ui", { pinned_categories: ["Poses"] });

    assert.deepEqual(readWorkflowProfileSection(node, "lora_ui"), {
        folder_order: ["Anima", "Styles"],
    });
    assert.deepEqual(readWorkflowProfileSection(node, "prompt_ui"), { pinned_categories: ["Poses"] });
});

test("identical snapshots do not repeatedly dirty the workflow", () => {
    const node = makeNode();
    const state = { folder_order: ["A", "B"], sort_mode: "az" };

    assert.equal(writeWorkflowProfileSection(node, "lora_ui", state), true);
    assert.equal(writeWorkflowProfileSection(node, "lora_ui", state), false);
    assert.equal(node.changes, 1);
});

test("unsupported profile versions fall back without corrupting serialized data", () => {
    const node = makeNode();
    node.properties[WORKFLOW_PROFILE_PROPERTY] = {
        version: 99,
        prompt_ui: { library_tabs: ["future"] },
    };

    assert.equal(readWorkflowProfileSection(node, "prompt_ui"), null);
    assert.equal(writeWorkflowProfileSection(node, "prompt_ui", { library_tabs: ["old client"] }), false);
    assert.deepEqual(node.properties[WORKFLOW_PROFILE_PROPERTY], {
        version: 99,
        prompt_ui: { library_tabs: ["future"] },
    });
});

test("Prompt and LoRA lifecycles prefer embedded state", async () => {
    const [promptUi, loraUi] = await Promise.all([
        readFile(new URL("../js/prompt/ui.js", import.meta.url), "utf8"),
        readFile(new URL("../js/lora/ui.js", import.meta.url), "utf8"),
    ]);

    assert.match(promptUi, /readWorkflowProfileSection\(node_instance, "prompt_ui"\)/);
    assert.match(promptUi, /writeWorkflowProfileSection\(node_instance, "prompt_ui"/);
    assert.match(loraUi, /readWorkflowProfileSection\(this, "lora_ui"\)/);
    assert.match(loraUi, /writeWorkflowProfileSection\(this, "lora_ui"/);
    assert.doesNotMatch(loraUi, /\.then\(\(\) => UnifiedLoraGalleryNode\.setUiState/);
});
