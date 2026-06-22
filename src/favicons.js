import { state } from "./state.js";
import { clearFaviconStore, reportStorageError, saveFaviconRecord } from "./storage.js";

let callbacks = {
  render: () => {},
  renderSavesList: () => {},
  isSavesModalOpen: () => false,
};

export function configureFavicons(nextCallbacks) {
  callbacks = { ...callbacks, ...nextCallbacks };
}

export function faviconHostname(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function faviconApiSrc(url) {
  const host = faviconHostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "";
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function scheduleRenderAfterFaviconUpdate() {
  if (state.faviconRenderTimer) return;
  state.faviconRenderTimer = window.setTimeout(() => {
    state.faviconRenderTimer = 0;
    callbacks.render();
    if (callbacks.isSavesModalOpen()) callbacks.renderSavesList();
  }, 100);
}

export async function fetchAndCacheFavicon(url, { force = false, rerender = true } = {}) {
  const host = faviconHostname(url);
  if (!host) return null;
  if (!force && state.faviconCache.has(host)) return state.faviconCache.get(host);
  const inFlightKey = `${host}:${force ? "force" : "cache"}`;
  if (state.faviconFetches.has(inFlightKey)) return state.faviconFetches.get(inFlightKey);

  const task = (async () => {
    const sourceUrl = faviconApiSrc(url);
    const response = await fetch(sourceUrl, {
      credentials: "omit",
      cache: force ? "reload" : "default",
    });
    if (!response.ok) throw new Error(`Favicon fetch failed for ${host}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error(`Favicon response was not an image for ${host}`);
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl.startsWith("data:image/")) throw new Error(`Favicon response could not be cached for ${host}`);
    const record = {
      hostname: host,
      dataUrl,
      sourceUrl,
      updatedAt: new Date().toISOString(),
    };
    state.faviconCache.set(host, record);
    await saveFaviconRecord(record);
    if (rerender) scheduleRenderAfterFaviconUpdate();
    return record;
  })();

  state.faviconFetches.set(inFlightKey, task);
  task.finally(() => state.faviconFetches.delete(inFlightKey)).catch(() => {});
  return task;
}

export function cachedFaviconSrc(url) {
  const record = state.faviconCache.get(faviconHostname(url));
  return record?.dataUrl || "";
}

export function faviconSrc(url) {
  return cachedFaviconSrc(url) || null;
}

export function linkIconSrc(link) {
  if (link?.customIcon) return link.customIcon;
  return faviconSrc(link?.url);
}

export function savedLinkFaviconSrc(url) {
  return cachedFaviconSrc(url) || "";
}

export function queueFaviconCache(url) {
  if (state.faviconRefreshInProgress || !faviconHostname(url) || cachedFaviconSrc(url)) return;
  void fetchAndCacheFavicon(url).catch(reportStorageError);
}

export function collectBookmarkFaviconUrls(items = state.data.items, urls = new Map(), linkHasCustomIcon) {
  for (const item of items) {
    if (item.type === "folder") {
      collectBookmarkFaviconUrls(item.children || [], urls, linkHasCustomIcon);
    } else if (item.type === "link" && !linkHasCustomIcon(item)) {
      const host = faviconHostname(item.url);
      if (host) urls.set(host, item.url);
    }
  }
  return urls;
}

export function collectFaviconUrls(linkHasCustomIcon) {
  const urls = new Map();
  collectBookmarkFaviconUrls(state.data.items, urls, linkHasCustomIcon);
  for (const save of state.data.saves || []) {
    const host = faviconHostname(save.url);
    if (host) urls.set(host, save.url);
  }
  return [...urls.values()];
}

export async function warmMissingFaviconCache(linkHasCustomIcon) {
  if (state.faviconRefreshInProgress) return;
  const urls = collectFaviconUrls(linkHasCustomIcon).filter((url) => !cachedFaviconSrc(url));
  if (urls.length === 0) return;
  for (const url of urls) {
    if (state.faviconRefreshInProgress) return;
    try {
      await fetchAndCacheFavicon(url, { rerender: false });
    } catch (error) {
      console.warn("Could not cache favicon", url, error);
    }
  }
  scheduleRenderAfterFaviconUpdate();
}

export async function resetFaviconCache() {
  state.faviconCache = new Map();
  await clearFaviconStore();
}
