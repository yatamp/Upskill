// ── AI Learning Agent ────────────────────────────────────────
// Floating chat widget powered by Puter.js (free, no API key needed)
// Puter provides Claude access from static sites at no cost

(function () {
  'use strict';

  // Detect page topic from title
  function getPageContext() {
    const title = document.title || '';
    if (title.includes('Dashboard') || title.includes('Upskill')) return 'DevOps and Platform Engineering learning dashboard';
    return title.replace(' — Upskill', '').trim();
  }

  const SYSTEM_PROMPT = `You are an expert technical mentor helping a Senior Platform Engineer at Yahoo deepen their understanding of technology.

Their stack: Go, Kafka, Kubernetes, Terraform, Docker, Prometheus, Grafana, Datadog, gRPC, Redis, PostgreSQL, Python, GitHub Actions, Helm, AWS.

Current page topic: "${getPageContext()}"

Rules:
- Go deep — internals, not just surface. Explain WHY things work, not just HOW to use them.
- Use concrete examples. Show code when it helps.
- Connect to their production experience (large-scale distributed systems, 300K+ events/day, Yahoo-scale).
- If they ask about a concept, explain from first principles then build up.
- Be concise but thorough. No filler.
- Format with markdown when helpful (code blocks, lists, headers).`;

  let messages = [];
  let puterLoaded = false;
  let isOpen = false;

  // ── Build DOM ─────────────────────────────────────────────

  function buildWidget() {
    const widget = document.createElement('div');
    widget.id = 'ai-agent-widget';
    widget.innerHTML = `
      <button id="ai-agent-fab" title="Ask AI mentor">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Ask AI</span>
      </button>

      <div id="ai-agent-panel">
        <div id="ai-agent-header">
          <div id="ai-agent-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
            </svg>
            AI Mentor
            <span id="ai-agent-topic">${getPageContext()}</span>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button id="ai-agent-clear" title="Clear chat">↺</button>
            <button id="ai-agent-close" title="Close">✕</button>
          </div>
        </div>

        <div id="ai-agent-messages">
          <div class="ai-msg ai-msg--assistant">
            <div class="ai-msg-bubble">
              Ask me anything about <strong>${getPageContext()}</strong> — concepts, internals, real-world use, or how something works under the hood.
            </div>
          </div>
        </div>

        <div id="ai-agent-input-area">
          <textarea id="ai-agent-input" placeholder="e.g. how does Kafka rebalancing actually work?" rows="1"></textarea>
          <button id="ai-agent-send" title="Send (Enter)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
        <div id="ai-agent-footer">Powered by Puter AI · Free · No key needed</div>
      </div>
    `;
    document.body.appendChild(widget);
    injectStyles();
    bindEvents();
  }

  // ── Events ────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('ai-agent-fab').addEventListener('click', togglePanel);
    document.getElementById('ai-agent-close').addEventListener('click', closePanel);
    document.getElementById('ai-agent-clear').addEventListener('click', clearChat);
    document.getElementById('ai-agent-send').addEventListener('click', sendMessage);

    const input = document.getElementById('ai-agent-input');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    document.getElementById('ai-agent-panel').classList.add('open');
    document.getElementById('ai-agent-input').focus();
    if (!puterLoaded) loadPuter();
  }

  function closePanel() {
    isOpen = false;
    document.getElementById('ai-agent-panel').classList.remove('open');
  }

  function clearChat() {
    messages = [];
    document.getElementById('ai-agent-messages').innerHTML = `
      <div class="ai-msg ai-msg--assistant">
        <div class="ai-msg-bubble">Chat cleared. Ask me anything about <strong>${getPageContext()}</strong>.</div>
      </div>`;
  }

  // ── Puter loading ─────────────────────────────────────────

  function loadPuter() {
    if (window.puter) { puterLoaded = true; return; }
    const s = document.createElement('script');
    s.src = 'https://js.puter.com/v2/';
    s.onload = () => { puterLoaded = true; };
    document.head.appendChild(s);
  }

  // ── Messaging ─────────────────────────────────────────────

  async function sendMessage() {
    const input = document.getElementById('ai-agent-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });

    const thinkingId = appendThinking();
    const sendBtn = document.getElementById('ai-agent-send');
    sendBtn.disabled = true;

    try {
      // Wait for puter to be available
      let attempts = 0;
      while (!window.puter && attempts < 30) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
      if (!window.puter) throw new Error('AI not loaded yet — please try again in a moment.');

      // Build prompt: system + history (last 6 turns to keep context)
      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${history}`;

      const response = await window.puter.ai.chat(fullPrompt, {
        model: 'claude-3-5-sonnet',
        stream: false,
      });

      removeThinking(thinkingId);
      const reply = (typeof response === 'string') ? response : (response?.message?.content?.[0]?.text || response?.text || JSON.stringify(response));
      messages.push({ role: 'assistant', content: reply });
      appendMessage('assistant', reply);

    } catch (err) {
      removeThinking(thinkingId);
      appendMessage('assistant', `Sorry, couldn't get a response: ${err.message}.\n\nIf this is your first time, Puter may ask you to log in once — it's free.`);
    }

    sendBtn.disabled = false;
    input.focus();
  }

  function appendMessage(role, text) {
    const messages_el = document.getElementById('ai-agent-messages');
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg--${role}`;
    div.innerHTML = `<div class="ai-msg-bubble">${formatMessage(text)}</div>`;
    messages_el.appendChild(div);
    messages_el.scrollTop = messages_el.scrollHeight;
    return div.id;
  }

  function appendThinking() {
    const id = 'thinking_' + Date.now();
    const messages_el = document.getElementById('ai-agent-messages');
    const div = document.createElement('div');
    div.id = id;
    div.className = 'ai-msg ai-msg--assistant';
    div.innerHTML = '<div class="ai-msg-bubble ai-thinking"><span></span><span></span><span></span></div>';
    messages_el.appendChild(div);
    messages_el.scrollTop = messages_el.scrollHeight;
    return id;
  }

  function removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function formatMessage(text) {
    // Basic markdown: code blocks, inline code, bold, line breaks
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="ai-code"><code>${code.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h4>$1</h4>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // ── Styles ────────────────────────────────────────────────

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ai-agent-widget { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999; font-family: inherit; }

      #ai-agent-fab {
        display: flex; align-items: center; gap: 0.5rem;
        background: var(--accent, #6366f1); color: #fff;
        border: none; border-radius: 50px; padding: 0.6rem 1.1rem;
        font-size: 0.82rem; font-weight: 600; cursor: pointer;
        box-shadow: 0 4px 18px rgba(99,102,241,0.45);
        transition: transform 0.15s, box-shadow 0.15s;
      }
      #ai-agent-fab:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(99,102,241,0.6); }

      #ai-agent-panel {
        position: fixed; bottom: 5.5rem; right: 1.5rem;
        width: 380px; max-width: calc(100vw - 2rem);
        height: 520px; max-height: calc(100vh - 8rem);
        background: #1a1d27; border: 1px solid #2d3148;
        border-radius: 14px; display: flex; flex-direction: column;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        transform: translateY(12px) scale(0.97); opacity: 0;
        pointer-events: none; transition: transform 0.2s ease, opacity 0.2s ease;
        overflow: hidden;
      }
      #ai-agent-panel.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: all; }

      #ai-agent-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75rem 1rem; background: #12141e;
        border-bottom: 1px solid #2d3148; flex-shrink: 0;
      }
      #ai-agent-title {
        display: flex; align-items: center; gap: 0.5rem;
        font-size: 0.82rem; font-weight: 600; color: #e2e8f0;
      }
      #ai-agent-topic {
        font-size: 0.7rem; color: #6366f1; background: rgba(99,102,241,0.12);
        padding: 0.1rem 0.5rem; border-radius: 4px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis; max-width: 140px;
      }
      #ai-agent-close, #ai-agent-clear {
        background: none; border: none; color: #64748b;
        cursor: pointer; font-size: 0.9rem; padding: 0.2rem 0.4rem;
        border-radius: 4px; transition: color 0.15s;
        line-height: 1;
      }
      #ai-agent-close:hover { color: #e2e8f0; }
      #ai-agent-clear:hover { color: #22d3ee; }

      #ai-agent-messages {
        flex: 1; overflow-y: auto; padding: 0.85rem;
        display: flex; flex-direction: column; gap: 0.65rem;
        scrollbar-width: thin; scrollbar-color: #2d3148 transparent;
      }
      .ai-msg { display: flex; }
      .ai-msg--user { justify-content: flex-end; }
      .ai-msg--assistant { justify-content: flex-start; }
      .ai-msg-bubble {
        max-width: 88%; padding: 0.65rem 0.85rem;
        border-radius: 12px; font-size: 0.82rem; line-height: 1.55;
        color: #e2e8f0;
      }
      .ai-msg--user .ai-msg-bubble {
        background: #6366f1; border-radius: 12px 12px 3px 12px;
      }
      .ai-msg--assistant .ai-msg-bubble {
        background: #12141e; border: 1px solid #2d3148;
        border-radius: 12px 12px 12px 3px;
      }
      .ai-code {
        background: #0f1117; border: 1px solid #2d3148;
        border-radius: 6px; padding: 0.6rem 0.75rem;
        font-size: 0.76rem; overflow-x: auto;
        margin: 0.4rem 0; font-family: 'JetBrains Mono', 'Fira Code', monospace;
        white-space: pre;
      }
      .ai-inline-code {
        background: #0f1117; border: 1px solid #2d3148;
        padding: 0.1rem 0.35rem; border-radius: 3px;
        font-size: 0.78rem; font-family: monospace;
      }
      .ai-msg-bubble h4 { margin: 0.5rem 0 0.25rem; font-size: 0.85rem; color: #a5b4fc; }
      .ai-msg-bubble ul { margin: 0.3rem 0 0.3rem 1rem; padding: 0; }
      .ai-msg-bubble li { margin-bottom: 0.2rem; }

      .ai-thinking { display: flex; align-items: center; gap: 4px; padding: 0.65rem 0.85rem !important; }
      .ai-thinking span {
        width: 6px; height: 6px; background: #6366f1;
        border-radius: 50%; animation: ai-bounce 1.2s infinite;
      }
      .ai-thinking span:nth-child(2) { animation-delay: 0.2s; }
      .ai-thinking span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes ai-bounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

      #ai-agent-input-area {
        display: flex; gap: 0.5rem; align-items: flex-end;
        padding: 0.65rem 0.85rem; border-top: 1px solid #2d3148;
        background: #12141e; flex-shrink: 0;
      }
      #ai-agent-input {
        flex: 1; background: #1a1d27; border: 1px solid #2d3148;
        border-radius: 8px; color: #e2e8f0; padding: 0.5rem 0.75rem;
        font-size: 0.82rem; resize: none; font-family: inherit;
        line-height: 1.5; min-height: 36px; max-height: 120px;
        transition: border-color 0.15s;
      }
      #ai-agent-input:focus { outline: none; border-color: #6366f1; }
      #ai-agent-input::placeholder { color: #4b5563; }
      #ai-agent-send {
        background: #6366f1; border: none; border-radius: 8px;
        padding: 0.5rem 0.6rem; color: #fff; cursor: pointer;
        transition: background 0.15s; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      #ai-agent-send:hover { background: #4f46e5; }
      #ai-agent-send:disabled { background: #374151; cursor: not-allowed; }
      #ai-agent-footer {
        text-align: center; font-size: 0.65rem; color: #374151;
        padding: 0.3rem; background: #12141e;
      }

      @media (max-width: 480px) {
        #ai-agent-panel { right: 0.5rem; left: 0.5rem; width: auto; }
        #ai-agent-widget { right: 1rem; bottom: 1rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Boot ──────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
