import { OPENAI_CHAT_ENDPOINT, OPENAI_CHAT_MODEL } from "./constants.js";

export function initTools(ctx) {
  initPowerSearch(ctx);
  initAiChat(ctx);
  initCalculator(ctx);
}

function initPowerSearch(ctx) {
  const powerSearchTool = document.getElementById("power-search-tool");
  const powerSearchModal = document.getElementById("power-search-modal");
  const powerSearchForm = document.getElementById("power-search-form");
  const powerSearchInput = document.getElementById("power-search-input");
  const powerSearchModeInputs = Array.from(document.querySelectorAll('input[name="power-search-mode"]'));

  function openPowerSearchModal() {
    powerSearchInput.value = "";
    powerSearchModeInputs.forEach((input) => {
      input.checked = false;
    });
    powerSearchModal.hidden = false;
    setTimeout(() => powerSearchInput.focus(), 0);
  }

  function closePowerSearchModal() {
    powerSearchModal.hidden = true;
    powerSearchInput.value = "";
    powerSearchModeInputs.forEach((input) => {
      input.checked = false;
    });
  }

  function getPowerSearchUrl(query, mode) {
    const encodedQuery = encodeURIComponent(query);
    const imageParams = new URLSearchParams({ tbm: "isch", q: query });
    switch (mode) {
      case "transparent-images":
        imageParams.set("tbs", "ic:trans");
        return `https://www.google.com/search?${imageParams.toString()}`;
      case "large-images":
        imageParams.set("tbs", "isz:l");
        return `https://www.google.com/search?${imageParams.toString()}`;
      case "recent":
        return `https://www.google.com/search?q=${encodedQuery}&tbs=qdr:d`;
      case "web-only":
        return `https://www.google.com/search?q=${encodedQuery}&udm=14`;
      case "pdf-only":
        return `https://www.google.com/search?q=${encodeURIComponent(`${query} filetype:pdf`)}`;
      default:
        return `https://www.google.com/search?q=${encodedQuery}`;
    }
  }

  function submitPowerSearch() {
    const q = powerSearchInput.value.trim();
    if (!q) {
      powerSearchInput.focus();
      return;
    }
    const selectedMode = powerSearchModeInputs.find((input) => input.checked)?.value;
    window.location.href = getPowerSearchUrl(q, selectedMode);
  }

  powerSearchModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      powerSearchModeInputs.forEach((otherInput) => {
        if (otherInput !== input) otherInput.checked = false;
      });
    });
  });
  powerSearchTool.addEventListener("click", openPowerSearchModal);
  document.getElementById("power-search-modal-close").addEventListener("click", closePowerSearchModal);
  document.getElementById("power-search-cancel").addEventListener("click", closePowerSearchModal);
  powerSearchModal.addEventListener("click", (e) => {
    if (e.target === powerSearchModal) closePowerSearchModal();
  });
  powerSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitPowerSearch();
  });

  Object.assign(ctx, { closePowerSearchModal, isPowerSearchModalOpen: () => !powerSearchModal.hidden });
}

