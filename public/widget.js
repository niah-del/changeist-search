/**
 * Changeist Community Search Widget
 * Embed on any site with:
 *
 *   <div id="changeist-search"></div>
 *   <script src="https://your-domain.com/widget.js" data-api-key="YOUR_KEY"></script>
 *
 * Optional attributes on the <script> tag:
 *   data-api-url    — override the API base URL (default: same origin as widget.js)
 *   data-placeholder — chat input placeholder text
 *   data-theme      — "light" (default) or "dark"
 */
(function () {
  'use strict';

  // --- Read config from the script tag itself ---
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) {
        return scripts[i];
      }
    }
    return scripts[scripts.length - 1];
  })();

  var API_KEY = scriptTag.getAttribute('data-api-key') || '';
  var PLACEHOLDER = scriptTag.getAttribute('data-placeholder') || 'What kind of opportunity are you looking for?';
  var THEME = scriptTag.getAttribute('data-theme') || 'light';

  var scriptSrc = scriptTag.src || '';
  var API_BASE = scriptTag.getAttribute('data-api-url') ||
    (scriptSrc ? scriptSrc.replace(/\/widget\.js.*$/, '') : '');

  // --- Inject stylesheet ---
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = API_BASE + '/widget.css';
  document.head.appendChild(link);

  // --- Init with retry (Squarespace injects code block HTML *after* running scripts) ---
  function init() {
    var container = document.getElementById('changeist-search');
    if (container) {
      mount(container);
      return;
    }
    var attempts = 0;
    var interval = setInterval(function () {
      attempts++;
      var c = document.getElementById('changeist-search');
      if (c) {
        clearInterval(interval);
        mount(c);
      } else if (attempts >= 30) {
        clearInterval(interval);
        console.warn('[Changeist] No element with id="changeist-search" found after 3s.');
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function mount(container) {
    container.setAttribute('data-cg-theme', THEME);

    // --- Build the chat widget HTML ---
    container.innerHTML =
      '<div class="cg-widget cg-chat">' +
        '<div class="cg-messages" role="log" aria-live="polite" aria-label="Conversation"></div>' +
        '<div class="cg-chat-form-wrap">' +
          '<form class="cg-chat-form" role="form">' +
            '<input class="cg-chat-input" type="text" autocomplete="off" ' +
                   'placeholder="' + escapeAttr(PLACEHOLDER) + '" aria-label="Message" />' +
            '<button class="cg-chat-btn" type="submit" aria-label="Send">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
            '</button>' +
          '</form>' +
        '</div>' +
        '<div class="cg-footer">' +
          '<a class="cg-powered" href="https://changeist.org" target="_blank" rel="noopener">Powered by Changeist</a>' +
        '</div>' +
      '</div>';

    var form = container.querySelector('.cg-chat-form');
    var input = container.querySelector('.cg-chat-input');
    var messagesEl = container.querySelector('.cg-messages');
    var sendBtn = container.querySelector('.cg-chat-btn');

    // Conversation history (sent to API on each turn)
    var messages = [];
    var isLoading = false;

    // --- Show welcome message (display-only, not pushed to messages[]) ---
    appendAssistantMessage(
      'Hi! I\'m here to help you find volunteer opportunities, jobs, internships, and events. ' +
      'Tell me what you\'re interested in — and where you\'re based if location matters!'
    );

    // --- Form submit ---
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || isLoading) return;
      input.value = '';
      sendMessage(text);
    });

    // --- Send a message ---
    function sendMessage(userText) {
      isLoading = true;
      sendBtn.disabled = true;

      messages.push({ role: 'user', content: userText });
      appendUserMessage(userText);
      showTypingIndicator();

      fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: API_KEY, messages: messages }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Chat request failed (' + res.status + ')');
          return res.json();
        })
        .then(function (data) {
          hideTypingIndicator();
          var reply = data.message || '';
          messages.push({ role: 'assistant', content: reply });
          appendAssistantMessage(reply);
          isLoading = false;
          sendBtn.disabled = false;
        })
        .catch(function (err) {
          hideTypingIndicator();
          appendErrorMessage();
          console.error('[Changeist]', err);
          // Remove the failed user message from history so user can retry
          messages.pop();
          isLoading = false;
          sendBtn.disabled = false;
        });
    }

    // --- Message rendering ---
    function appendUserMessage(text) {
      var el = document.createElement('div');
      el.className = 'cg-msg cg-msg--user';
      el.textContent = text;
      messagesEl.appendChild(el);
      scrollToBottom();
    }

    function appendAssistantMessage(text) {
      var el = document.createElement('div');
      el.className = 'cg-msg cg-msg--assistant';
      el.innerHTML = markdownLinksToHtml(text);
      messagesEl.appendChild(el);
      scrollToBottom();
    }

    function appendErrorMessage() {
      var el = document.createElement('div');
      el.className = 'cg-msg cg-msg--error';
      el.textContent = 'Something went wrong. Please try again.';
      messagesEl.appendChild(el);
      scrollToBottom();
    }

    // --- Typing indicator ---
    function showTypingIndicator() {
      var el = document.createElement('div');
      el.className = 'cg-msg cg-msg--assistant cg-msg--typing';
      el.id = 'cg-typing';
      el.innerHTML =
        '<span class="cg-dot"></span>' +
        '<span class="cg-dot"></span>' +
        '<span class="cg-dot"></span>';
      messagesEl.appendChild(el);
      scrollToBottom();
    }

    function hideTypingIndicator() {
      var el = document.getElementById('cg-typing');
      if (el) el.parentNode.removeChild(el);
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // --- Convert [title](url) Markdown links to safe HTML ---
    // Splits text on link patterns, escapes plain text segments,
    // validates URLs start with http/https to block javascript: injection.
    function markdownLinksToHtml(text) {
      var parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
      return parts.map(function (part) {
        var m = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (m) {
          return '<a href="' + escapeAttr(m[2]) + '" target="_blank" rel="noopener">' +
                 escapeHtml(m[1]) + '</a>';
        }
        return escapeHtml(part).replace(/\n/g, '<br>');
      }).join('');
    }

    // --- Utilities ---
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/"/g, '&quot;');
    }
  } // end mount()
})();
