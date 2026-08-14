const FEEDBACK_STYLE_ID = "localgallery-operation-feedback-styles";

function ensureFeedbackStyles(documentRef) {
    if (!documentRef?.head || documentRef.getElementById(FEEDBACK_STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = FEEDBACK_STYLE_ID;
    style.textContent = `
        .localgallery-operation-feedback {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            max-width: min(260px, 42%);
            height: 26px;
            padding: 0 8px;
            box-sizing: border-box;
            border: 1px solid rgba(183, 204, 218, 0.20);
            border-radius: 7px;
            background: rgba(12, 18, 24, 0.56);
            color: rgba(225, 235, 241, 0.72);
            font-size: 10px;
            line-height: 1;
            flex: 0 1 auto;
            transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
        }
        .localgallery-operation-feedback[data-state="pending"] {
            border-color: rgba(104, 187, 235, 0.46);
            color: #d9f3ff;
            background: rgba(31, 76, 101, 0.42);
        }
        .localgallery-operation-feedback[data-state="success"] {
            border-color: rgba(104, 203, 143, 0.48);
            color: #ddffe9;
            background: rgba(28, 91, 54, 0.40);
        }
        .localgallery-operation-feedback[data-state="warning"] {
            border-color: rgba(231, 181, 84, 0.54);
            color: #fff0c9;
            background: rgba(104, 70, 18, 0.44);
        }
        .localgallery-operation-feedback[data-state="error"] {
            border-color: rgba(241, 106, 115, 0.62);
            color: #ffe4e7;
            background: rgba(111, 35, 43, 0.52);
        }
        .localgallery-operation-feedback-icon {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex: 0 0 auto;
            background: currentColor;
            opacity: 0.72;
        }
        .localgallery-operation-feedback[data-state="pending"] .localgallery-operation-feedback-icon {
            background: transparent;
            border: 1px solid currentColor;
            border-right-color: transparent;
            animation: localgallery-operation-feedback-spin 0.7s linear infinite;
        }
        .localgallery-operation-feedback-message {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .localgallery-operation-feedback-action {
            display: none;
            flex: 0 0 auto;
            padding: 2px 5px;
            border: 1px solid currentColor;
            border-radius: 5px;
            background: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
        }
        .localgallery-operation-feedback.has-action .localgallery-operation-feedback-action {
            display: inline-flex;
        }
        .localprompt-container-wrapper.auto-hide-toolbars
            .localprompt-bottom-bar.localgallery-operation-feedback-active
            > .localgallery-operation-feedback {
            position: absolute !important;
            right: 10px !important;
            bottom: 8px !important;
            z-index: 50;
            max-width: min(320px, calc(100% - 20px)) !important;
            opacity: 1 !important;
            transform: translateY(0) !important;
            pointer-events: auto !important;
        }
        @keyframes localgallery-operation-feedback-spin {
            to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
            .localgallery-operation-feedback,
            .localgallery-operation-feedback-icon {
                transition: none;
                animation: none !important;
            }
        }
    `;
    documentRef.head.appendChild(style);
}

function messageFromError(error, fallback) {
    return String(error?.message || error?.result?.message || fallback || "Action failed");
}

export function createOperationFeedback({
    host,
    before = null,
    readyMessage = "Ready",
    documentRef = globalThis.document,
    successDuration = 1800,
} = {}) {
    if (!host || !documentRef?.createElement) {
        throw new TypeError("Operation feedback requires a host element and document");
    }

    ensureFeedbackStyles(documentRef);
    const root = documentRef.createElement("div");
    root.className = "localgallery-operation-feedback";
    root.dataset.state = "ready";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");

    const icon = documentRef.createElement("span");
    icon.className = "localgallery-operation-feedback-icon";
    icon.setAttribute("aria-hidden", "true");
    const message = documentRef.createElement("span");
    message.className = "localgallery-operation-feedback-message";
    message.textContent = readyMessage;
    const action = documentRef.createElement("button");
    action.type = "button";
    action.className = "localgallery-operation-feedback-action";
    root.append(icon, message, action);

    if (before?.parentNode === host) host.insertBefore(root, before);
    else host.appendChild(root);

    let resetTimer = null;
    let actionHandler = null;
    let disposed = false;

    const clearTimer = () => {
        if (resetTimer !== null) clearTimeout(resetTimer);
        resetTimer = null;
    };

    const clearAction = () => {
        if (actionHandler) action.removeEventListener("click", actionHandler);
        actionHandler = null;
        action.textContent = "";
        root.classList.remove("has-action");
    };

    const set = (state, text, options = {}) => {
        if (disposed) return;
        clearTimer();
        clearAction();
        root.dataset.state = state;
        host.classList?.toggle("localgallery-operation-feedback-active", state !== "ready");
        root.setAttribute("aria-live", state === "error" ? "assertive" : "polite");
        message.textContent = String(text || readyMessage);
        root.title = String(options.details || text || readyMessage);

        if (typeof options.action === "function") {
            action.textContent = String(options.actionLabel || "Retry");
            actionHandler = async event => {
                event.preventDefault();
                try {
                    await options.action();
                } catch {
                    // Retried operations report their own failure state.
                }
            };
            action.addEventListener("click", actionHandler);
            root.classList.add("has-action");
        }

        const autoResetMs = Number(options.autoResetMs);
        if (Number.isFinite(autoResetMs) && autoResetMs > 0) {
            resetTimer = setTimeout(() => ready(), autoResetMs);
        }
    };

    const ready = (text = readyMessage) => set("ready", text);
    const pending = text => set("pending", text || "Working...");
    const success = (text, options = {}) => set("success", text || "Completed", {
        ...options,
        autoResetMs: options.autoResetMs ?? successDuration,
    });
    const warning = (text, options = {}) => set("warning", text || "Completed with warnings", options);
    const error = (text, options = {}) => set("error", text || "Action failed", options);

    const run = async (operation, {
        pendingMessage = "Working...",
        successMessage = "Completed",
        errorMessage = "Action failed",
        validate = result => !result || !result.status || result.status === "ok",
        retry = null,
    } = {}) => {
        pending(pendingMessage);
        try {
            const result = await operation();
            if (!validate(result)) {
                const operationError = new Error(result?.message || errorMessage);
                operationError.result = result;
                throw operationError;
            }
            success(typeof successMessage === "function" ? successMessage(result) : successMessage);
            return result;
        } catch (operationError) {
            const retryOperation = retry === true
                ? operation
                : (typeof retry === "function" ? retry : null);
            error(messageFromError(operationError, errorMessage), retryOperation ? {
                action: () => run(retryOperation, {
                    pendingMessage,
                    successMessage,
                    errorMessage,
                    validate,
                    retry: retryOperation,
                }),
                actionLabel: "Retry",
            } : {});
            throw operationError;
        }
    };

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        clearTimer();
        clearAction();
        host.classList?.remove("localgallery-operation-feedback-active");
        root.remove();
    };

    return { root, set, ready, pending, success, warning, error, run, dispose };
}
