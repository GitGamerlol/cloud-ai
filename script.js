(() => {
"use strict";

/* =========================================================
   CLOUDAI 3.0
   Frontend controller
   ========================================================= */

const API = "https://cloudai-backend.makarmoiseenko979.workers.dev";

const $ = id => document.getElementById(id);

const state = {
  password: "",
  connected: false,
  conversationId: null,
  conversations: [],
  messages: [],
  resources: [],
  image: null,
  selectedChats: new Set(),
  contextChat: null,
  streaming: false,
  currentModel: "auto",
  personality: "default",
  theme: "dark",
  sounds: true,
  speech: false,
  speechRate: 1,
  recognition: null,
  studioFiles: {},
  studioCurrent: null,
  popup: null,
  firstMessageSent: false,
  currentAssistantMessage: null,
  autoRead: false
};

const RESOURCE_OPEN = "\n\n⟦CLOUDAI_RESOURCES_V1⟧\n";
const RESOURCE_CLOSE = "\n⟦/CLOUDAI_RESOURCES_V1⟧";

const PERSONALITIES = {
  default:
    "Be a helpful, clear, capable general-purpose AI assistant.",

  tutor:
    "Act as an excellent tutor. Explain concepts progressively, use examples and analogies, check understanding, and teach rather than merely giving answers.",

  engineer:
    "Act as a practical software and systems engineer. Think about architecture, reliability, performance, tradeoffs, and implementation details.",

  coder:
    "Act as an expert programming assistant. Provide correct, complete, readable code, explain important decisions, identify bugs, and avoid unnecessary complexity.",

  writer:
    "Act as a professional writer and editor. Use polished prose, strong structure, appropriate tone, and excellent formatting.",

  researcher:
    "Act as a careful researcher. Distinguish facts from assumptions, explain uncertainty, compare evidence, and organize findings."
};

const FORMAT_INSTRUCTIONS = `
CLOUDAI FORMATTING CAPABILITIES:

Use normal Markdown for headings, paragraphs, bold, italics, lists,
numbered lists, links, tables, blockquotes, and fenced code blocks.

You may also use these special CloudAI display commands:

[[color=#HEXCOLOR]]colored text[[/color]]
[[size=24]]larger text[[/size]]

[[callout=info]]
Information message.
[[/callout]]

Supported callout types: info, success, warning, error.

For interactive forms, use:

[[form]]
{
  "title": "A few questions",
  "description": "Please fill these out.",
  "fields": [
    {"name":"language","label":"Preferred language","type":"text","required":true},
    {"name":"experience","label":"Experience","type":"select","options":["Beginner","Intermediate","Advanced"]},
    {"name":"details","label":"Additional details","type":"textarea"}
  ],
  "submitLabel":"Submit"
}
[[/form]]

Only use forms when user input is genuinely needed.
Do not generate HTML or JavaScript for these display commands.
Do not put unnecessary plus or minus signs before ordinary paragraphs.
Use readable headings, whitespace, and properly fenced code.
`;

const ICON = {
  assistant: `
    <svg viewBox="0 0 32 32">
      <path d="M5 10.5 16 4l11 6.5v11L16 28 5 21.5z"/>
      <path d="m5 10.5 11 6.5 11-6.5M16 17v11"/>
      <path d="m10 7.5 11 6.5v7"/>
    </svg>`
};

/* =========================================================
   GENERAL UTILITIES
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uid() {
  return "c_" + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 2600);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function scrollBottom() {
  const el = $("chatScroll");
  el.scrollTop = el.scrollHeight;
}

function setConnected(value) {
  state.connected = value;

  $("connectionStatus").textContent =
    value ? "Connected" : "Disconnected";

  $("profileStatus").textContent =
    value ? "Online" : "Offline";

  const dot = document.querySelector(".status-dot");
  dot.style.background = value ? "#42d6a4" : "#ff718b";
}

/* =========================================================
   SOUND EFFECTS
   ========================================================= */

let audioContext = null;

function sound(type = "click") {
  if (!state.sounds) return;

  try {
    audioContext ||= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const now = audioContext.currentTime;

    const settings = {
      click: [660, 0.035, 0.018],
      send: [520, 0.075, 0.025],
      receive: [740, 0.055, 0.012],
      thinking: [440, 0.045, 0.009],
      success: [880, 0.11, 0.025],
      error: [180, 0.13, 0.025]
    };

    const [frequency, duration, volume] =
      settings[type] || settings.click;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + duration
    );

    oscillator.start(now);
    oscillator.stop(now + duration);

  } catch(e) {
    // Audio is optional.
  }
}

let thinkingSoundTimer = null;

function startThinkingSound() {
  stopThinkingSound();

  sound("thinking");

  thinkingSoundTimer = setInterval(() => {
    sound("thinking");
  }, 4300);
}

function stopThinkingSound() {
  clearInterval(thinkingSoundTimer);
  thinkingSoundTimer = null;
}

/* =========================================================
   PASSWORD AND AUTHENTICATION
   ========================================================= */

function getPassword() {
  try {
    return sessionStorage.getItem("cloudai_password") || "";
  } catch(e) {
    return "";
  }
}

function setPassword(password) {
  state.password = password;

  try {
    sessionStorage.setItem("cloudai_password", password);
  } catch(e) {}

  document.documentElement.classList.add("has-session");
  $("authScreen").style.display = "none";
}

function clearPassword() {
  state.password = "";
  state.connected = false;

  try {
    sessionStorage.removeItem("cloudai_password");
  } catch(e) {}

  document.documentElement.classList.remove("has-session");
  $("authScreen").style.display = "flex";
  $("passwordInput").value = "";
  $("authError").textContent = "";

  setConnected(false);
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: "Bearer " + state.password
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(API + path, {
      ...options,
      headers
    });
  } catch(error) {
    throw new Error(
      "Unable to reach CloudAI's server. Check your connection."
    );
  }

  if (response.status === 401) {
    clearPassword();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (response.status === 413) {
    throw new Error("The request is too large for the server.");
  }

  if (response.status === 429) {
    throw new Error(
      "Rate limit reached. Wait a little before trying again."
    );
  }

  return response;
}

async function connect() {
  const response = await fetch(API + "/health");

  if (!response.ok) {
    throw new Error("CloudAI backend is unavailable.");
  }

  const health = await response.json();

  if (health.status !== "online") {
    throw new Error("CloudAI backend is not online.");
  }

  const authResponse = await api("/models");

  if (!authResponse.ok) {
    throw new Error("Authentication failed.");
  }

  const models = await authResponse.json();

  state.models = models.models || [];

  setConnected(true);

  await loadConversations();

  return true;
}

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  sound("click");

  const password = $("passwordInput").value.trim();

  if (!password) {
    $("authError").textContent = "Enter your workspace password.";
    return;
  }

  $("authError").textContent = "Connecting…";

  state.password = password;

  try {
    await connect();
    setPassword(password);

    toast("Connected to CloudAI.");
    sound("success");

    await maybeLaunchPopup();

  } catch(error) {
    $("authError").textContent = error.message;
    state.password = "";
    sound("error");
  }
});

$("togglePassword").addEventListener("click", () => {
  const input = $("passwordInput");
  const visible = input.type === "text";

  input.type = visible ? "password" : "text";
  $("togglePassword").textContent =
    visible ? "Show" : "Hide";
});

$("lockButton").addEventListener("click", clearPassword);

$("forgetPassword").addEventListener("click", () => {
  clearPassword();
  closeModal("settingsModal");
  toast("Session locked.");
});