function initAiChat(ctx) {
  const aiChatTool = document.getElementById("ai-chat-tool");
  const aiChatModal = document.getElementById("ai-chat-modal");
  const aiChatForm = document.getElementById("ai-chat-form");
  const aiChatInput = document.getElementById("ai-chat-input");
  const aiChatMessagesEl = document.getElementById("ai-chat-messages");
  const aiChatStatus = document.getElementById("ai-chat-status");
  const aiChatSendBtn = document.getElementById("ai-chat-send");
  const aiChatMessages = [];
  let aiChatPending = false;
  let aiChatAbortController = null;
  let aiChatStreamingBubble = null;

  function setAiChatStatus(message) {
    if (aiChatStatus) aiChatStatus.textContent = message;
  }

  function renderAiChatMessages() {
    aiChatMessagesEl.replaceChildren();
    if (!aiChatMessages.length) {
      const empty = document.createElement("div");
      empty.className = "ai-chat-empty";
      empty.textContent = "Start a conversation.";
      aiChatMessagesEl.appendChild(empty);
      return;
    }
    for (const message of aiChatMessages) {
      const bubble = document.createElement("div");
      bubble.className = `ai-chat-message ai-chat-message--${message.role === "user" ? "user" : "assistant"}`;
      bubble.textContent = message.content;
      aiChatMessagesEl.appendChild(bubble);
    }
    aiChatMessagesEl.scrollTop = aiChatMessagesEl.scrollHeight;
  }

  function appendAiChatStreamingBubble() {
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-message ai-chat-message--assistant ai-chat-message--streaming";
    aiChatMessagesEl.appendChild(bubble);
    aiChatMessagesEl.scrollTop = aiChatMessagesEl.scrollHeight;
    return bubble;
  }

  function updateAiChatStreamingBubble(content) {
    if (!aiChatStreamingBubble) return;
    aiChatStreamingBubble.textContent = content;
    aiChatMessagesEl.scrollTop = aiChatMessagesEl.scrollHeight;
  }

  function removeAiChatStreamingBubble() {
    if (aiChatStreamingBubble) {
      aiChatStreamingBubble.remove();
      aiChatStreamingBubble = null;
    }
  }

  function openAiChatModal() {
    renderAiChatMessages();
    setAiChatStatus(ctx.getStoredOpenaiApiKey() ? "" : "Add an OpenAI API key in Settings > Configs.");
    aiChatModal.hidden = false;
    setTimeout(() => aiChatInput.focus(), 0);
  }

  function closeAiChatModal() {
    if (aiChatAbortController) aiChatAbortController.abort();
    aiChatModal.hidden = true;
    setAiChatStatus("");
  }

  function setAiChatPending(pending) {
    aiChatPending = pending;
    aiChatSendBtn.disabled = pending;
    aiChatInput.disabled = pending;
  }

  async function sendAiChatMessage() {
    if (aiChatPending) return;
    const prompt = aiChatInput.value.trim();
    if (!prompt) {
      aiChatInput.focus();
      return;
    }
    const apiKey = ctx.getStoredOpenaiApiKey().trim();
    if (!apiKey) {
      setAiChatStatus("Add an OpenAI API key in Settings > Configs.");
      aiChatInput.focus();
      return;
    }
    aiChatInput.value = "";
    aiChatMessages.push({ role: "user", content: prompt });
    renderAiChatMessages();
    setAiChatPending(true);
    setAiChatStatus("");
    aiChatAbortController = new AbortController();

    try {
      const response = await fetch(OPENAI_CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages: aiChatMessages.map(({ role, content }) => ({ role, content })),
          stream: true,
        }),
        signal: aiChatAbortController.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}.`);
      }
      if (!response.body) throw new Error("OpenAI returned an empty response.");
      aiChatStreamingBubble = appendAiChatStreamingBubble();
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              fullContent += delta;
              updateAiChatStreamingBubble(fullContent);
            }
          } catch {
            // Ignore malformed streaming chunks.
          }
        }
      }
      fullContent += readFinalStreamDelta(buffer);
      if (!fullContent) throw new Error("OpenAI returned an empty response.");
      aiChatMessages.push({ role: "assistant", content: fullContent });
      removeAiChatStreamingBubble();
      renderAiChatMessages();
      setAiChatStatus("");
    } catch (error) {
      if (error.name === "AbortError") setAiChatStatus("Stopped.");
      else {
        console.error("OpenAI chat failed", error);
        setAiChatStatus(error instanceof Error ? error.message : "OpenAI request failed.");
      }
      removeAiChatStreamingBubble();
    } finally {
      aiChatAbortController = null;
      setAiChatPending(false);
      aiChatInput.focus();
    }
  }

  aiChatTool.addEventListener("click", openAiChatModal);
  document.getElementById("ai-chat-modal-close").addEventListener("click", closeAiChatModal);
  aiChatModal.addEventListener("click", (e) => { if (e.target === aiChatModal) closeAiChatModal(); });
  aiChatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void sendAiChatMessage();
  });
  aiChatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendAiChatMessage();
    }
  });
  Object.assign(ctx, { closeAiChatModal, isAiChatModalOpen: () => !aiChatModal.hidden });
}

function readFinalStreamDelta(buffer) {
  const trimmed = buffer.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) return "";
  const data = trimmed.slice(6);
  if (data === "[DONE]") return "";
  try {
    return JSON.parse(data)?.choices?.[0]?.delta?.content || "";
  } catch {
    return "";
  }
}

function initCalculator(ctx) {
  const calculatorTool = document.getElementById("calculator-tool");
  const calculatorModal = document.getElementById("calculator-modal");
  const calculatorDisplay = document.getElementById("calculator-display");
  const calculatorKeys = document.getElementById("calculator-keys");
  let calcCurrent = "0";
  let calcPrevious = "";
  let calcOperator = null;
  let calcResetNext = false;

  function updateCalculatorDisplay() {
    if (calculatorDisplay) calculatorDisplay.textContent = calcCurrent;
  }
  function clearCalculator() {
    calcCurrent = "0";
    calcPrevious = "";
    calcOperator = null;
    calcResetNext = false;
    updateCalculatorDisplay();
  }
  function deleteCalculatorDigit() {
    if (calcResetNext) {
      calcCurrent = "0";
      calcResetNext = false;
    } else if (calcCurrent.length > 1) calcCurrent = calcCurrent.slice(0, -1);
    else calcCurrent = "0";
    updateCalculatorDisplay();
  }
  function appendCalculatorDigit(digit) {
    if (calcResetNext) {
      calcCurrent = "";
      calcResetNext = false;
    }
    if (calcCurrent === "0" && digit !== ".") calcCurrent = digit;
    else if (digit === ".") {
      if (!calcCurrent.includes(".")) calcCurrent += ".";
    } else calcCurrent += digit;
    updateCalculatorDisplay();
  }
  function setCalculatorOperator(op) {
    if (calcOperator && !calcResetNext) calculateCalculatorResult();
    calcPrevious = calcCurrent;
    calcOperator = op;
    calcResetNext = true;
  }
  function calculateCalculatorResult() {
    if (!calcOperator || !calcPrevious) return;
    const prev = parseFloat(calcPrevious);
    const curr = parseFloat(calcCurrent);
    if (Number.isNaN(prev) || Number.isNaN(curr)) return;
    const operations = {
      "+": prev + curr,
      "-": prev - curr,
      "*": prev * curr,
      "/": curr === 0 ? NaN : prev / curr,
    };
    const result = operations[calcOperator];
    calcCurrent = Number.isNaN(result) || !Number.isFinite(result)
      ? "Error"
      : String(result).length > 14 ? String(parseFloat(result.toPrecision(12))) : String(result);
    calcOperator = null;
    calcPrevious = "";
    calcResetNext = true;
    updateCalculatorDisplay();
  }
  const openCalculatorModal = () => { if (calculatorModal) calculatorModal.hidden = false; };
  const closeCalculatorModal = () => { if (calculatorModal) calculatorModal.hidden = true; };

  calculatorTool.addEventListener("click", openCalculatorModal);
  document.getElementById("calculator-modal-close").addEventListener("click", closeCalculatorModal);
  calculatorModal.addEventListener("click", (e) => { if (e.target === calculatorModal) closeCalculatorModal(); });
  calculatorKeys.addEventListener("click", (e) => {
    const key = e.target.closest(".calculator-key");
    if (!key) return;
    const action = key.dataset.action;
    if (action === "number") appendCalculatorDigit(key.dataset.value);
    else if (action === "decimal") appendCalculatorDigit(".");
    else if (action === "operator") setCalculatorOperator(key.dataset.value);
    else if (action === "calculate") calculateCalculatorResult();
    else if (action === "clear") clearCalculator();
    else if (action === "delete") deleteCalculatorDigit();
  });
  calculatorModal.addEventListener("keydown", (e) => {
    if (!calculatorModal.hidden && e.key === "Escape") {
      closeCalculatorModal();
      return;
    }
    if (calculatorModal.hidden) return;
    const key = e.key;
    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      appendCalculatorDigit(key);
    } else if (key === ".") {
      e.preventDefault();
      appendCalculatorDigit(".");
    } else if (["+", "-", "*", "/"].includes(key)) {
      e.preventDefault();
      setCalculatorOperator(key);
    } else if (key === "Enter" || key === "=") {
      e.preventDefault();
      calculateCalculatorResult();
    } else if (key === "Backspace") {
      e.preventDefault();
      deleteCalculatorDigit();
    } else if (key === "Escape" || key === "c" || key === "C") {
      e.preventDefault();
      clearCalculator();
    }
  });
  Object.assign(ctx, { closeCalculatorModal, isCalculatorModalOpen: () => !calculatorModal.hidden });
}
