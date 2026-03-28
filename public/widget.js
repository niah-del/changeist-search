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
  var PLACEHOLDER = scriptTag.getAttribute('data-placeholder') || 'Let\'s find something awesome!';
  var THEME = scriptTag.getAttribute('data-theme') || 'light';

  var scriptSrc = scriptTag.src || '';
  var API_BASE = scriptTag.getAttribute('data-api-url') ||
    (scriptSrc ? scriptSrc.replace(/\/widget\.js.*$/, '') : '');

  // --- Inject fonts ---
  var fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Unica+One&family=Lato:wght@400;700&display=swap';
  document.head.appendChild(fontLink);

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
            '<p class="cg-welcome-hi">Hi, Friend!</p>' +
            '<p class="cg-welcome-headline">Ready for an Adventure?</p>' +
            '<p class="cg-welcome-sub">I\'m Linkist — a link to a path!<br>Drop your age, city, and interests below, and I\'ll find the best volunteer opportunities, internships, and scholarships tailored to you.</p>' +
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
          '<div class="cg-footer-group">' +
            '<button class="cg-save-report-btn" style="display:none" aria-label="Save conversation report">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
              ' Save Report' +
            '</button>' +
            '<a class="cg-powered" href="https://changeist.org" target="_blank" rel="noopener">Powered by Changeist</a>' +
          '</div>' +
        '</div>' +
      '</div>';

    var chatEl = container.querySelector('.cg-chat');
    var welcomeEl = container.querySelector('.cg-welcome');
    var form = container.querySelector('.cg-chat-form');
    var input = container.querySelector('.cg-chat-input');
    var messagesEl = container.querySelector('.cg-messages');
    var sendBtn = container.querySelector('.cg-chat-btn');
    var saveReportBtn = container.querySelector('.cg-save-report-btn');

    saveReportBtn.addEventListener('click', function () {
      var btn = saveReportBtn;
      var reportIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Save Report';
      // Open the window immediately (must be synchronous with click to avoid popup blocker)
      var win = window.open('', '_blank');
      win.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#555;">Generating report\u2026</body></html>');
      btn.disabled = true;
      btn.textContent = 'Generating\u2026';
      fetch(API_BASE + '/api/conversation-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: API_KEY, messages: messages }),
      }).then(function (res) { return res.json(); }).then(function (data) {
        btn.disabled = false;
        btn.innerHTML = reportIcon;
        win.document.open();
        win.document.write(data.html);
        win.document.close();
        win.focus();
        setTimeout(function () { win.print(); }, 600);
      }).catch(function () {
        btn.disabled = false;
        btn.innerHTML = reportIcon;
        win.document.open();
        win.document.write('<html><body style="font-family:sans-serif;padding:40px;color:#c00;">Failed to generate report. Please try again.</body></html>');
        win.document.close();
      });
    });

    // Conversation history (sent to API on each turn)
    var messages = [];
    var isLoading = false;

    // Anonymous session tracking
    var sessionStartTime = null;
    var messageCount = 0;
    var lastUserMsgEl = null;

    // Auto-scroll: stop following if user scrolls up manually
    var autoScroll = true;
    messagesEl.addEventListener('scroll', function () {
      var distFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
      autoScroll = distFromBottom < 60;
    });

    window.addEventListener('beforeunload', function () {
      if (sessionStartTime === null || messageCount === 0) return;
      var duration = Math.round((Date.now() - sessionStartTime) / 1000);
      var payload = JSON.stringify({
        key: API_KEY,
        event_type: 'session_end',
        duration_seconds: duration,
        message_count: messageCount,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_BASE + '/api/events', new Blob([payload], { type: 'application/json' }));
      }
    });

    // --- Form submit ---
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || isLoading) return;
      input.value = '';
      sendMessage(text);
    });

    // --- Send a message ---
    // displayText is what the user sees in chat; userText is what's sent to the API.
    // If displayText is omitted, userText is shown.
    function sendMessage(userText, displayText) {
      displayText = displayText || userText;
      isLoading = true;
      sendBtn.disabled = true;
      autoScroll = true;

      // Transition from welcome screen to chat on first message
      if (chatEl.classList.contains('cg-chat--welcome')) {
        chatEl.classList.remove('cg-chat--welcome');
        welcomeEl.style.display = 'none';
      }

      if (sessionStartTime === null) sessionStartTime = Date.now();
      messageCount++;

      messages.push({ role: 'user', content: userText });
      appendUserMessage(displayText);
      showTypingIndicator();

      fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: API_KEY, messages: messages }),
      })
        .then(function (response) {
          if (!response.ok) throw new Error('Chat request failed (' + response.status + ')');
          hideTypingIndicator();

          // Build assistant message element
          var precedingUserMsg = userText;
          var row = document.createElement('div');
          row.className = 'cg-msg-row';

          var avatarEl = document.createElement('div');
          avatarEl.className = 'cg-link-avatar';
          avatarEl.textContent = 'L';

          var el = document.createElement('div');
          el.className = 'cg-msg cg-msg--assistant';

          var bodyEl = document.createElement('div');
          bodyEl.className = 'cg-msg-body';

          var actionsEl = document.createElement('div');
          actionsEl.className = 'cg-msg-actions';
          actionsEl.style.display = 'none';
          actionsEl.innerHTML =
            '<button class="cg-copy-btn" aria-label="Copy message" title="Copy to clipboard">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
              '<span class="cg-copy-label">Copy</span>' +
            '</button>' +
            '<button class="cg-share-email-btn" aria-label="Share via email" title="Share via email">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
              '<span>Email</span>' +
            '</button>' +
            '<button class="cg-share-sms-btn" aria-label="Share via text" title="Share via text">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
              '<span>Text</span>' +
            '</button>' +
            '<button class="cg-share-download-btn" aria-label="Download as file" title="Download as text file">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              '<span>Save</span>' +
            '</button>' +
            '<button class="cg-report-btn" aria-label="Report message" title="Report this response">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>' +
              '<span class="cg-report-label">Report</span>' +
            '</button>';

          var thinkingPhrases = [
            'researching…', 'meandering…', 'doodling…', 'snooping around…',
            'connecting dots…', 'doing my homework…', 'poking around…',
            'spelunking…', 'following leads…', 'asking around…',
            'on the case…', 'investigating…', 'checking the vibes…',
            'rummaging…', 'hunting it down…', 'on a quest…',
            'digging deep…', 'sniffing it out…', 'on the loose…'
          ];
          var thinkingEl = document.createElement('div');
          thinkingEl.className = 'cg-inline-thinking';
          thinkingEl.style.display = 'none';
          thinkingEl.innerHTML = '<span class="cg-thinking-text"></span>';
          var thinkingTextEl = thinkingEl.querySelector('.cg-thinking-text');
          var thinkingPhraseTimer = null;

          function startThinkingPhrases() {
            var idx = Math.floor(Math.random() * thinkingPhrases.length);
            thinkingTextEl.textContent = thinkingPhrases[idx];
            thinkingPhraseTimer = setInterval(function () {
              thinkingEl.classList.remove('cg-thinking-visible');
              setTimeout(function () {
                idx = (idx + 1) % thinkingPhrases.length;
                thinkingTextEl.textContent = thinkingPhrases[idx];
                thinkingEl.classList.add('cg-thinking-visible');
              }, 300);
            }, 2200);
          }

          function stopThinkingPhrases() {
            clearInterval(thinkingPhraseTimer);
            thinkingPhraseTimer = null;
            thinkingEl.style.display = 'none';
            thinkingEl.classList.remove('cg-thinking-visible');
          }

          var fullText = '';

          actionsEl.querySelector('.cg-copy-btn').addEventListener('click', function () {
            var btn = this;
            var label = btn.querySelector('.cg-copy-label');
            navigator.clipboard.writeText(fullText).then(function () {
              label.textContent = 'Copied!';
              btn.classList.add('cg-copy-btn--done');
              setTimeout(function () {
                label.textContent = 'Copy';
                btn.classList.remove('cg-copy-btn--done');
              }, 2000);
            });
          });

          actionsEl.querySelector('.cg-share-email-btn').addEventListener('click', function () {
            var subject = encodeURIComponent('From Linkist — Opportunity for you');
            var body = encodeURIComponent(fullText);
            window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
          });

          actionsEl.querySelector('.cg-share-sms-btn').addEventListener('click', function () {
            var body = encodeURIComponent(fullText);
            window.open('sms:?body=' + body, '_blank');
          });

          actionsEl.querySelector('.cg-share-download-btn').addEventListener('click', function () {
            var blob = new Blob([fullText], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'linkist-recommendation.txt';
            a.click();
            URL.revokeObjectURL(url);
          });

          actionsEl.querySelector('.cg-report-btn').addEventListener('click', function () {
            var btn = this;
            var label = btn.querySelector('.cg-report-label');
            btn.disabled = true;
            label.textContent = 'Reporting…';
            fetch(API_BASE + '/api/report', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: API_KEY, user_message: precedingUserMsg, assistant_message: fullText }),
            }).then(function (res) {
              label.textContent = res.ok ? 'Reported' : 'Failed';
              btn.classList.add('cg-report-btn--done');
            }).catch(function () {
              label.textContent = 'Failed';
              btn.disabled = false;
            });
          });

          el.appendChild(bodyEl);
          el.appendChild(thinkingEl);
          el.appendChild(actionsEl);
          row.appendChild(avatarEl);
          row.appendChild(el);
          messagesEl.appendChild(row);
          if (lastUserMsgEl) scrollMsgToTop(lastUserMsgEl);


          // Read SSE stream
          var reader = response.body.getReader();
          var decoder = new TextDecoder();
          var buffer = '';
          var lastEvent = '';

          function readChunk() {
            reader.read().then(function (result) {
              if (result.done) {
                return;
              }

              buffer += decoder.decode(result.value, { stream: true });
              var lines = buffer.split('\n');
              buffer = lines.pop(); // keep incomplete line

              for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.indexOf('event: ') === 0) {
                  lastEvent = line.slice(7).trim();
                } else if (line.indexOf('data: ') === 0) {
                  try {
                    var data = JSON.parse(line.slice(6));
                    if (lastEvent === 'chunk') {
                      if (thinkingEl.style.display !== 'none') stopThinkingPhrases();
                      fullText += data.text;
                      bodyEl.innerHTML = markdownLinksToHtml(fullText);
                      if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
                    } else if (lastEvent === 'thinking') {
                      thinkingEl.style.display = 'flex';
                      setTimeout(function () { thinkingEl.classList.add('cg-thinking-visible'); }, 10);
                      startThinkingPhrases();
                    } else if (lastEvent === 'done') {
                      bodyEl.innerHTML = markdownLinksToHtml(fullText);
                      actionsEl.style.display = '';
                      messages.push({ role: 'assistant', content: fullText });
                      saveReportBtn.style.display = '';
                      isLoading = false;
                      sendBtn.disabled = false;
                    } else if (lastEvent === 'error') {
                      appendErrorMessage();
                      messages.pop();
                      isLoading = false;
                      sendBtn.disabled = false;
                    }
                  } catch (e) {}
                }
              }

              readChunk();
            }).catch(function (err) {
              console.error('[Changeist]', err);
              appendErrorMessage();
              messages.pop();
              isLoading = false;
              sendBtn.disabled = false;
            });
          }

          readChunk();
        })
        .catch(function (err) {
          hideTypingIndicator();
          appendErrorMessage();
          console.error('[Changeist]', err);
          messages.pop();
          isLoading = false;
          sendBtn.disabled = false;
        });
    }

    // --- Click tracking ---
    messagesEl.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || !href.startsWith('http')) return;
      // Find listing_id by matching URL against known DB results
      // We track by sending the URL and last user query; server resolves the listing_id
      var lastUserQuery = '';
      for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') { lastUserQuery = messages[i].content; break; }
      }
      fetch(API_BASE + '/api/listing-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: API_KEY, url: href, query: lastUserQuery }),
      }).catch(function () {});
    });

    // --- Message rendering ---
    function appendUserMessage(text) {
      var el = document.createElement('div');
      el.className = 'cg-msg cg-msg--user';
      el.textContent = text;
      messagesEl.appendChild(el);
      lastUserMsgEl = el;
      scrollMsgToTop(el);
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
    }

    function hideTypingIndicator() {
      var el = document.getElementById('cg-typing');
      if (el) el.parentNode.removeChild(el);
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function scrollMsgToTop(el) {
      // offsetTop is relative to messagesEl (its nearest positioned ancestor)
      messagesEl.scrollTop = el.offsetTop - 8;
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
