// Gallery CSS is shared by every node instance, so it is added to the document once.
export function ensureStyleSheet(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}
