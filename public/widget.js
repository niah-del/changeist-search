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
  var THEME = scriptTag.getAttribute('data-theme') || 'dark';

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
      '<div class="cg-widget cg-chat cg-chat--welcome">' +
        '<div class="cg-welcome">' +
          '<div class="cg-welcome-inner">' +
            '<p class="cg-welcome-hi">Hi Friend! I\'m Link 👋</p>' +
            '<p class="cg-welcome-headline">Ready to get involved? 🌟</p>' +
            '<p class="cg-welcome-sub">I\'m Changeist\'s AI guide — here to help you find amazing internships, volunteer gigs, and local events. Drop your city and interests below to see what\'s happening near you!</p>' +
          '</div>' +
        '</div>' +
        '<div class="cg-messages" role="log" aria-live="polite" aria-label="Conversation"></div>' +
        '<div class="cg-chat-form-wrap">' +
          '<form class="cg-chat-form" role="form">' +
            '<input class="cg-chat-input" type="text" autocomplete="off" ' +
                   'placeholder="' + escapeAttr(PLACEHOLDER) + '" aria-label="Message" />' +
            '<button class="cg-chat-btn" type="submit" aria-label="Send">' +
              '<img src="' + escapeAttr(API_BASE) + '/changeist-mark.png" alt="Send" class="cg-chat-btn-logo" />' +
            '</button>' +
          '</form>' +
        '</div>' +
        '<div class="cg-footer">' +
          '<a class="cg-powered" href="https://changeist.org" target="_blank" rel="noopener">Powered by Changeist</a>' +
        '</div>' +
      '</div>';

    var chatEl = container.querySelector('.cg-chat');
    var welcomeEl = container.querySelector('.cg-welcome');
    var form = container.querySelector('.cg-chat-form');
    var input = container.querySelector('.cg-chat-input');
    var messagesEl = container.querySelector('.cg-messages');
    var sendBtn = container.querySelector('.cg-chat-btn');

    // Conversation history (sent to API on each turn)
    var messages = [];
    var isLoading = false;

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

      // Transition from welcome screen to chat on first message
      if (chatEl.classList.contains('cg-chat--welcome')) {
        chatEl.classList.remove('cg-chat--welcome');
        welcomeEl.style.display = 'none';
      }

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
      el.innerHTML = markdownLinksToHtml(text) +
        '<button class="cg-copy-btn" aria-label="Copy message" title="Copy to clipboard">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          '<span class="cg-copy-label">Copy</span>' +
        '</button>';
      el.querySelector('.cg-copy-btn').addEventListener('click', function () {
        var btn = this;
        var label = btn.querySelector('.cg-copy-label');
        navigator.clipboard.writeText(text).then(function () {
          label.textContent = 'Copied!';
          btn.classList.add('cg-copy-btn--done');
          setTimeout(function () {
            label.textContent = 'Copy';
            btn.classList.remove('cg-copy-btn--done');
          }, 2000);
        });
      });
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

    // --- Markdown renderer: handles links, bold, italic, numbered + bullet lists ---
    function markdownLinksToHtml(text) {
      // Process inline formatting within a single text segment (no links)
      function inlineFormat(str) {
        return escapeHtml(str)
          .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
          .replace(/ ✓/g, ' <span class="cg-verified">Verified</span>');
      }

      // Process a segment that may contain [title](url) links + bold/italic
      function processSegment(str) {
        var parts = str.split(/(\*{0,2}\[[^\]]+\]\(https?:\/\/[^)]+\)\*{0,2})/g);
        return parts.map(function (part) {
          // Match optional ** wrapping around a markdown link
          var m = part.match(/^(\*{0,2})\[([^\]]+)\]\((https?:\/\/[^)]+)\)(\*{0,2})$/);
          if (m) {
            var bold = m[1].length === 2 || m[4].length === 2;
            var inner = escapeHtml(m[2]);
            var link = '<a href="' + escapeAttr(m[3]) + '" target="_blank" rel="noopener">' +
                       (bold ? '<strong>' + inner + '</strong>' : inner) + '</a>';
            return link;
          }
          return inlineFormat(part);
        }).join('');
      }

      var lines = text.split('\n');
      var html = '';
      var inUl = false, inOl = false;

      lines.forEach(function (line) {
        var ulM = line.match(/^[\-\*] (.+)/);
        var olM = line.match(/^\d+\. (.+)/);

        if (ulM) {
          if (inOl) { html += '</ol>'; inOl = false; }
          if (!inUl) { html += '<ul>'; inUl = true; }
          html += '<li>' + processSegment(ulM[1]) + '</li>';
        } else if (olM) {
          if (inUl) { html += '</ul>'; inUl = false; }
          if (!inOl) { html += '<ol>'; inOl = true; }
          html += '<li>' + processSegment(olM[1]) + '</li>';
        } else if (line.trim() === '') {
          // blank line inside a list = skip (keeps numbering continuous)
          // blank line outside a list = spacer
          if (!inUl && !inOl) html += '<br>';
        } else {
          if (inUl) { html += '</ul>'; inUl = false; }
          if (inOl) { html += '</ol>'; inOl = false; }
          html += '<p>' + processSegment(line) + '</p>';
        }
      });

      if (inUl) html += '</ul>';
      if (inOl) html += '</ol>';
      return html;
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
