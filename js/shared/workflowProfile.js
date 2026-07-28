export const WORKFLOW_PROFILE_PROPERTY = "local_gallery_workflow_profile";
export const WORKFLOW_PROFILE_VERSION = 1;

const PROFILE_SECTIONS = new Set(["prompt_ui", "lora_ui"]);

function cloneJsonValue(value, fallback = null) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function readProfile(nodeInstance) {
    const profile = nodeInstance?.properties?.[WORKFLOW_PROFILE_PROPERTY];
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
    if (Number(profile.version) !== WORKFLOW_PROFILE_VERSION) return null;
    return profile;
}

export function hasWorkflowProfileSection(nodeInstance, section) {
    if (!PROFILE_SECTIONS.has(section)) return false;
    const profile = readProfile(nodeInstance);
    const value = profile?.[section];
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function readWorkflowProfileSection(nodeInstance, section) {
    if (!PROFILE_SECTIONS.has(section)) return null;
    const profile = readProfile(nodeInstance);
    const value = profile?.[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return cloneJsonValue(value, null);
}

export function writeWorkflowProfileSection(nodeInstance, section, value, { markChanged = true } = {}) {
    if (!nodeInstance || !PROFILE_SECTIONS.has(section)) return false;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (!nodeInstance.properties) nodeInstance.properties = {};

    const serializedProfile = nodeInstance.properties[WORKFLOW_PROFILE_PROPERTY];
    if (
        serializedProfile
        && typeof serializedProfile === "object"
        && !Array.isArray(serializedProfile)
        && Number(serializedProfile.version) !== WORKFLOW_PROFILE_VERSION
    ) {
        return false;
    }
    const currentProfile = readProfile(nodeInstance);
    const nextProfile = currentProfile
        ? cloneJsonValue(currentProfile, {})
        : { version: WORKFLOW_PROFILE_VERSION };
    nextProfile.version = WORKFLOW_PROFILE_VERSION;
    nextProfile[section] = cloneJsonValue(value, {});

    const previousSerialized = JSON.stringify(nodeInstance.properties[WORKFLOW_PROFILE_PROPERTY] || null);
    const nextSerialized = JSON.stringify(nextProfile);
    if (previousSerialized === nextSerialized) return false;

    nodeInstance.properties[WORKFLOW_PROFILE_PROPERTY] = nextProfile;
    if (markChanged) {
        nodeInstance.graph?.change?.();
        nodeInstance.setDirtyCanvas?.(true, true);
    }
    return true;
}

export function getWorkflowProfileStatus(nodeInstance) {
    return {
        version: WORKFLOW_PROFILE_VERSION,
        prompt: hasWorkflowProfileSection(nodeInstance, "prompt_ui"),
        lora: hasWorkflowProfileSection(nodeInstance, "lora_ui"),
    };
}