/* =========================================================
   ABOUT:BLANK LAUNCHER
   ========================================================= */

function installPopupCover() {
  if (document.getElementById("popupCover")) return;

  const cover = document.createElement("div");
  cover.className = "popup-cover";
  cover.id = "popupCover";

  cover.innerHTML = `
    <div class="logo">${ICON.assistant}</div>
    <h2>CloudAI is running in another tab.</h2>
    <p>You can safely close this tab.</p>
    <button id="reopenCloudAI">Reopen CloudAI here</button>
  `;

  document.body.appendChild(cover);

  $("reopenCloudAI").addEventListener("click", () => {
    cover.remove();
  });
}

function openPopup() {
  let popup;

  try {
    popup = window.open("about:blank", "_blank");
  } catch(e) {
    return false;
  }

  if (!popup) return false;

  try {
    popup.name = "cloudai-popup";

    const html =
      "<!DOCTYPE html>\n" +
      document.documentElement.outerHTML;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    state.popup = popup;

    return true;

  } catch(error) {
    popup.close();
    return false;
  }
}

async function maybeLaunchPopup() {
  // Avoid recursive popup creation in the new tab.
  if (window.name === "cloudai-popup") return;

  if (!state.password) return;

  // Browsers often block popups without a direct user gesture.
  // We attempt the launch, but preserve the current working tab
  // when the browser refuses.
  const opened = openPopup();

  if (opened) {
    installPopupCover();
  } else {
    toast("CloudAI is ready. Use Open in new tab if needed.");

    if (!$("openPopupButton")) {
      const button = document.createElement("button");
      button.id = "openPopupButton";
      button.className = "btn";
      button.textContent = "Open in new tab";
      button.style.position = "fixed";
      button.style.right = "15px";
      button.style.bottom = "15px";
      button.style.zIndex = "20";

      button.addEventListener("click", () => {
        if (openPopup()) {
          installPopupCover();
        } else {
          toast("Your browser blocked the popup.");
        }
      });

      document.body.appendChild(button);
    }
  }
}

/* =========================================================
   THEME SYSTEM
   ========================================================= */

const THEMES = [
  "dark",
  "midnight",
  "dracula",
  "sakura",
  "walnut",
  "forest",
  "light"
];

function setTheme(theme) {
  if (!THEMES.includes(theme)) return;

  state.theme = theme;

  document.documentElement.dataset.theme = theme;

  document.querySelectorAll("[data-theme-choice]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.themeChoice === theme
      );
    });

  try {
    localStorage.setItem("cloudai_theme", theme);
  } catch(e) {}
}

function cycleTheme() {
  const index = THEMES.indexOf(state.theme);
  setTheme(THEMES[(index + 1) % THEMES.length]);
  sound("click");
}

try {
  const savedTheme = localStorage.getItem("cloudai_theme");
  if (savedTheme) setTheme(savedTheme);
} catch(e) {}

document.querySelectorAll("[data-theme-choice]")
  .forEach(button => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.themeChoice);
      sound("click");
    });
  });

$("themeQuick").addEventListener("click", cycleTheme);

/* =========================================================
   SETTINGS AND MODALS
   ========================================================= */

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) {
      backdrop.classList.remove("show");
    }
  });
});

$("openSettings").addEventListener("click", () => {
  openModal("settingsModal");
});

$("settingsQuick").addEventListener("click", () => {
  openModal("settingsModal");
});

$("soundSwitch").addEventListener("click", () => {
  state.sounds = !state.sounds;

  $("soundSwitch").textContent =
    state.sounds ? "Sounds enabled" : "Sounds disabled";

  sound("click");
});

$("tabTitle").addEventListener("change", () => {
  document.title = $("tabTitle").value.trim() || "CloudAI";
});

$("tabIcon").addEventListener("change", () => {
  const value = $("tabIcon").value.trim();

  let link = document.querySelector("link[rel~='icon']");

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.href = value || createDefaultIcon();
});

function createDefaultIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill="#68b9c9"/>
      <path
        d="M5 10.5 16 4l11 6.5v11L16 28 5 21.5z"
        fill="none"
        stroke="white"
        stroke-width="2"
      />
      <path
        d="M16 17v11M5 10.5l11 6.5 11-6.5"
        fill="none"
        stroke="white"
        stroke-width="2"
      />
    </svg>`;

  return "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(svg);
}

function setFavicon(url = "") {
  const value = String(url || "").trim();

  let link = document.querySelector(
    'link[data-cloudai-favicon="true"]'
  );

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.dataset.cloudaiFavicon = "true";
    document.head.appendChild(link);
  }

  if (!value) {
    link.type = "image/svg+xml";
    link.href = createDefaultIcon();
    return;
  }

  if (
    !/^https?:\/\//i.test(value) &&
    !/^data:image\//i.test(value)
  ) {
    toast("Use a direct image URL (PNG, ICO, SVG, or WEBP).");
    link.href = createDefaultIcon();
    return;
  }

  link.href = value;
}

function applyTabSettings() {
  let savedTitle = "CloudAI";
  let savedIcon = "";

  try {
    savedTitle =
      localStorage.getItem("cloudai_tab_title") || "CloudAI";

    savedIcon =
      localStorage.getItem("cloudai_tab_icon") || "";

  } catch(error) {}

  document.title = savedTitle;

  $("tabTitle").value = savedTitle;
  $("tabIcon").value = savedIcon;

  // Initialize the favicon immediately.
  setFavicon(savedIcon);
}

$("tabTitle").addEventListener("change", () => {
  const title = $("tabTitle").value.trim() || "CloudAI";

  document.title = title;

  try {
    localStorage.setItem("cloudai_tab_title", title);
  } catch(error) {}
});

$("tabIcon").addEventListener("change", () => {
  const value = $("tabIcon").value.trim();

  setFavicon(value);

  try {
    localStorage.setItem("cloudai_tab_icon", value);
  } catch(error) {}
});

// IMPORTANT: Run on startup.
applyTabSettings();

$("speechRate").addEventListener("input", () => {
  state.speechRate = Number($("speechRate").value);
});

function populateVoices() {
  if (!("speechSynthesis" in window)) return;

  const select = $("speechVoice");

  select.innerHTML = '<option value="">System default</option>';

  speechSynthesis.getVoices().forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = voice.name;
    select.appendChild(option);
  });
}

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = populateVoices;
  populateVoices();
}

/* =========================================================
   SIDEBAR
   ========================================================= */

$("sidebarToggle").addEventListener("click", () => {
  $("app").classList.toggle("sidebar-closed");
  sound("click");
});

$("menuButton").addEventListener("click", () => {
  $("sidebar").classList.toggle("mobile-open");
  sound("click");
});

/* =========================================================
   PERSONALITY AND MODEL SELECTION
   ========================================================= */

$("personalitySelect").addEventListener("change", () => {
  state.personality = $("personalitySelect").value;
  sound("click");
});

$("modelSelect").addEventListener("change", () => {
  state.currentModel = $("modelSelect").value;
  sound("click");
});

/* =========================================================
   CONVERSATION MANAGEMENT
   ========================================================= */

async function loadConversations() {
  const response = await api("/conversations");

  if (!response.ok) {
    throw new Error("Could not load conversations.");
  }

  const data = await response.json();

  state.conversations = data.conversations || [];

  renderConversations();
}

function renderConversations() {
  const list = $("conversationList");
  const search = $("historySearch").value.toLowerCase();

  list.innerHTML = "";

  const visible = state.conversations.filter(chat =>
    (chat.title || "New conversation")
      .toLowerCase()
      .includes(search)
  );

  $("historyCount").textContent =
    state.conversations.length;

  if (!visible.length) {
    list.innerHTML =
      '<div class="empty-history">No conversations found.</div>';
    return;
  }

  for (const chat of visible) {
    const item = document.createElement("div");

    item.className =
      "conversation" +
      (chat.id === state.conversationId ? " active" : "") +
      (state.selectedChats.has(chat.id) ? " selected" : "");

    item.dataset.id = chat.id;

    item.innerHTML = `
      <span class="c-check"></span>
      <span class="c-title"></span>
      <button class="btn icon chat-menu-button"
        title="Conversation options">⋯</button>
    `;

    item.querySelector(".c-title").textContent =
      chat.title || "New conversation";

    item.addEventListener("click", event => {
      if (event.target.closest(".chat-menu-button")) return;

      if (state.selectionMode) {
        toggleChatSelection(chat.id);
      } else {
        openConversation(chat.id);
      }
    });

    item.addEventListener("contextmenu", event => {
      event.preventDefault();
      showChatMenu(event.clientX, event.clientY, chat.id);
    });

    item.querySelector(".chat-menu-button")
      .addEventListener("click", event => {
        event.stopPropagation();

        const rect = event.currentTarget.getBoundingClientRect();

        showChatMenu(rect.left, rect.bottom, chat.id);
      });

    list.appendChild(item);
  }
}

$("historySearch").addEventListener("input", renderConversations);

$("newChat").addEventListener("click", () => {
  newConversation();
  sound("click");
});

function newConversation() {
  state.conversationId = null;
  state.messages = [];
  state.resources = [];
  state.image = null;
  state.firstMessageSent = false;

  $("messages").innerHTML = "";
  $("welcome").style.display = "";
  $("prompt").value = "";

  renderResources();
  removeImage();

  renderConversations();
  $("sidebar").classList.remove("mobile-open");

  $("prompt").focus();
}

function cleanStoredUserMessage(content) {
  const value = String(content || "");
  const prefix = "[CloudAI response instructions]";
  const userMarker = "[User message]";

  if (!value.startsWith(prefix)) return value;

  const markerIndex = value.indexOf(userMarker);
  if (markerIndex === -1) return value;

  return value.slice(markerIndex + userMarker.length)
    .replace(/^\s+/, "");
}

async function openConversation(id) {
  try {
    const response = await api(
      "/history?id=" + encodeURIComponent(id)
    );

    if (!response.ok) {
      throw new Error("Unable to load this conversation.");
    }

    const data = await response.json();

    // Clean old messages before rendering them.
    state.messages = (data.messages || []).map(message => ({
      ...message,
      content: message.role === "user"
        ? cleanStoredUserMessage(message.content)
        : message.content
    }));

    state.conversationId = id;
    state.firstMessageSent = state.messages.some(
      message => message.role === "user"
    );

    $("messages").innerHTML = "";
    $("welcome").style.display =
      state.messages.length ? "none" : "";

    state.resources = [];
    renderResources();

    for (const message of state.messages) {
      if (message.role === "user") {
        const parsed = unpackMessage(message.content);

        renderMessage(
          "user",
          parsed.text,
          parsed.resources,
          false
        );
      } else {
        renderMessage(
          "assistant",
          message.content,
          [],
          true
        );
      }
    }

    renderConversations();
    $("sidebar").classList.remove("mobile-open");

    requestAnimationFrame(() => {
      scrollBottom();
    });

  } catch(error) {
    toast(error.message);
  }
}

    renderConversations();

    $("sidebar").classList.remove("mobile-open");

    scrollBottom();

  } catch(error) {
    toast(error.message);
  }
}

/* Titles: summarize the first user message locally. */

function summarizeTitle(text) {
  let value = String(text || "")
    .replace(/⟦CLOUDAI_RESOURCES_V1⟧[\s\S]*/, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  value = value.replace(
    /^(hey|hello|hi|please|can you|could you|i want you to)\s+/i,
    ""
  );

  if (!value) return "New conversation";

  const words = value.split(" ");

  let title = words.slice(0, 8).join(" ");

  if (title.length > 58) {
    title = title.slice(0, 55).trim() + "…";
  } else if (words.length > 8) {
    title += "…";
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

async function updateChatTitle(id, title) {
  try {
    await api("/conversations", {
      method: "PATCH",
      body: JSON.stringify({ id, title })
    });

    const chat = state.conversations.find(item => item.id === id);

    if (chat) chat.title = title;

    renderConversations();

  } catch(error) {
    console.warn("Title update failed:", error);
  }
}

/* =========================================================
   CUSTOM CHAT MENU
   ========================================================= */

function showChatMenu(x, y, id) {
  state.contextChat = id;

  const menu = $("chatContextMenu");

  menu.style.left = Math.min(
    x,
    window.innerWidth - 200
  ) + "px";

  menu.style.top = Math.min(
    y,
    window.innerHeight - 190
  ) + "px";

  menu.classList.add("show");
}

function hideChatMenu() {
  $("chatContextMenu").classList.remove("show");
}

document.addEventListener("click", event => {
  if (!event.target.closest("#chatContextMenu")) {
    hideChatMenu();
  }
});

$("chatContextMenu").addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = state.contextChat;

  hideChatMenu();

  if (action === "rename") {
    const chat = state.conversations.find(item => item.id === id);

    const title = prompt(
      "Rename conversation:",
      chat?.title || ""
    );

    if (title && title.trim()) {
      await updateChatTitle(id, title.trim());
    }
  }

  if (action === "delete") {
    if (!confirm("Delete this conversation permanently?")) return;

    try {
      const response = await api(
        "/conversations?id=" + encodeURIComponent(id),
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Delete failed.");

      if (state.conversationId === id) {
        newConversation();
      }

      await loadConversations();

      toast("Conversation deleted.");

    } catch(error) {
      toast(error.message);
    }
  }

  if (action === "export") {
    await exportConversation(id);
  }

  if (action === "select") {
    state.selectionMode = true;
    toggleChatSelection(id);
    $("bulkBar").classList.add("show");
  }
});

/* Multi-select */

state.selectionMode = false;

function toggleChatSelection(id) {
  if (state.selectedChats.has(id)) {
    state.selectedChats.delete(id);
  } else {
    state.selectedChats.add(id);
  }

  if (!state.selectedChats.size) {
    state.selectionMode = false;
  }

  updateBulkBar();
  renderConversations();
}

function updateBulkBar() {
  $("bulkBar").classList.toggle(
    "show",
    state.selectedChats.size > 0
  );

  $("bulkCount").textContent =
    state.selectedChats.size + " selected";
}

$("bulkCancel").addEventListener("click", () => {
  state.selectedChats.clear();
  state.selectionMode = false;
  updateBulkBar();
  renderConversations();
});

$("bulkDelete").addEventListener("click", async () => {
  const ids = [...state.selectedChats];

  if (!ids.length) return;

  if (!confirm(`Delete ${ids.length} conversations?`)) return;

  let failed = 0;

  for (const id of ids) {
    try {
      const response = await api(
        "/conversations?id=" + encodeURIComponent(id),
        { method: "DELETE" }
      );

      if (!response.ok) failed++;

    } catch(e) {
      failed++;
    }
  }

  if (ids.includes(state.conversationId)) {
    newConversation();
  }

  state.selectedChats.clear();
  state.selectionMode = false;

  updateBulkBar();
  await loadConversations();

  toast(
    failed
      ? `${failed} conversations could not be deleted.`
      : "Selected conversations deleted."
  );
});

/* =========================================================
   EXPORT
   ========================================================= */

async function exportConversation(id) {
  try {
    const response = await api(
      "/history?id=" + encodeURIComponent(id)
    );

    if (!response.ok) throw new Error("Export failed.");

    const data = await response.json();

    const text = (data.messages || [])
      .map(message =>
        (message.role === "user" ? "YOU" : "CLOUDAI") +
        "\n\n" + message.content
      )
      .join("\n\n----------------------\n\n");

    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8"
    });

    downloadBlob(
      blob,
      summarizeTitle(data.conversation?.title || "conversation") +
      ".txt"
    );

  } catch(error) {
    toast(error.message);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("exportAll").addEventListener("click", async () => {
  if (!state.conversationId) {
    toast("Open a conversation first.");
    return;
  }

  await exportConversation(state.conversationId);
});

/* =========================================================
   RESOURCE SYSTEM
   ========================================================= */

function guessResourceType(name, content) {
  const extension = (
    name.split(".").pop() || ""
  ).toLowerCase();

  const map = {
    js:"JavaScript",
    mjs:"JavaScript",
    ts:"TypeScript",
    jsx:"React",
    tsx:"React",
    html:"HTML",
    css:"CSS",
    scss:"SCSS",
    json:"JSON",
    xml:"XML",
    csv:"CSV",
    c:"C",
    h:"C/C++",
    cpp:"C++",
    cc:"C++",
    hpp:"C++",
    py:"Python",
    java:"Java",
    rs:"Rust",
    go:"Go",
    sh:"Shell",
    bash:"Shell",
    md:"Markdown",
    txt:"Text",
    log:"Log",
    sql:"SQL",
    gd:"GDScript",
    scad:"OpenSCAD",
    yaml:"YAML",
    yml:"YAML",
    toml:"TOML"
  };

  if (map[extension]) return map[extension];

  if (/^\s*<!doctype html|^\s*<html/i.test(content)) return "HTML";
  if (/^\s*#include\s+</m.test(content)) return "C/C++";
  if (/^\s*(import |from ).+/m.test(content)) return "Python";
  if (/^\s*\{[\s\S]*\}\s*$/.test(content)) {
    try {
      JSON.parse(content);
      return "JSON";
    } catch(e) {}
  }

  if (/\b(function|const|let|var|=>)\b/.test(content)) {
    return "JavaScript";
  }

  return "Text";
}

function estimateTokens(text) {
  // Rough estimate only. Actual tokenization varies by model.
  return Math.ceil(String(text || "").length / 3.5);
}

function addResource(name, content, type) {
  name = String(name || "pasted-resource.txt").slice(0, 120);
  content = String(content || "");

  if (!content.trim()) {
    toast("That resource is empty.");
    return false;
  }

  if (content.length > 30000) {
    toast("Individual resources are limited to 30,000 characters.");
    return false;
  }

  if (state.resources.length >= 8) {
    toast("You can attach up to 8 resources per message.");
    return false;
  }

  const total = state.resources.reduce(
    (sum, resource) => sum + resource.content.length,
    0
  );

  if (total + content.length > 100000) {
    toast("Combined resource limit reached.");
    return false;
  }

  state.resources.push({
    id: uid(),
    name,
    type: type || guessResourceType(name, content),
    content,
    size: content.length
  });

  renderResources();
  updateEstimate();

  sound("success");

  return true;
}

function renderResources() {
  const area = $("resourceArea");

  area.innerHTML = "";

  area.classList.toggle(
    "show",
    state.resources.length > 0
  );

  state.resources.forEach(resource => {
    const card = document.createElement("div");

    card.className = "resource-card";

    card.innerHTML = `
      <span class="resource-type"></span>
      <span class="resource-name"></span>
      <button class="resource-expand" title="Preview">⌄</button>
      <button class="resource-remove" title="Remove">×</button>
      <div class="resource-expanded" hidden></div>
    `;

    card.querySelector(".resource-type").textContent =
      resource.type;

    card.querySelector(".resource-name").textContent =
      resource.name;

    const preview = card.querySelector(".resource-expanded");

    preview.textContent =
      resource.content.slice(0, 2000) +
      (resource.content.length > 2000 ? "\n… Preview truncated." : "");

    card.querySelector(".resource-expand")
      .addEventListener("click", () => {
        preview.hidden = !preview.hidden;
      });

    card.querySelector(".resource-remove")
      .addEventListener("click", () => {
        state.resources = state.resources.filter(
          item => item.id !== resource.id
        );

        renderResources();
        updateEstimate();
      });

    area.appendChild(card);
  });
}

/*
 * Resource persistence workaround:
 * Backend v2 stores message text, not separate resources.
 * We pack the resource data into a recognizable message marker.
 * History loading extracts it and displays the cards separately.
 */

function packMessage(text, resources) {
  if (!resources.length) return text;

  const safeResources = resources.map(resource => ({
    name: resource.name,
    type: resource.type,
    content: resource.content,
    size: resource.size
  }));

  return text +
    RESOURCE_OPEN +
    JSON.stringify(safeResources) +
    RESOURCE_CLOSE;
}

function unpackMessage(content) {
  const start = content.indexOf(RESOURCE_OPEN);

  if (start < 0) {
    return {
      text: content,
      resources: []
    };
  }

  const end = content.indexOf(
    RESOURCE_CLOSE,
    start + RESOURCE_OPEN.length
  );

  if (end < 0) {
    return {
      text: content,
      resources: []
    };
  }

  const raw = content.slice(
    start + RESOURCE_OPEN.length,
    end
  );

  let resources = [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      resources = parsed.map(item => ({
        id: uid(),
        name: String(item.name || "resource.txt"),
        type: String(item.type || "Text"),
        content: String(item.content || ""),
        size: Number(item.size || 0)
      }));
    }
  } catch(e) {
    console.warn("Could not restore resource metadata.");
  }

  return {
    text: content.slice(0, start),
    resources
  };
}

/* Manual resource paste */

$("resourceButton").addEventListener("click", () => {
  $("resourceName").value = "pasted-resource.txt";
  $("resourceContent").value = "";
  openModal("resourceModal");
});

$("addResource").addEventListener("click", () => {
  const success = addResource(
    $("resourceName").value,
    $("resourceContent").value
  );

  if (success) {
    closeModal("resourceModal");
    $("resourceContent").value = "";
  }
});

/* Turn selected text into a resource */

$("prompt").addEventListener("keydown", event => {
  if (
    event.key === "r" &&
    event.altKey &&
    event.shiftKey
  ) {
    event.preventDefault();

    const input = $("prompt");
    const start = input.selectionStart;
    const end = input.selectionEnd;

    if (start !== end) {
      const selected = input.value.slice(start, end);

      if (addResource("selected-text.txt", selected)) {
        input.value =
          input.value.slice(0, start) +
          input.value.slice(end);

        updateEstimate();
      }
    } else {
      toast("Select some text first.");
    }
  }
});

/* Paste detection */

$("prompt").addEventListener("paste", event => {
  const clipboard = event.clipboardData;
  if (!clipboard) return;

  const text = clipboard.getData("text/plain");

  if (!text || text.length < 80) return;

  const detected = detectCode(text);

  if (detected) {
    event.preventDefault();

    const name = detected.extension
      ? "pasted-code." + detected.extension
      : "pasted-code.txt";

    if (addResource(name, text, detected.type)) {
      toast("Code detected and attached as a resource.");
    } else {
      $("prompt").setRangeText(
        text,
        $("prompt").selectionStart,
        $("prompt").selectionEnd,
        "end"
      );
    }
  } else if (text.length > 1800) {
    event.preventDefault();

    const success = addResource(
      "pasted-text.txt",
      text,
      "Text"
    );

    if (!success) {
      $("prompt").setRangeText(
        text,
        $("prompt").selectionStart,
        $("prompt").selectionEnd,
        "end"
      );
    } else {
      toast("Large pasted text attached as a resource.");
    }
  }

  updateEstimate();
});

function detectCode(text) {
  const checks = [
    {
      type:"HTML",
      extension:"html",
      regex:/<!doctype html|<html[\s>]|<script[\s>]|<div[\s>]/i
    },
    {
      type:"C/C++",
      extension:"cpp",
      regex:/#include\s*[<"]|int\s+main\s*\(|std::(cout|vector|string)/
    },
    {
      type:"JavaScript",
      extension:"js",
      regex:/\b(const|let|var)\s+\w+\s*=|function\s+\w+\s*\(|=>\s*[{(]/
    },
    {
      type:"Python",
      extension:"py",
      regex:/^\s*(def |class |import |from .+ import )/m
    },
    {
      type:"JSON",
      extension:"json",
      regex:/^\s*[\[{][\s\S]*["'][\w-]+["']\s*:/
    },
    {
      type:"XML",
      extension:"xml",
      regex:/^\s*<\?xml|<[\w:-]+[^>]*>[\s\S]*<\/[\w:-]+>/
    },
    {
      type:"CSS",
      extension:"css",
      regex:/[.#][\w-]+\s*\{[^}]*:[^}]*;/
    },
    {
      type:"SQL",
      extension:"sql",
      regex:/\b(SELECT|INSERT INTO|CREATE TABLE|UPDATE .+ SET)\b/i
    },
    {
      type:"Shell",
      extension:"sh",
      regex:/^#!\/(usr\/)?bin\/(bash|sh)|\b(sudo|chmod|mkdir|grep|awk)\b/m
    }
  ];

  for (const item of checks) {
    if (item.regex.test(text)) return item;
  }

  // Short code examples often don't have obvious signatures.
  const codeIndicators = [
    /^\s*#include/m,
    /^\s*<\/?[a-z][^>]*>/im,
    /^\s*[\w$]+\s*=\s*[^=]/m,
    /;\s*$/m,
    /^\s*(if|for|while|return)\s*[\({]/m,
    /^\s*[\w$]+\([^)]*\)\s*\{/m
  ];

  const matches = codeIndicators.filter(regex => regex.test(text));

  if (matches.length >= 2) {
    return {
      type:"Code",
      extension:"txt"
    };
  }

  return null;
}

/* Text resource uploads */

$("fileButton").addEventListener("click", () => {
  $("resourceInput").click();
});

$("resourceInput").addEventListener("change", async event => {
  const files = [...event.target.files];

  for (const file of files) {
    if (file.size > 120000) {
      toast(file.name + " is too large.");
      continue;
    }

    try {
      const content = await file.text();
      addResource(file.name, content);
    } catch(e) {
      toast("Could not read " + file.name);
    }
  }

  event.target.value = "";
});

/* =========================================================
   IMAGE ATTACHMENTS
   ========================================================= */

$("attachButton").addEventListener("click", () => {
  $("imageInput").click();
});

$("imageInput").addEventListener("change", async event => {
  const file = event.target.files[0];

  if (!file) return;

  if (!["image/png","image/jpeg","image/webp"].includes(file.type)) {
    toast("Only PNG, JPEG, and WebP images are supported.");
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    toast("Images must be smaller than 4 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const dataURL = reader.result;

    state.image = {
      mimeType:file.type,
      data:dataURL.split(",")[1],
      name:file.name
    };

    $("previewImage").src = dataURL;
    $("previewName").textContent = file.name;

    $("attachPreview").classList.add("show");

    updateEstimate();
  };

  reader.readAsDataURL(file);

  event.target.value = "";
});

function removeImage() {
  state.image = null;

  $("previewImage").removeAttribute("src");
  $("previewName").textContent = "";

  $("attachPreview").classList.remove("show");

  updateEstimate();
}

$("removeImage").addEventListener("click", removeImage);

/* =========================================================
   TOKEN ESTIMATION AND LARGE RESOURCE ANALYSIS
   ========================================================= */

function updateEstimate() {
  const message = $("prompt").value;

  const resourceCharacters = state.resources.reduce(
    (sum, item) => sum + item.content.length,
    0
  );

  const estimate =
    estimateTokens(message) +
    estimateTokens(
      state.resources.map(r => r.content).join("\n")
    );

  $("tokenEstimate").textContent =
    "~" + estimate.toLocaleString() + " tokens";

  $("charCount").textContent =
    message.length.toLocaleString();

  $("tokenEstimate").title =
    resourceCharacters.toLocaleString() +
    " resource characters, plus message text.";

  const button = $("sendButton");

  button.title = estimate > 5500
    ? "Large request — may exceed model limits"
    : "Send";
}

$("prompt").addEventListener("input", updateEstimate);

/* =========================================================
   MARKDOWN AND CLOUDAI DISPLAY COMMAND RENDERER
   ========================================================= */

function decodeModelEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function renderInline(value) {
  let text = escapeHTML(value);
  const inlineCode = [];

  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCode.push(code) - 1;
    return `%%INLINECODE_${index}%%`;
  });

  text = text.replace(
    /$begin:math:display$\\\[color\=\(\#\[0\-9a\-fA\-F\]\{3\,8\}\)$end:math:display$\]([\s\S]*?)$begin:math:display$\\\[\\\/color$end:math:display$\]/g,
    (_, color, content) =>
      `<span class="colored" style="color:${color}">${content}</span>`
  );

  text = text.replace(
    /$begin:math:display$\\\[size\=\(\\d\{1\,2\}\)$end:math:display$\]([\s\S]*?)$begin:math:display$\\\[\\\/size$end:math:display$\]/g,
    (_, size, content) => {
      const px = Math.min(42, Math.max(10, Number(size)));
      return `<span class="sized" style="font-size:${px}px">${content}</span>`;
    }
  );

  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  text = text.replace(
    /$begin:math:display$\(\[\^$end:math:display$]+)\]$begin:math:text$\(https\?\:\\\/\\\/\[\^\)\\s\]\+\)$end:math:text$/g,
    (_, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );

  text = text.replace(
    /%%INLINECODE_(\d+)%%/g,
    (_, index) =>
      `<code>${escapeHTML(inlineCode[Number(index)] || "")}</code>`
  );

  return text;
}

function renderMarkdown(source) {
  const lines = String(source || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const output = [];

  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function tableCells(line) {
    return line.trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cell => cell.trim());
  }

  function isBlockStart(index) {
    const line = lines[index] || "";

    return (
      /^\s*```/.test(line) ||
      /^\s*#{1,3}\s+/.test(line) ||
      /^\s*>\s?/.test(line) ||
      /^\s*(---|\*\*\*)\s*$/.test(line) ||
      /^\s*[-*]\s+/.test(line) ||
      /^\s*\d+\.\s+/.test(line) ||
      /^\s*\[\[callout=/.test(line) ||
      /^\s*\[\[form\]\]/.test(line) ||
      (index + 1 < lines.length &&
        line.includes("|") &&
        isTableSeparator(lines[index + 1]))
    );
  }

  function makeForm(jsonText) {
    let formData;

    try {
      formData = JSON.parse(
        decodeModelEntities(jsonText.trim())
      );
    } catch(error) {
      return `<pre>${escapeHTML(jsonText)}</pre>`;
    }

    if (!formData || !Array.isArray(formData.fields)) {
      return `<pre>${escapeHTML(jsonText)}</pre>`;
    }

    const id = uid();
    const title = escapeHTML(formData.title || "Quick form");
    const description = escapeHTML(formData.description || "");
    const submitLabel = escapeHTML(formData.submitLabel || "Submit");

    const fields = formData.fields.slice(0, 20).map((field, index) => {
      const label = escapeHTML(field.label || field.name || "Field");

      const name = String(field.name || `field_${index}`)
        .replace(/[^\w-]/g, "_");

      const required = field.required ? "required" : "";

      if (field.type === "textarea") {
        return `<label>${label}</label>
          <textarea name="${name}" ${required}></textarea>`;
      }

      if (field.type === "select") {
        const options = (
          Array.isArray(field.options) ? field.options : []
        ).map(option =>
          `<option value="${escapeHTML(option)}">${escapeHTML(option)}</option>`
        ).join("");

        return `<label>${label}</label>
          <select name="${name}" ${required}>
            <option value="">Choose…</option>
            ${options}
          </select>`;
      }

      const type = ["text", "number", "email", "date"]
        .includes(field.type) ? field.type : "text";

      return `<label>${label}</label>
        <input type="${type}" name="${name}" ${required}>`;
    }).join("");

    return `<form class="mini-form" id="${id}">
      <strong>${title}</strong>
      ${description ? `<p>${description}</p>` : ""}
      ${fields}
      <button class="btn primary" type="submit">${submitLabel}</button>
    </form>`;
  }

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Code blocks
    const fence = line.match(/^\s*```([\w.+#-]*)\s*$/);

    if (fence) {
      const language = fence[1] || "code";
      i++;

      const codeLines = [];

      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }

      if (i < lines.length) i++;

      output.push(`<div class="code-wrap">
        <div class="code-head">
          <span>${escapeHTML(language)}</span>
          <button type="button" class="copy-code">Copy code</button>
        </div>
        <pre><code>${escapeHTML(codeLines.join("\n"))}</code></pre>
      </div>`);

      continue;
    }

    // Callouts
    const callout = line.match(
      /^\s*\[\[callout=(info|success|warning|error)\]\]\s*$/
    );

    if (callout) {
      i++;

      const content = [];

      while (i < lines.length &&
        !/^\s*\[\[\/callout\]\]\s*$/.test(lines[i])) {
        content.push(lines[i]);
        i++;
      }

      if (i < lines.length) i++;

      output.push(
        `<div class="callout ${callout[1]}">` +
        renderMarkdown(content.join("\n")) +
        `</div>`
      );

      continue;
    }

    // Forms
    if (/^\s*\[\[form\]\]\s*$/.test(line)) {
      i++;

      const json = [];

      while (i < lines.length &&
        !/^\s*\[\[\/form\]\]\s*$/.test(lines[i])) {
        json.push(lines[i]);
        i++;
      }

      if (i < lines.length) i++;

      output.push(makeForm(json.join("\n")));
      continue;
    }

    // Headings
    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);

    if (heading) {
      const level = heading[1].length;

      output.push(
        `<h${level}>${renderInline(heading[2])}</h${level}>`
      );

      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      output.push("<hr>");
      i++;
      continue;
    }

    // Tables
    if (
      i + 1 < lines.length &&
      line.includes("|") &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = tableCells(line);
      i += 2;

      const rows = [];

      while (
        i < lines.length &&
        lines[i].includes("|") &&
        lines[i].trim()
      ) {
        rows.push(tableCells(lines[i]));
        i++;
      }

      const head = headers.map(cell =>
        `<th>${renderInline(cell)}</th>`
      ).join("");

      const body = rows.map(row =>
        `<tr>${headers.map((_, column) =>
          `<td>${renderInline(row[column] || "")}</td>`
        ).join("")}</tr>`
      ).join("");

      output.push(`<div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`);

      continue;
    }

    // Blockquotes
    if (/^\s*>\s?/.test(line)) {
      const quote = [];

      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }

      output.push(
        `<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`
      );

      continue;
    }

    // Lists
    if (
      /^\s*[-*]\s+/.test(line) ||
      /^\s*\d+\.\s+/.test(line)
    ) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];

      while (i < lines.length) {
        const match = ordered
          ? lines[i].match(/^\s*\d+\.\s+(.+)$/)
          : lines[i].match(/^\s*[-*]\s+(.+)$/);

        if (!match) break;

        items.push(`<li>${renderInline(match[1])}</li>`);
        i++;
      }

      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    // Paragraphs
    const paragraph = [line];
    i++;

    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBlockStart(i)
    ) {
      paragraph.push(lines[i]);
      i++;
    }

    output.push(
      `<p>${paragraph.map(renderInline).join("<br>")}</p>`
    );
  }

  return output.join("");
}

$("messages").addEventListener("click", async event => {
  const button = event.target.closest(".copy-code");
  if (!button) return;

  const code = button.closest(".code-wrap")
    ?.querySelector("pre")?.innerText;

  if (code == null) return;

  try {
    await navigator.clipboard.writeText(code);
    button.textContent = "Copied!";

    setTimeout(() => {
      button.textContent = "Copy code";
    }, 1400);

  } catch(error) {
    toast("Clipboard access unavailable.");
  }
});

$("messages").addEventListener("submit", event => {
  const form = event.target.closest(".mini-form");
  if (!form) return;

  event.preventDefault();

  const values = Object.fromEntries(
    new FormData(form).entries()
  );

  const result = Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const output = document.createElement("div");
  output.className = "form-result";
  output.textContent = "Submitted:\n" + result;

  form.replaceWith(output);

  $("prompt").value =
    "Here are my answers to your questions:\n" + result;

  updateEstimate();
  $("prompt").focus();
});

/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessage(role, content, resources = [], addTools = true) {
  const container = $("messages");

  const message = document.createElement("article");
  message.className = "message " + role;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";

  if (role === "assistant") {
    avatar.innerHTML = ICON.assistant;
  } else {
    avatar.textContent = "Y";
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = role === "assistant" ? "CLOUDAI" : "YOU";

  const body = document.createElement("div");
  body.className = "message-content";

  body.innerHTML = renderMarkdown(content);

  bubble.appendChild(meta);

  if (resources.length) {
    const resourceHolder = document.createElement("div");
    resourceHolder.className = "resource-area show";

    resources.forEach(resource => {
      const card = document.createElement("div");
      card.className = "resource-card";

      const type = document.createElement("span");
      type.className = "resource-type";
      type.textContent = resource.type || "Text";

      const name = document.createElement("span");
      name.className = "resource-name";
      name.textContent = resource.name;

      const expand = document.createElement("button");
      expand.textContent = "Preview";

      const preview = document.createElement("div");
      preview.className = "resource-expanded";
      preview.hidden = true;
      preview.textContent = resource.content;

      expand.addEventListener("click", () => {
        preview.hidden = !preview.hidden;
      });

      card.append(type, name, expand, preview);
      resourceHolder.appendChild(card);
    });

    bubble.appendChild(resourceHolder);
  }

  bubble.appendChild(body);

  if (role === "assistant" && addTools) {
    const tools = document.createElement("div");
    tools.className = "message-tools";

    tools.innerHTML = `
      <button class="copy-message">Copy</button>
      <button class="read-message">Read aloud</button>
    `;

    tools.querySelector(".copy-message")
      .addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(content);
          toast("Message copied.");
          sound("success");
        } catch(e) {
          toast("Clipboard access unavailable.");
        }
      });

    tools.querySelector(".read-message")
      .addEventListener("click", () => {
        speak(content);
      });

    bubble.appendChild(tools);
  }

  message.append(avatar, bubble);
  container.appendChild(message);

  scrollBottom();

  return body;
}

/* =========================================================
   THINKING INDICATOR
   ========================================================= */

let thinkingElement = null;

function showThinking(label = "Thinking") {
  hideThinking();

  thinkingElement = document.createElement("div");
  thinkingElement.className = "thinking-row";

  thinkingElement.innerHTML = `
    <span class="thinking-cursor"></span>
    <span class="thinking-label"></span>
  `;

  thinkingElement.querySelector(".thinking-label")
    .textContent = label;

  $("messages").appendChild(thinkingElement);

  scrollBottom();
  startThinkingSound();
}

function updateThinking(label) {
  if (!thinkingElement) return;

  thinkingElement.querySelector(".thinking-label")
    .textContent = label;
}

function hideThinking() {
  if (thinkingElement) {
    thinkingElement.remove();
    thinkingElement = null;
  }

  stopThinkingSound();
}

/* =========================================================
   SPEECH
   ========================================================= */

function speak(text) {
  if (!("speechSynthesis" in window)) {
    toast("Speech synthesis is unavailable.");
    return;
  }

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    String(text).replace(/```[\s\S]*?```/g, "Code block omitted.")
  );

  utterance.rate = state.speechRate;

  const index = $("speechVoice").value;

  if (index !== "") {
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices[Number(index)] || null;
  }

  speechSynthesis.speak(utterance);
}

$("speakToggle").addEventListener("click", () => {
  state.autoRead = !state.autoRead;

  $("speakToggle").style.color =
    state.autoRead ? "var(--accent)" : "var(--muted)";

  toast(
    state.autoRead
      ? "Automatic read-aloud enabled."
      : "Automatic read-aloud disabled."
  );

  sound("click");
});

/* =========================================================
   VOICE INPUT
   ========================================================= */

$("micButton").addEventListener("click", () => {
  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    toast("Voice recognition is not supported in this browser.");
    return;
  }

  if (state.recognition) {
    state.recognition.stop();
    return;
  }

  const recognition = new Recognition();

  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;

  state.recognition = recognition;

  $("voiceBar").classList.add("show");
  $("voiceStatus").textContent = "Listening…";

  recognition.onresult = event => {
    let text = "";

    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }

    $("prompt").value = text;
    updateEstimate();
  };

  recognition.onerror = () => {
    toast("Voice recognition encountered an error.");
  };

  recognition.onend = () => {
    state.recognition = null;
    $("voiceBar").classList.remove("show");
  };

  recognition.start();
});

$("stopVoice").addEventListener("click", () => {
  state.recognition?.stop();
});

/* =========================================================
   STREAMING CHAT
   ========================================================= */

function buildPrompt(text, resources) {
  const personality =
    PERSONALITIES[state.personality] || PERSONALITIES.default;

  const resourceInstruction = resources.length
    ? `
The user attached ${resources.length} resource(s).
Analyze their actual contents, not just their filenames.
When comparing files, identify concrete similarities and differences.
Do not assume two resources with the same filename are identical.
`
    : "";

  return `
[CloudAI response instructions]
${personality}

${FORMAT_INSTRUCTIONS}

${resourceInstruction}

[User message]
${text}
`.trim();
}

async function readSSE(response, onDelta, onDone) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let completed = false;

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream:true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find(item => item.startsWith("data:"));

      if (!line) continue;

      const raw = line.slice(5).trim();

      if (!raw || raw === "[DONE]") continue;

      let data;

      try {
        data = JSON.parse(raw);
      } catch(e) {
        continue;
      }

      if (data.type === "delta") {
        onDelta(data.text || "");
      }

      if (data.type === "done") {
        completed = true;
        onDone(data);
      }

      if (data.type === "error") {
        throw new Error(data.error || "AI request failed.");
      }
    }
  }

  if (!completed) {
    throw new Error(
      "The connection ended before CloudAI completed its response."
    );
  }
}

/* =========================================================
   REQUEST SENDING
   ========================================================= */

async function sendRequest(text, resources, image, onDelta) {
  const packed = packMessage(text, resources);

  const message = buildPrompt(packed, resources);

  const body = {
    message,
    conversationId:state.conversationId,
    model:state.currentModel
  };

  if (image) {
    body.image = {
      mimeType:image.mimeType,
      data:image.data
    };
  }

  const response = await api("/chat", {
    method:"POST",
    body:JSON.stringify(body)
  });

  if (!response.ok) {
    let message = "CloudAI request failed.";

    try {
      const data = await response.json();
      message = data.error || message;
    } catch(e) {}

    throw new Error(message);
  }

  let doneData = null;

  await readSSE(
    response,
    onDelta,
    data => {
      doneData = data;
    }
  );

  return doneData;
}

/* =========================================================
   MAIN SEND ACTION
   ========================================================= */

async function sendMessage() {
  if (state.streaming) return;

  const text = $("prompt").value.trim();
  const resources = [...state.resources];
  const image = state.image
    ? {...state.image}
    : null;

  if (!text && !resources.length && !image) return;

  const resourceCharacters = resources.reduce(
    (sum, item) => sum + item.content.length,
    0
  );

  const estimatedTokens =
    estimateTokens(text) +
    estimateTokens(resources.map(r => r.content).join("\n"));

  if (estimatedTokens > 6000) {
    const proceed = confirm(
      "This request is estimated at approximately " +
      estimatedTokens.toLocaleString() +
      " input tokens, before conversation history and model overhead.\n\n" +
      "Your current Groq service tier may reject it because of its TPM limit.\n\n" +
      "Send anyway?"
    );

    if (!proceed) return;
  }

  if (resourceCharacters > 15000) {
    toast("Large resources attached. This request may use substantial tokens.");
  }

  state.streaming = true;

  $("sendButton").disabled = true;

  const originalText = text ||
    (resources.length ? "Please analyze the attached resources." : "Describe this image.");

  $("welcome").style.display = "none";

  renderMessage("user", originalText, resources, false);

  $("prompt").value = "";
  state.resources = [];
  renderResources();

  removeImage();

  updateEstimate();

  state.messages.push({
    role:"user",
    content:originalText
  });

  sound("send");

  showThinking("Thinking");

  let assistantBody = null;
  let assistantText = "";
  let started = false;

  try {
    const result = await sendRequest(
      originalText,
      resources,
      image,
      delta => {
        if (!started) {
          started = true;

          hideThinking();

          assistantBody = renderMessage(
            "assistant",
            "",
            [],
            false
          );

          assistantBody.textContent = "";
          assistantBody.classList.add("streaming");
        }

        assistantText += delta;

        assistantBody.innerHTML =
          renderMarkdown(assistantText);

        scrollBottom();
      }
    );

    hideThinking();

    if (!assistantBody) {
      assistantBody = renderMessage(
        "assistant",
        assistantText || "(No response received.)"
      );
    } else {
      assistantBody.innerHTML =
        renderMarkdown(assistantText);

      assistantBody.classList.remove("streaming");

      // Add action buttons after streaming finishes.
      const message = assistantBody.closest(".message");

      const tools = document.createElement("div");
      tools.className = "message-tools";

      tools.innerHTML = `
        <button class="copy-message">Copy</button>
        <button class="read-message">Read aloud</button>
      `;

      tools.querySelector(".copy-message")
        .addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(assistantText);
            toast("Message copied.");
          } catch(e) {
            toast("Clipboard unavailable.");
          }
        });

      tools.querySelector(".read-message")
        .addEventListener("click", () => speak(assistantText));

      message.querySelector(".bubble").appendChild(tools);
    }

    if (result?.conversationId) {
      const wasNew = !state.conversationId;

      state.conversationId = result.conversationId;

      if (wasNew) {
        const title = summarizeTitle(originalText);

        await updateChatTitle(
          state.conversationId,
          title
        );
      }
    }

    state.messages.push({
      role:"assistant",
      content:assistantText
    });

    await loadConversations();

    if (state.autoRead && assistantText) {
      speak(assistantText);
    }

    sound("receive");

  } catch(error) {
    hideThinking();

    if (assistantBody) {
      assistantBody.innerHTML =
        `<div class="callout error">${escapeHTML(error.message)}</div>`;
    } else {
      renderMessage(
        "assistant",
        "⚠️ " + error.message
      );
    }

    sound("error");

  } finally {
    state.streaming = false;
    $("sendButton").disabled = false;
    $("prompt").focus();
    scrollBottom();
  }
}

$("sendButton").addEventListener("click", sendMessage);

$("prompt").addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll("[data-prompt]").forEach(button => {
  button.addEventListener("click", () => {
    $("prompt").value = button.dataset.prompt;
    updateEstimate();
    $("prompt").focus();
  });
});

/* =========================================================
   USAGE DASHBOARD
   ========================================================= */

async function showUsage() {
  try {
    const response = await api("/usage");

    if (!response.ok) {
      throw new Error("Unable to retrieve usage.");
    }

    const data = await response.json();

    const usage = data.usage || {};

    openModal("settingsModal");

    toast(
      `Today: ${usage.requests ?? 0} requests · ` +
      `${usage.total_tokens ?? 0} tokens`
    );

  } catch(error) {
    toast(error.message);
  }
}

/* =========================================================
   STUDIO MODE
   ========================================================= */

function openStudio() {
  $("studio").classList.add("show");
  renderStudioFiles();
  sound("click");
}

function closeStudio() {
  $("studio").classList.remove("show");
  sound("click");
}

$("studioToggle").addEventListener("click", () => {
  if ($("studio").classList.contains("show")) {
    closeStudio();
  } else {
    openStudio();
  }
});

$("studioClose").addEventListener("click", closeStudio);

function renderStudioFiles() {
  const list = $("studioFileList");

  list.innerHTML = "";

  for (const name of Object.keys(state.studioFiles)) {
    const button = document.createElement("button");

    button.className = "studio-file";

    if (state.studioCurrent === name) {
      button.classList.add("active");
    }

    button.textContent = "▧ " + name;

    button.addEventListener("click", () => {
      selectStudioFile(name);
    });

    list.appendChild(button);
  }
}

function selectStudioFile(name) {
  state.studioCurrent = name;

  $("studioFileName").textContent = name;
  $("studioEditor").value = state.studioFiles[name] || "";

  renderStudioFiles();
}

$("studioNewFile").addEventListener("click", () => {
  const name = prompt("New file name:");

  if (!name) return;

  if (state.studioFiles[name]) {
    toast("That file already exists.");
    return;
  }

  state.studioFiles[name] = "";

  selectStudioFile(name);
});

$("studioSave").addEventListener("click", () => {
  if (!state.studioCurrent) {
    toast("Create or select a file first.");
    return;
  }

  state.studioFiles[state.studioCurrent] =
    $("studioEditor").value;

  toast("File saved in this session.");
  sound("success");
});

/* Simulated terminal */

function terminalPrint(text) {
  const output = $("terminalOutput");

  output.textContent += "\n" + text;
  output.scrollTop = output.scrollHeight;
}

function runTerminal(command) {
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  terminalPrint("studio $ " + command);

  switch(cmd) {
    case "":
      return;

    case "help":
      terminalPrint(
`Available commands:
help             Show this list
ls               List project files
pwd              Show simulated directory
cat <file>       Display a file
touch <file>     Create an empty file
rm <file>        Delete a file
echo <text>      Print text
clear            Clear terminal
date             Show current date
run              Explain simulated execution`
      );
      break;

    case "ls":
      terminalPrint(
        Object.keys(state.studioFiles).join("\n") ||
        "No files."
      );
      break;

    case "pwd":
      terminalPrint("/workspace");
      break;

    case "cat": {
      const name = args.join(" ");

      terminalPrint(
        state.studioFiles[name] ??
        "File not found."
      );
      break;
    }

    case "touch": {
      const name = args.join(" ");

      if (!name) {
        terminalPrint("Usage: touch <filename>");
        break;
      }

      state.studioFiles[name] ||= "";
      renderStudioFiles();

      terminalPrint("Created " + name);
      break;
    }

    case "rm": {
      const name = args.join(" ");

      if (!name || !state.studioFiles[name]) {
        terminalPrint("File not found.");
        break;
      }

      delete state.studioFiles[name];

      if (state.studioCurrent === name) {
        state.studioCurrent = null;
        $("studioEditor").value = "";
        $("studioFileName").textContent = "No file selected";
      }

      renderStudioFiles();

      terminalPrint("Removed " + name);
      break;
    }

    case "echo":
      terminalPrint(args.join(" "));
      break;

    case "clear":
      $("terminalOutput").textContent = "";
      break;

    case "date":
      terminalPrint(new Date().toString());
      break;

    case "run":
      terminalPrint(
        "This is a simulated terminal. " +
        "Actual program execution is not enabled."
      );
      break;

    default:
      terminalPrint(
        "Command not found: " + cmd +
        "\nType help for available commands."
      );
  }
}

$("terminalInput").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;

  const command = $("terminalInput").value;

  $("terminalInput").value = "";

  runTerminal(command);
});

$("terminalClear").addEventListener("click", () => {
  $("terminalOutput").textContent = "";
});

/* =========================================================
   STUDIO AI ACTIONS
   ========================================================= */

/*
 * The AI can describe code and files in its responses.
 * This function provides a safe, explicit way to create
 * a Studio file from selected text.
 */

function sendEditorToStudio(name, content) {
  if (!name) name = "generated-file.txt";

  state.studioFiles[name] = String(content || "");

  selectStudioFile(name);
  openStudio();

  toast("Created " + name + " in Studio.");
}

/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    $("historySearch").focus();
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "b") {
    event.preventDefault();
    $("app").classList.toggle("sidebar-closed");
  }

  if (event.key === "Escape") {
    hideChatMenu();

    document.querySelectorAll(".modal-backdrop.show")
      .forEach(modal => modal.classList.remove("show"));
  }
});

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initialize() {
  const savedPassword = getPassword();

  if (!savedPassword) {
    document.documentElement.classList.remove("has-session");
    $("authScreen").style.display = "flex";
    return;
  }

  state.password = savedPassword;

  // Hide login immediately to avoid the password-screen flash.
  document.documentElement.classList.add("has-session");
  $("authScreen").style.display = "none";

  try {
    await connect();

    // Automatic popup attempt. Browsers may block this because
    // it is not triggered by a user gesture.
    if (window.name !== "cloudai-popup") {
      await maybeLaunchPopup();
    }

  } catch(error) {
    clearPassword();

    $("authError").textContent =
      "Session could not be restored: " + error.message;
  }
}

updateEstimate();
populateVoices();

initialize();

})();
