export function updateClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  document.getElementById("today-date").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
  el.textContent = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function startClock() {
  updateClock();
  const now = new Date();
  const msUntilNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(() => {
    updateClock();
    setInterval(updateClock, 60000);
  }, msUntilNextMinute);
}
