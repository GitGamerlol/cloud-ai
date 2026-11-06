window.cloudAiTemplate = `
<div id="app">
  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 32 32">
          <path d="M5 10.5 16 4l11 6.5v11L16 28 5 21.5z"/>
          <path d="m5 10.5 11 6.5 11-6.5M16 17v11"/>
          <path d="m10 7.5 11 6.5v7"/>
        </svg>
      </div>
      <div>
        <div class="brand-name">CloudAI</div>
        <div class="brand-sub">Your intelligent workspace</div>
      </div>
    </div>
    <div class="side-actions">
      <button class="btn primary" id="newChat">＋ New conversation</button>
      <button class="btn" id="studioToggle">▤ Studio Mode</button>
    </div>
    <div class="search-wrap">
      <input id="historySearch" placeholder="Search conversations…">
    </div>
    <div class="section-label">
      <span>Conversations</span>
      <span id="historyCount">0</span>
    </div>
    <div class="bulk-bar" id="bulkBar">
      <span id="bulkCount">0 selected</span>
      <button class="btn" id="bulkDelete">Delete</button>
      <button class="btn" id="bulkCancel">Cancel</button>
    </div>
    <div class="conversation-list" id="conversationList">
      <div class="empty-history">Your conversations will appear here.</div>
    </div>
    <div class="sidebar-bottom">
      <button class="btn" id="openSettings">Settings</button>
      <button class="btn" id="exportAll">Export conversation</button>
      <div class="profile">
        <div class="profile-avatar">C</div>
        <div class="profile-info">
          <strong>CloudAI</strong>
          <small id="profileStatus">Connecting…</small>
        </div>
        <button class="btn icon" id="lockButton" title="Lock session">↗</button>
      </div>
    </div>
  </aside>

  <main class="main">
    <header class="topbar">
      <div class="top-left">
        <button class="btn icon mobile-menu" id="menuButton">☰</button>
        <button class="btn icon desktop-only" id="sidebarToggle" title="Toggle sidebar">◧</button>
        <select class="model-select" id="modelSelect">
          <option value="auto">Auto</option>
          <option value="fast">Fast · GPT OSS 20B</option>
          <option value="powerful">Powerful · GPT OSS 120B</option>
          <option value="qwen">Vision · Qwen</option>
        </select>
        <select class="personality-select" id="personalitySelect">
          <option value="default">Default</option>
          <option value="tutor">Tutor</option>
          <option value="engineer">Engineer</option>
          <option value="coder">Coder</option>
          <option value="writer">Writer</option>
          <option value="researcher">Researcher</option>
        </select>
      </div>
      <div class="top-right">
        <div class="status">
          <span class="status-dot"></span>
          <span id="connectionStatus">Connecting</span>
        </div>
        <button class="btn icon desktop-only" id="themeQuick" title="Cycle theme">◐</button>
        <button class="btn icon" id="settingsQuick" title="Settings">⚙</button>
      </div>
    </header>

    <section class="chat-scroll" id="chatScroll">
      <div class="chat-inner">
        <div class="welcome" id="welcome">
          <div class="welcome-logo">
            <svg viewBox="0 0 32 32">
              <path d="M5 10.5 16 4l11 6.5v11L16 28 5 21.5z"/>
              <path d="m5 10.5 11 6.5 11-6.5M16 17v11"/>
              <path d="m10 7.5 11 6.5v7"/>
            </svg>
          </div>
          <h1>Think beyond with <span class="gradient-text">CloudAI.</span></h1>
          <p>Your personal workspace for ideas, engineering, programming, research, and everything in between.</p>
          <div class="suggestions">
            <button class="suggestion" data-prompt="Teach me something interesting.">
              <b>Learn something</b><br><small>Explore a new concept with a tutor.</small>
            </button>
            <button class="suggestion" data-prompt="Help me design a software project.">
              <b>Build something</b><br><small>Plan and engineer a new project.</small>
            </button>
            <button class="suggestion" data-prompt="Write a small program and explain it.">
              <b>Write code</b><br><small>Create and understand a program.</small>
            </button>
            <button class="suggestion" data-prompt="Help me organize my ideas.">
              <b>Organize ideas</b><br><small>Turn scattered thoughts into a plan.</small>
            </button>
          </div>
        </div>
        <div class="messages" id="messages"></div>
      </div>
    </section>
    <section class="studio" id="studio">
      <aside class="studio-files">
        <h3>Project files</h3>
        <div id="studioFileList"></div>
        <button class="btn" id="studioNewFile">＋ New file</button>
      </aside>
      <div class="studio-workspace">
        <div class="studio-editor">
          <div class="studio-toolbar">
            <span id="studioFileName">No file selected</span>
            <div>
              <button class="btn" id="studioSave">Save</button>
              <button class="btn" id="studioClose">Exit</button>
            </div>
          </div>
          <textarea id="studioEditor" spellcheck="false" placeholder="Select or create a project file..."></textarea>
        </div>
        <div class="studio-terminal">
          <div class="terminal-head">
            <span>CloudAI Terminal · simulated environment</span>
            <button class="btn" id="terminalClear">Clear</button>
          </div>
          <div id="terminalOutput">CloudAI Studio Environment\nType "help" to see available commands.</div>
          <div class="terminal-input-row">
            <span>studio $</span>
            <input id="terminalInput" autocomplete="off" spellcheck="false">
          </div>
        </div>
      </div>
    </section>

    <section class="composer-area">
      <div class="voice-bar" id="voiceBar">
        <span id="voiceStatus">Listening…</span>
        <button id="stopVoice">Stop</button>
      </div>
      <div class="composer">
        <div class="resource-area" id="resourceArea"></div>
        <div class="attach-preview" id="attachPreview">
          <img id="previewImage" alt="Image preview">
          <span id="previewName"></span>
          <button id="removeImage">Remove</button>
        </div>
        <textarea id="prompt" placeholder="Message CloudAI…" rows="2"></textarea>
        <div class="composer-bottom">
          <div class="compose-left">
            <button class="tool-btn" id="attachButton" title="Attach image">＋</button>
            <button class="tool-btn" id="resourceButton" title="Paste resource">▤</button>
            <button class="tool-btn" id="fileButton" title="Attach text file">▧</button>
            <button class="tool-btn" id="micButton" title="Voice input">◖</button>
            <button class="tool-btn" id="speakToggle" title="Automatic read aloud">◗</button>
            <span id="tokenEstimate" style="font-size:9px;color:var(--muted)">0 tokens</span>
          </div>
          <div class="compose-right">
            <span id="charCount" style="font-size:9px;color:var(--muted)">0</span>
            <button class="send-btn" id="sendButton" title="Send">↑</button>
          </div>
        </div>
      </div>
      <div style="text-align:center;color:var(--muted);font-size:9px;margin-top:9px">
        CloudAI can make mistakes. Check important information.
      </div>
    </section>
  </main>
</div>
<div class="auth-screen" id="authScreen">
  <form class="auth-card" id="authForm">
    <div class="logo">
      <svg viewBox="0 0 32 32">
        <path d="M5 10.5 16 4l11 6.5v11L16 28 5 21.5z"/>
        <path d="m5 10.5 11 6.5 11-6.5M16 17v11"/>
        <path d="m10 7.5 11 6.5v7"/>
      </svg>
    </div>
    <h1>Welcome to CloudAI</h1>
    <p>Connect to your private AI workspace.</p>
    <label for="passwordInput">Workspace password</label>
    <div class="auth-password-row">
      <input id="passwordInput" type="password" autocomplete="current-password">
      <button type="button" class="btn" id="togglePassword">Show</button>
    </div>
    <div class="auth-error" id="authError"></div>
    <button class="btn primary" type="submit" style="width:100%">Connect to CloudAI</button>
  </form>
</div>

<div class="modal-backdrop" id="settingsModal">
  <div class="modal">
    <div class="modal-head">
      <h2>CloudAI Settings</h2>
      <button class="modal-close" data-close="settingsModal">×</button>
    </div>
    <div class="setting">
      <label>Appearance</label>
      <p>Choose your workspace atmosphere.</p>
      <div class="theme-grid">
        <button class="theme-choice" data-theme-choice="dark">Ocean</button>
        <button class="theme-choice" data-theme-choice="midnight">Midnight</button>
        <button class="theme-choice" data-theme-choice="dracula">Dracula</button>
        <button class="theme-choice" data-theme-choice="sakura">Sakura</button>
        <button class="theme-choice" data-theme-choice="walnut">Walnut</button>
        <button class="theme-choice" data-theme-choice="forest">Forest</button>
        <button class="theme-choice" data-theme-choice="light">Daylight</button>
      </div>
    </div>
    <div class="setting">
      <label for="tabTitle">Browser tab title</label>
      <input id="tabTitle" maxlength="60" value="CloudAI">
    </div>
    <div class="setting">
      <label for="tabIcon">Browser tab icon URL</label>
      <input id="tabIcon" placeholder="Leave empty to use the CloudAI icon">
    </div>
    <div class="setting">
      <label>Interface sounds</label>
      <button class="btn" id="soundSwitch">Sounds enabled</button>
    </div>
    <div class="setting">
      <label for="speechVoice">Speech voice</label>
      <select id="speechVoice"><option value="">System default</option></select>
    </div>
    <div class="setting">
      <label for="speechRate">Speech speed</label>
      <input id="speechRate" type="range" min=".7" max="1.4" step=".05" value="1">
    </div>
    <div class="setting">
      <label>Session security</label>
      <button class="btn" id="forgetPassword">Lock and clear password</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="resourceModal">
  <div class="modal">
    <div class="modal-head">
      <h2>Add a resource</h2>
      <button class="modal-close" data-close="resourceModal">×</button>
    </div>
    <div class="setting">
      <label for="resourceName">Resource name</label>
      <input id="resourceName" placeholder="example.cpp">
    </div>
    <div class="setting">
      <label for="resourceContent">Resource contents</label>
      <textarea id="resourceContent" rows="12" style="width:100%;resize:vertical;background:var(--input);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:11px;font:12px/1.5 monospace"></textarea>
    </div>
    <button class="btn primary" id="addResource" style="width:100%">Add resource</button>
  </div>
</div>

<div class="context-menu" id="chatContextMenu">
  <button data-action="rename">Rename conversation</button>
  <button data-action="export">Export conversation</button>
  <button data-action="select">Select conversation</button>
  <button data-action="delete" class="danger">Delete conversation</button>
</div>

<div class="toast" id="toast"></div>
<input type="file" id="imageInput" accept="image/png,image/jpeg,image/webp" hidden>
<input type="file" id="resourceInput" hidden>
\`;
