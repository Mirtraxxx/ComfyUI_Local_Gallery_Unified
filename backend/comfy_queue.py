"""Queue state shared by the gallery backends."""

import server

def comfy_queue_busy():
    """True when Comfy has a running job or pending queue items."""
    try:
        prompt_queue = getattr(server.PromptServer.instance, "prompt_queue", None)
        if prompt_queue is None:
            return False
        # Prefer the cheap volatile read — get_current_queue() deep-copies the
        # full queue and is marked slow in ComfyUI itself.
        getter = getattr(prompt_queue, "get_current_queue_volatile", None)
        if callable(getter):
            running, pending = getter()
        else:
            running, pending = prompt_queue.get_current_queue()
        return bool(running) or bool(pending)
    except Exception:
        return False
