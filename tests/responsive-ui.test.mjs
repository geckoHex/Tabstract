import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { initBookmarks } from "../src/bookmarks.js";
import { initSettings } from "../src/settings.js";

// Check event wiring without a browser or a layout engine.
test("responsive settings and menus follow viewport and scroll changes", (t) => {
  function control() {
    return Object.assign(new EventTarget(), {
      attributes: new Map(),
      setAttribute(name, value) { this.attributes.set(name, value); },
      querySelectorAll: () => [],
      contains: () => false,
    });
  }

  const html = readFileSync(new URL("../newtab.html", import.meta.url), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, control()]));
  const sidebar = control();
  const tabs = control();
  const media = Object.assign(new EventTarget(), { matches: false });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  });
  globalThis.document = Object.assign(control(), {
    getElementById(id) {
      assert.ok(elements.has(id), `Missing HTML control: ${id}`);
      return elements.get(id);
    },
    querySelector(selector) {
      assert.ok(html.includes(`class="${selector.slice(1)}"`), `Missing HTML selector: ${selector}`);
      return { ".left-inner": sidebar, ".settings-sidebar": tabs }[selector];
    },
  });
  globalThis.window = Object.assign(new EventTarget(), {
    matchMedia(query) {
      assert.equal(query, "(max-width: 760px)");
      return media;
    },
  });

  initSettings({});
  assert.equal(tabs.attributes.get("aria-orientation"), "vertical");
  media.matches = true;
  media.dispatchEvent(new Event("change"));
  assert.equal(tabs.attributes.get("aria-orientation"), "horizontal");
  media.matches = false;
  media.dispatchEvent(new Event("change"));
  assert.equal(tabs.attributes.get("aria-orientation"), "vertical");

  initBookmarks({});
  const itemMenu = elements.get("item-context-menu");
  const gridMenu = elements.get("grid-context-menu");
  for (const [target, event] of [
    [sidebar, "scroll"],
    [elements.get("grid-scroll"), "scroll"],
    [window, "scroll"],
    [window, "resize"],
  ]) {
    itemMenu.hidden = gridMenu.hidden = false;
    target.dispatchEvent(new Event(event));
    assert.equal(itemMenu.hidden, true, `${event} must dismiss the item menu`);
    assert.equal(gridMenu.hidden, true, `${event} must dismiss the grid menu`);
  }
});
