export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function normaliseUrl(url) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function isHttpUrlHostPlausible(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  if (h === "localhost") return true;
  if (h.includes(".")) return true;
  if (h.includes(":")) return true;
  return false;
}

export function urlFromClipboardText(text) {
  const raw = String(text).trim();
  if (!raw || /\s/.test(raw)) return null;
  const u = normaliseUrl(raw);
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!isHttpUrlHostPlausible(parsed.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatTimeAgo(savedAt) {
  const saved = Date.parse(savedAt);
  if (!Number.isFinite(saved)) return "";
  const diffMs = Date.now() - saved;
  if (diffMs < 15000) return "Just now";
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (years > 0) return `${years} year${years === 1 ? "" : "s"} ago`;
  if (months > 0) return `${months} month${months === 1 ? "" : "s"} ago`;
  if (weeks > 0) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
}

export function titleFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() || "";
}

export async function fetchPageTitle(url) {
  const response = await fetch(url, { method: "GET", credentials: "omit" });
  if (!response.ok) return "";
  return titleFromHtml(await response.text());
}

export async function fetchSavedLinkMetadata(url) {
  let title = "";
  try {
    title = await fetchPageTitle(url);
  } catch {
    title = "";
  }
  return {
    title: title || hostname(url),
    faviconUrl: "",
  };
}
