import * as promptApi from "../api/promptApi.js";
import { PER_PAGE } from "./constants.js";

// State shared by every Prompt gallery on the canvas: the API wrappers (which
// normalize failures into safe fallback shapes) and the queue that attaches
// wildcard outputs as card thumbnails once ComfyUI goes idle.
export function createPromptGalleryNode() {
    return {
        name: "LocalGalleryPromptLora.PromptUI",
        lastOutput: null, // Stores { filename, subfolder, type } of last generation
        instances: new Set(),
        pendingWildcardAutoAttach: new Map(),
        recentOutputsByPromptId: new Map(),
        // Deferred auto-attach: queue card updates during long sequential runs and
        // flush only when Comfy is fully idle (never mid-sampling).
        deferredAutoAttachByPromptId: new Map(),
        deferredAutoAttachTimer: null,
        deferredAutoAttachFlushing: false,
        // Track Comfy execution so we never rewrite the large metadata file mid-run.
        isExecuting: false,
        queueRemaining: 0,
        // Short settle after true idle so the next queued job can cancel us first.
        AUTO_ATTACH_IDLE_SETTLE_MS: 750,

        async getPrompts(filter_name = "", mode = "OR", page = 1, selected_prompts = [], filter_category = "", favorites_only = false, perPage = PER_PAGE, sortMode = "manual", requestOptions = {}) {
            try {
                return await promptApi.getPrompts(filter_name, mode, page, selected_prompts, filter_category, favorites_only, perPage, sortMode, requestOptions);
            } catch (error) {
                if (requestOptions?.signal?.aborted) throw error;
                console.error("LocalPromptGallery: Error fetching prompts:", error);
                return { prompts: [], total_pages: 1, current_page: 1 };
            }
        },

        async getPrompt(prompt_id) {
            try {
                return await promptApi.getPrompt(prompt_id);
            } catch (error) {
                console.error("LocalPromptGallery: Error fetching prompt:", error);
                return null;
            }
        },

        async getPromptsByIds(prompt_ids = []) {
            try {
                return await promptApi.getPromptsByIds(prompt_ids);
            } catch (error) {
                console.error("LocalPromptGallery: Error fetching prompts by ids:", error);
                return [];
            }
        },

        async getCategories() {
            try {
                return await promptApi.getCategories();
            } catch (error) {
                console.error("LocalPromptGallery: Error fetching categories:", error);
                return [];
            }
        },

        async getCategorySummary() {
            try {
                return await promptApi.getCategorySummary();
            } catch (error) {
                console.error("LocalPromptGallery: Error fetching category summary:", error);
                return { categories: [], counts: {}, totalCount: null };
            }
        },

        async getPromptStats(options = {}) {
            try {
                return await promptApi.getPromptStats(options);
            } catch (error) {
                console.error("LocalPromptGallery: Error fetching prompt stats:", error);
                throw error;
            }
        },

        async updateMetadata(prompt_id, data) {
            try {
                return await promptApi.updateMetadata(prompt_id, data);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to update metadata", e);
                throw e;
            }
        },

        async createPrompt(name, prompt_text, category = "") {
            try {
                return await promptApi.createPrompt(name, prompt_text, category);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to create prompt", e);
                return { status: "error", message: e.toString() };
            }
        },

        async createPromptFromOutput(name, prompt_text, category = "", lastOutput = null) {
            try {
                return await promptApi.createPromptFromOutput(name, prompt_text, category, lastOutput);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to create prompt from output", e);
                return { status: "error", message: e.toString() };
            }
        },

        async deletePrompt(prompt_id) {
            try {
                return await promptApi.deletePrompt(prompt_id);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to delete prompt", e);
                return { status: "error", message: e.toString() };
            }
        },

        async deletePromptsBulk(prompt_ids) {
            try {
                return await promptApi.deletePromptsBulk(prompt_ids);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to bulk delete prompts", e);
                return { status: "error", message: e.toString() };
            }
        },

        async movePromptsBulk(prompt_ids, category = "") {
            try {
                return await promptApi.movePromptsBulk(prompt_ids, category);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to bulk move prompts", e);
                return { status: "error", message: e.toString() };
            }
        },

        async renamePromptsSequential(selection, options = {}) {
            try {
                return await promptApi.renamePromptsSequential(selection, options);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to rename prompts sequentially", e);
                throw e;
            }
        },

        async bulkEdit(selection, operations, options = {}) {
            try {
                return await promptApi.bulkEdit(selection, operations, options);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to bulk edit prompts", e);
                throw e;
            }
        },

        async uploadThumbnail(prompt_id, file) {
            try {
                return await promptApi.uploadThumbnail(prompt_id, file);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to upload thumbnail", e);
                return { status: "error", message: e.toString() };
            }
        },

        async toggleFavorite(prompt_id, category = null) {
            try {
                return await promptApi.toggleFavorite(prompt_id, category);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to toggle favorite", e);
                return { status: "error", message: e.toString() };
            }
        },

        async setFavoriteColor(prompt_id, color) {
            try {
                return await promptApi.setFavoriteColor(prompt_id, color);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to set favorite color", e);
                return { status: "error", message: e.toString() };
            }
        },

        async uploadWildcardFile(file) {
            try {
                return await promptApi.uploadWildcardFile(file);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to upload wildcard file", e);
                return { status: "error", message: e.toString() };
            }
        },

        async importWildcardFile(filename, category) {
            try {
                return await promptApi.importWildcardFile(filename, category);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to import wildcard file", e);
                return { status: "error", message: e.toString() };
            }
        },

        async exportWildcardCategory(category, filename = "", destination = "comfy") {
            try {
                return await promptApi.exportWildcardCategory(category, filename, destination);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to export wildcard category", e);
                return { status: "error", message: e.toString() };
            }
        },

        async deleteCategory(category) {
            try {
                return await promptApi.deleteCategory(category);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to delete category", e);
                return { status: "error", message: e.toString() };
            }
        },

        async renameCategory(oldCategory, newCategory) {
            try {
                return await promptApi.renameCategory(oldCategory, newCategory);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to rename category", e);
                return { status: "error", message: e.toString() };
            }
        },

        async getUiPrefs() {
            try {
                return await promptApi.getUiPrefs();
            } catch (e) {
                console.error("LocalPromptGallery: Failed to get UI prefs", e);
                return { ...DEFAULT_PROMPT_UI_PREFS };
            }
        },

        async saveUiPrefs(prefs, nodeInstance = null) {
            try {
                if (typeof nodeInstance?.persistPromptUiPrefs === "function") {
                    return await nodeInstance.persistPromptUiPrefs(prefs);
                }
                return await promptApi.saveUiPrefs(prefs);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to save UI prefs", e);
                return { status: "error", message: e.toString() };
            }
        },

        // ========== PRESET API ==========
        async getPresets() {
            try {
                return await promptApi.getPresets();
            } catch (e) {
                console.error("LocalPromptGallery: Failed to get presets", e);
                return [];
            }
        },

        async savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail = "off") {
            try {
                return await promptApi.savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to save preset", e);
                return { status: "error", message: e.toString() };
            }
        },

        async getOrCreatePrompts(prompts) {
            try {
                return await promptApi.getOrCreatePrompts(prompts);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to get or create prompts", e);
                return { status: "error", message: e.toString() };
            }
        },

        async loadPreset(name) {
            try {
                return await promptApi.loadPreset(name);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to load preset", e);
                return { status: "error", message: e.toString() };
            }
        },

        async deletePreset(name) {
            try {
                return await promptApi.deletePreset(name);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to delete preset", e);
                return { status: "error", message: e.toString() };
            }
        },

        async assignThumbnail(prompt_id, lastOutput) {
            try {
                return await promptApi.assignThumbnail(prompt_id, lastOutput);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to assign thumbnail", e);
                return { status: "error", message: e.toString() };
            }
        },

        async assignThumbnailsBatch(assignments) {
            try {
                return await promptApi.assignThumbnailsBatch(assignments);
            } catch (e) {
                console.error("LocalPromptGallery: Failed to batch assign thumbnails", e);
                return { status: "error", message: e.toString(), attached_count: 0, results: [] };
            }
        },

        isComfyIdle() {
            return !this.isExecuting && Number(this.queueRemaining || 0) <= 0;
        },

        reportOperationFeedback(state, message, options = {}) {
            this.instances.forEach(instance => {
                instance.operationFeedback?.[state]?.(message, options);
            });
        },

        /**
         * Free GPU/compositor work in the gallery UI while Comfy is sampling.
         * Continuous card border animations + backdrop blur + video decode share the
         * same GPU as the sampler on Windows and can tank it/s until a hard refresh.
         */
        setSamplingQuietMode(enabled) {
            const quiet = !!enabled;
            this.instances.forEach(instance => {
                const root = instance.__localPromptWidgetRoot;
                if (!root) return;
                root.classList.toggle("localprompt-sampling-quiet", quiet);
                if (quiet) {
                    root.querySelectorAll("video").forEach(video => {
                        try {
                            video.pause();
                        } catch {
                            // Ignore media control failures during teardown/generation.
                        }
                    });
                }
            });
        },

        cancelDeferredAutoAttachFlush() {
            if (this.deferredAutoAttachTimer != null) {
                clearTimeout(this.deferredAutoAttachTimer);
                this.deferredAutoAttachTimer = null;
            }
        },

        queueDeferredAutoAttach(promptIds, lastOutput) {
            if (!lastOutput?.filename || !Array.isArray(promptIds) || promptIds.length === 0) {
                return;
            }
            for (const promptId of promptIds) {
                const id = String(promptId || "").trim();
                if (!id) continue;
                // Latest image for a card wins if it was selected again later in the queue.
                this.deferredAutoAttachByPromptId.set(id, {
                    filename: lastOutput.filename,
                    subfolder: lastOutput.subfolder || "",
                    type: lastOutput.type || "output",
                });
            }
            // Never start a wall-clock timer while more jobs may still be running —
            // that was freezing sampling around step ~5 of the next prompt.
            this.tryScheduleDeferredAutoAttachFlush();
        },

        tryScheduleDeferredAutoAttachFlush() {
            if (this.deferredAutoAttachByPromptId.size === 0) {
                return;
            }
            if (!this.isComfyIdle()) {
                this.cancelDeferredAutoAttachFlush();
                return;
            }
            this.scheduleDeferredAutoAttachFlush(this.AUTO_ATTACH_IDLE_SETTLE_MS);
        },

        scheduleDeferredAutoAttachFlush(delayMs) {
            if (this.deferredAutoAttachByPromptId.size === 0) {
                return;
            }
            if (!this.isComfyIdle()) {
                this.cancelDeferredAutoAttachFlush();
                return;
            }
            if (this.deferredAutoAttachTimer != null) {
                clearTimeout(this.deferredAutoAttachTimer);
            }
            this.deferredAutoAttachTimer = setTimeout(() => {
                this.deferredAutoAttachTimer = null;
                void this.flushDeferredAutoAttach();
            }, Math.max(0, Number(delayMs) || this.AUTO_ATTACH_IDLE_SETTLE_MS));
        },

        async flushDeferredAutoAttach() {
            if (this.deferredAutoAttachFlushing) {
                // Another flush is in flight; retry only if still idle later.
                this.tryScheduleDeferredAutoAttachFlush();
                return;
            }
            if (this.deferredAutoAttachByPromptId.size === 0) {
                return;
            }
            // Hard gate: never rewrite ~30MB metadata while a prompt is generating.
            if (!this.isComfyIdle()) {
                this.cancelDeferredAutoAttachFlush();
                return;
            }

            this.deferredAutoAttachFlushing = true;
            this.cancelDeferredAutoAttachFlush();

            const assignments = [];
            for (const [promptId, lastOutput] of this.deferredAutoAttachByPromptId.entries()) {
                assignments.push({
                    prompt_id: promptId,
                    filename: lastOutput.filename,
                    subfolder: lastOutput.subfolder || "",
                    type: lastOutput.type || "output",
                });
            }
            this.deferredAutoAttachByPromptId.clear();

            try {
                // If a new job started between the settle timer and now, re-queue and abort.
                if (!this.isComfyIdle()) {
                    for (const item of assignments) {
                        this.deferredAutoAttachByPromptId.set(item.prompt_id, {
                            filename: item.filename,
                            subfolder: item.subfolder,
                            type: item.type,
                        });
                    }
                    return;
                }

                const result = await this.assignThumbnailsBatch(assignments);
                // Backend refused because a new job started — put items back and wait.
                if (result?.status === "busy") {
                    for (const item of assignments) {
                        this.deferredAutoAttachByPromptId.set(item.prompt_id, {
                            filename: item.filename,
                            subfolder: item.subfolder,
                            type: item.type,
                        });
                    }
                    return;
                }
                const attachedCount = Number(result?.attached_count) || 0;
                if (result?.status !== "ok") {
                    console.warn(
                        "LocalPromptGallery: Deferred auto-attach batch failed",
                        result?.message || "unknown error"
                    );
                    this.reportOperationFeedback("error", result?.message || "Automatic thumbnail attachment failed");
                } else if (Array.isArray(result?.results)) {
                    const failedItems = result.results.filter(item => item?.status && item.status !== "ok");
                    for (const item of result.results) {
                        if (item?.status && item.status !== "ok") {
                            console.warn(
                                `LocalPromptGallery: Could not auto-attach output to wildcard card ${item.prompt_id}`,
                                item.message || "unknown error"
                            );
                        }
                    }
                    if (failedItems.length > 0) {
                        this.reportOperationFeedback(
                            "warning",
                            `Attached ${attachedCount} thumbnails. ${failedItems.length} failed.`
                        );
                    } else if (attachedCount > 0) {
                        this.reportOperationFeedback("success", `Attached ${attachedCount} wildcard thumbnails`);
                    }
                }

                // Only refresh gallery UI when still idle so we don't thrash the browser mid-run.
                if (attachedCount > 0 && this.isComfyIdle()) {
                    await Promise.all([...this.instances].map(async (instance) => {
                        try {
                            await instance.__localGalleryRefresh?.();
                        } catch (error) {
                            console.warn("LocalPromptGallery: Failed to refresh after deferred auto-attach", error);
                        }
                    }));
                }
            } catch (error) {
                console.warn("LocalPromptGallery: Deferred auto-attach flush failed", error);
                this.reportOperationFeedback("error", error?.message || "Automatic thumbnail attachment failed");
            } finally {
                this.deferredAutoAttachFlushing = false;
                // If more items arrived while we were writing, schedule another pass only if idle.
                if (this.deferredAutoAttachByPromptId.size > 0) {
                    this.tryScheduleDeferredAutoAttachFlush();
                }
            }
        },
    };
}
