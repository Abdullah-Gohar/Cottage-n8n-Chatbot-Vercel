/* ============================================================
   Compact Cottages Chat Widget Loader
   ------------------------------------------------------------
   Embed with one line (place before </body>):

   <script src="https://<chat-host>/loader.js" defer
     data-page="homes"
     data-teaser="Want the spec sheet and price for one of these models?"
     data-teaser-delay="15"></script>

   Attributes (all optional):
     data-page         page slug sent to the bot as metadata.page and
                       used to pick page-aware quick replies
     data-teaser       proactive teaser text; omit for no teaser
     data-teaser-delay seconds before the teaser appears (default 15)
     data-exit-teaser  exit-intent teaser text; omit to use the default;
                       set to "off" to disable exit intent
     data-position     "bottom-right" (default) or "bottom-left"

   Session frequency caps (sessionStorage, cleared when tab closes):
     cc_chat_teaser_shown  timed teaser shown once per session
     cc_chat_exit_shown    exit-intent teaser shown once per session
     cc_chat_open          "1" while the panel is open, so the widget
                           reopens across page navigations
     cc_chat_engaged       "1" once the visitor has opened the chat;
                           suppresses all further proactive nudges
   ============================================================ */
(function () {
    'use strict';

    if (window.__ccChatLoaded) return;
    window.__ccChatLoaded = true;

    var script = document.currentScript;
    var BASE = (function () {
        try { return new URL(script.src).origin; }
        catch (e) { return 'https://project-3tqzk.vercel.app'; }
    })();

    var PAGE = (script && script.getAttribute('data-page')) || '';
    var TEASER = (script && script.getAttribute('data-teaser')) || '';
    var TEASER_DELAY = parseInt((script && script.getAttribute('data-teaser-delay')) || '15', 10) * 1000;
    var EXIT_TEASER_ATTR = (script && script.getAttribute('data-exit-teaser')) || '';
    var EXIT_TEASER = EXIT_TEASER_ATTR === 'off' ? '' :
        (EXIT_TEASER_ATTR || 'Before you go: want a quick answer on cost or fit? It takes two minutes.');
    var POSITION = (script && script.getAttribute('data-position')) === 'bottom-left' ? 'left' : 'right';
    var LABEL = 'Chat with a cottage specialist';

    var SS = {
        get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } },
        del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { } }
    };

    var isOpen = false;
    var iframe = null;
    var teaserTimer = null;

    /* ── styles ─────────────────────────────────────────────── */
    var css = '' +
        '.cc-chat-launcher{position:fixed;bottom:20px;' + POSITION + ':20px;z-index:999990;' +
        'display:flex;align-items:center;gap:10px;flex-direction:' + (POSITION === 'right' ? 'row-reverse' : 'row') + ';' +
        'cursor:pointer;border:none;background:transparent;padding:0;-webkit-tap-highlight-color:transparent;}' +

        '.cc-chat-bubble{width:58px;height:58px;border-radius:999px;background:#C97A50;' +
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
        'box-shadow:0 12px 40px rgba(42,38,34,0.24);transition:background .2s,transform .15s;}' +
        '.cc-chat-launcher:hover .cc-chat-bubble{background:#A85D38;transform:translateY(-2px);}' +
        '.cc-chat-bubble svg{width:26px;height:26px;fill:#fff;}' +
        '.cc-chat-bubble.cc-chat-attention{animation:cc-chat-nudge 1.1s ease 1.5s 2;}' +
        '@keyframes cc-chat-nudge{0%,100%{transform:translateY(0)}20%{transform:translateY(-5px)}40%{transform:translateY(0)}60%{transform:translateY(-3px)}80%{transform:translateY(0)}}' +

        '.cc-chat-label{background:#FFFCF5;color:#A85D38;border:1px solid #DDD3BF;border-radius:999px;' +
        'font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
        'font-size:12.5px;font-weight:600;letter-spacing:.3px;padding:10px 16px;white-space:nowrap;' +
        'box-shadow:0 2px 8px rgba(42,38,34,0.10);}' +

        '.cc-chat-teaser{position:fixed;bottom:92px;' + POSITION + ':20px;z-index:999990;max-width:290px;' +
        'background:#FFFCF5;color:#2A2622;border:1px solid #DDD3BF;border-radius:14px 14px ' +
        (POSITION === 'right' ? '4px 14px' : '14px 4px') + ';' +
        'font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
        'font-size:13.5px;line-height:1.55;padding:14px 34px 14px 16px;cursor:pointer;' +
        'box-shadow:0 12px 40px rgba(42,38,34,0.18);animation:cc-chat-rise .35s ease;}' +
        '@keyframes cc-chat-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
        '.cc-chat-teaser-close{position:absolute;top:6px;' + (POSITION === 'right' ? 'right' : 'left') + ':8px;' +
        'background:transparent;border:none;cursor:pointer;padding:4px;line-height:0;}' +
        '.cc-chat-teaser-close svg{width:12px;height:12px;stroke:#8A8175;stroke-width:2.4;fill:none;}' +
        '.cc-chat-teaser-close:hover svg{stroke:#2A2622;}' +

        '.cc-chat-panel{position:fixed;bottom:92px;' + POSITION + ':20px;z-index:999995;' +
        'width:380px;height:min(600px,calc(100vh - 112px));max-width:calc(100vw - 40px);' +
        'border:1px solid #DDD3BF;border-radius:14px;overflow:hidden;background:#F5F1EA;' +
        'box-shadow:0 12px 40px rgba(42,38,34,0.24);display:none;animation:cc-chat-rise .3s ease;}' +
        '.cc-chat-panel.cc-chat-open{display:block;}' +
        '.cc-chat-panel iframe{width:100%;height:100%;border:0;display:block;}' +

        '@media (max-width:767px){' +
        '.cc-chat-panel{bottom:0;' + POSITION + ':0;width:100vw;height:100dvh;max-width:none;border-radius:0;border:none;}' +
        '}' +
        '@media (max-width:480px){.cc-chat-label{display:none;}}';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    /* ── launcher ───────────────────────────────────────────── */
    var launcher = document.createElement('button');
    launcher.className = 'cc-chat-launcher';
    launcher.setAttribute('aria-label', 'Open chat');
    launcher.innerHTML =
        '<span class="cc-chat-bubble' + (SS.get('cc_chat_engaged') ? '' : ' cc-chat-attention') + '">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 4h16c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H8l-4 4V6c0-1.1.9-2 2-2zm3 5.5c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm4 0c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm4 0c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1z"/>' +
        '</svg></span>' +
        '<span class="cc-chat-label">' + LABEL + '</span>';
    launcher.addEventListener('click', function () { toggle(); });

    var panel = document.createElement('div');
    panel.className = 'cc-chat-panel';

    function mount() {
        document.body.appendChild(launcher);
        document.body.appendChild(panel);

        // Reopen across page navigations within the same tab.
        if (SS.get('cc_chat_open') === '1') {
            open(true);
        } else {
            armTeaser();
            armExitIntent();
        }
    }

    /* ── panel open/close ───────────────────────────────────── */
    function ensureIframe() {
        if (iframe) return;
        iframe = document.createElement('iframe');
        iframe.src = BASE + '/?embed=1' + (PAGE ? '&page=' + encodeURIComponent(PAGE) : '');
        iframe.title = 'Compact Cottages chat';
        iframe.setAttribute('allow', 'clipboard-write');
        panel.appendChild(iframe);
    }

    function open(restored) {
        ensureIframe();
        removeTeaser();
        panel.classList.add('cc-chat-open');
        isOpen = true;
        SS.set('cc_chat_open', '1');
        SS.set('cc_chat_engaged', '1');
        var bubble = launcher.querySelector('.cc-chat-bubble');
        if (bubble) bubble.classList.remove('cc-chat-attention');
        launcher.setAttribute('aria-label', 'Close chat');
        if (!restored) notifyOpened();
        else iframe.addEventListener('load', notifyOpened, { once: true });
    }

    function notifyOpened() {
        try { iframe.contentWindow.postMessage({ type: 'cc-chat-opened' }, BASE); } catch (e) { }
    }

    function close() {
        panel.classList.remove('cc-chat-open');
        isOpen = false;
        SS.del('cc_chat_open');
        launcher.setAttribute('aria-label', 'Open chat');
    }

    function toggle() { isOpen ? close() : open(); }

    window.addEventListener('message', function (e) {
        if (e.origin !== BASE) return;
        if (e.data && e.data.type === 'cc-chat-close') close();
    });

    /* ── proactive teaser ───────────────────────────────────── */
    var teaserEl = null;

    function showTeaser(text, capKey) {
        if (isOpen || teaserEl) return;
        if (SS.get('cc_chat_engaged')) return;
        if (SS.get(capKey)) return;
        SS.set(capKey, '1');

        teaserEl = document.createElement('div');
        teaserEl.className = 'cc-chat-teaser';
        teaserEl.setAttribute('role', 'status');
        var msg = document.createElement('span');
        msg.textContent = text;
        var x = document.createElement('button');
        x.className = 'cc-chat-teaser-close';
        x.setAttribute('aria-label', 'Dismiss');
        x.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 5l14 14M19 5L5 19"/></svg>';
        x.addEventListener('click', function (ev) {
            ev.stopPropagation();
            removeTeaser();
        });
        teaserEl.appendChild(msg);
        teaserEl.appendChild(x);
        teaserEl.addEventListener('click', function () { open(); });
        document.body.appendChild(teaserEl);
    }

    function removeTeaser() {
        if (teaserTimer) { clearTimeout(teaserTimer); teaserTimer = null; }
        if (teaserEl) { teaserEl.remove(); teaserEl = null; }
    }

    function armTeaser() {
        if (!TEASER || SS.get('cc_chat_teaser_shown') || SS.get('cc_chat_engaged')) return;
        teaserTimer = setTimeout(function () {
            showTeaser(TEASER, 'cc_chat_teaser_shown');
        }, TEASER_DELAY);
    }

    /* ── exit intent (desktop only) ─────────────────────────── */
    function armExitIntent() {
        if (!EXIT_TEASER || SS.get('cc_chat_exit_shown')) return;
        if (!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
        document.addEventListener('mouseout', function handler(e) {
            if (e.relatedTarget || e.clientY > 10) return;
            document.removeEventListener('mouseout', handler);
            removeTeaser();
            showTeaser(EXIT_TEASER, 'cc_chat_exit_shown');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
