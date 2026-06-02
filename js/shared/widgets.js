export function collapseWidget(widget) {
    if (!widget) return widget;
    widget.computeSize = () => [0, -4];
    widget.draw = function() {};
    return widget;
}

export function hideWidget(widget) {
    if (!widget) return widget;
    widget.type = "hidden";
    return collapseWidget(widget);
}

export function setDomWidgetVisible(widget, visible, { minHeight = 260, maxHeight = 100000 } = {}) {
    if (!widget) return;
    delete widget.computeSize;
    widget.type = visible ? "div" : "hidden";
    widget.options.getMinHeight = () => visible ? minHeight : 0;
    widget.options.getMaxHeight = () => visible ? maxHeight : 0;
    if (widget.element) {
        widget.element.style.display = visible ? "" : "none";
        widget.element.style.height = visible ? "100%" : "0";
        widget.element.style.maxHeight = visible ? "none" : "0";
        widget.element.style.overflow = "hidden";
        widget.element.style.pointerEvents = visible ? "auto" : "none";
    }
}
