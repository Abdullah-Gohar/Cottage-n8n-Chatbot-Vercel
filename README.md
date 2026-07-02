# Compact Cottages Chat Widget

Chat UI for the Compact Cottages sales chatbot (n8n backend), hosted on Vercel as a static site. Two parts:

- `index.html`: the chat app. Works standalone (full page) and inside the widget iframe (`?embed=1`). Styled to the Compact Cottages website design system (parchment / clay / teal, Playfair Display + DM Sans).
- `loader.js`: the embed script for any website. Injects a floating launcher button, an optional proactive teaser bubble, an exit-intent teaser, and the chat panel (iframe) on demand.

## Embedding on a website

Add one line before `</body>`:

```html
<script src="https://project-3tqzk.vercel.app/loader.js" defer
  data-page="homes"
  data-teaser="Want the spec sheet and price for one of these models?"
  data-teaser-delay="15"></script>
```

Attributes (all optional):

| Attribute | Purpose | Default |
|---|---|---|
| `data-page` | Page slug: sent to n8n as `metadata.page`, and picks page-aware quick replies (`homes`, `inventory`, `start`, `configure`, `land`, `study`) | none |
| `data-teaser` | Proactive teaser text next to the launcher | none (no teaser) |
| `data-teaser-delay` | Seconds before the teaser appears | `15` |
| `data-exit-teaser` | Exit-intent teaser text; `off` disables exit intent | built-in default |
| `data-position` | `bottom-right` or `bottom-left` | `bottom-right` |

Frequency caps: timed teaser and exit teaser each show at most once per browser session; all proactive nudges stop once the visitor opens the chat. The open panel persists across page navigations in the same tab.

## Chat app behavior

- Name gate first (first name only), then chat. The gate is skipped if a session from the last 24h exists.
- Greeting plus 2 or 3 quick-reply chips (page-aware); chips disappear after the first message.
- Session: `sessionId` and transcript persist in `localStorage` for 24h (`cc_chat_session`, `cc_chat_history`), so n8n memory threads continue across reloads.
- Bot replies are HTML-escaped, then a minimal markdown subset is rendered (bold, italic, links, bullet lists). No raw HTML from the webhook is ever injected.
- Widget/iframe protocol: parent sends `{type:'cc-chat-opened'}` to focus the input; the app sends `{type:'cc-chat-close'}` when the in-chat X is clicked.

## n8n contract

`POST` to the webhook (see `CONFIG.webhook` at the top of the script in `index.html`):

```json
{
  "chatInput": "message text",
  "sessionId": "session_<ts>_<rand>",
  "metadata": { "name": "FirstName", "page": "homes" }
}
```

Reply is read from `output` | `text` | `message` | `response` (or the first array element's `output`/`text`).

`metadata.page` is new and additive; n8n workflows that ignore it are unaffected.

## Notes for the backend

- The webhook is public and unauthenticated and is called directly from the browser. Recommend rate limiting / abuse protection on the n8n side.
- Replies may contain the markdown subset above; anything else renders as plain text.

## Local testing

```
npx serve .
```

Then open `index.html` (standalone app) and `test-embed.html` (fake host page exercising `loader.js`; teaser delay is shortened to 5s there).
