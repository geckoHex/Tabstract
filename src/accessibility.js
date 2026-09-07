// Keep keyboard focus inside the foremost dialog and restore it on dismissal.
export function initAccessibility(ctx) {
  const overlays = [...document.querySelectorAll(".modal-overlay")];
  const stack = [];
  const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
  const controls = (overlay) => [...overlay.querySelectorAll(focusable)]
    .filter((el) => !el.closest('[hidden], [inert]') && el.getClientRects().length);

  for (const overlay of overlays) {
    const dialog = overlay.querySelector(".modal");
    const title = dialog.querySelector("h3");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    if (title) {
      title.id ||= `${overlay.id}-heading`;
      dialog.setAttribute("aria-labelledby", title.id);
    }
    new MutationObserver(() => {
      const index = stack.findIndex((entry) => entry.overlay === overlay);
      if (!overlay.hidden && index < 0) {
        stack.push({ overlay, previous: document.activeElement });
        if (!overlay.contains(document.activeElement)) {
          (controls(overlay).find((el) => el.matches("input, textarea")) || controls(overlay)[0] || dialog).focus();
        }
      } else if (overlay.hidden && index >= 0) {
        const [entry] = stack.splice(index, 1);
        if (index === stack.length && entry.previous?.isConnected && !entry.previous.closest("[hidden]")) entry.previous.focus();
      }
    }).observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }

  document.addEventListener("keydown", (event) => {
    const current = stack.at(-1)?.overlay;
    if (event.key === "Tab" && current) {
      const items = controls(current);
      const first = items[0] || current.querySelector(".modal");
      const last = items.at(-1) || first;
      if (!current.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last) || !items.length) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !current) {
      event.preventDefault();
      ctx.focusBookmarkSearch();
    }
  });
}
