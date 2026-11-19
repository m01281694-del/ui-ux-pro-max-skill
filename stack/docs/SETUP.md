# Setup

## Prerequisites

- **Node 18+** and **Python 3.x**
- **Claude Code** with plugins enabled (run `/plugin` once to enable)

## 1. One-shot setup

```bash
./scripts/setup.sh
```

This installs the audit dependencies (Playwright + Chromium) and the `ui-ux-pro-max` skill,
then prints the two steps that must happen inside Claude Code.

## 2. Install the taste plugin (inside Claude Code)

```
/plugin install frontend-design@anthropics/claude-code
```

## 3. Approve the MCP servers

Open Claude Code in this directory. It reads `.mcp.json` and prompts you to approve the project
MCP servers (**playwright**, **chrome-devtools**, **shadcn**). Approve them. `.claude/settings.json`
already sets `enableAllProjectMcpServers: true`, so they load on start. Verify with `/mcp`.

That's it — `CLAUDE.md` defines the design loop and loads automatically.

## Verify it works

```
> /design-plan portfolio site for a photographer, editorial and minimal
> Build the hero, then screenshot it at 375px and 1440px and fix anything that breaks.
> /design-review http://localhost:3000
```

You should see Claude pull tokens from `ui-ux-pro-max`, open a browser, screenshot, and return
ranked findings.

## Standalone audit (no Claude needed)

```bash
npm run audit -- --url http://localhost:3000
npm run audit -- --file ./index.html
```

Outputs `audit-output/report.md` + per-viewport screenshots. Exit code is non-zero when there
are high-severity findings (useful for CI — see `.github/workflows/design-review.yml`).

---

## Optional add-ons

### Figma Dev Mode MCP
Requires the Figma desktop app. Enable Dev Mode → toggle the MCP server on. Then add to
`.mcp.json`:

```json
"figma": { "url": "http://127.0.0.1:3845/mcp" }
```

Guide: <https://help.figma.com/hc/en-us/articles/39888612464151-Claude-Code-and-Figma-Set-up-the-MCP-server>

### 21st.dev Magic MCP
Generates React components from a prompt. Get an API key at <https://21st.dev>, then add:

```json
"magic": { "command": "npx", "args": ["-y", "@21st-dev/magic@latest"], "env": { "API_KEY": "<your-key>" } }
```

Keep keys out of git — prefer `.claude/settings.local.json` or your shell env, both gitignored.

### FreeLLMAPI (free LLM endpoint for prototypes)
A self-hosted router that pools free-tier LLM providers behind one OpenAI-compatible API.
Use it when a page you are building needs live model output during prototyping (demo chatbot,
generated sample content) without paying for an API. Repo:
<https://github.com/tashfeenahmed/freellmapi> (MIT).

1. Install and start the router (Docker; read the script first if you prefer —
   it lives in the repo):
   ```bash
   curl -fsSL https://freellmapi.co/install.sh | bash
   ```
   A macOS/Windows desktop app is also available from the repo's Releases page.
2. Open <http://localhost:3001>, add your provider keys on the **Keys** page, order the
   **Fallback Chain**, and copy the unified `freellmapi-…` key from the page header.
3. Point any OpenAI-compatible client at it:
   ```bash
   export OPENAI_BASE_URL=http://localhost:3001/v1
   export OPENAI_API_KEY=freellmapi-your-unified-key   # shell env only, never commit it
   ```
   ```js
   import OpenAI from "openai";
   const client = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
   const r = await client.chat.completions.create({
     model: "auto", // let the router pick; or "auto:fast", "auto:smart", or a model id
     messages: [{ role: "user", content: "Write a one-line hero tagline for a bakery." }],
   });
   ```

**Limits:** for personal experimentation only. Free tiers have no SLA, variable latency and
daily caps (quality dips late in the UTC day), and each provider's terms of service apply.
Never call it from browser code with the key exposed — keep calls server-side — and switch to
a paid API before anything ships to real users.

## Troubleshooting

- **`/mcp` shows a server failed** — run its command manually to see the error, e.g.
  `npx -y @playwright/mcp@latest`. Usually a Node version or network/proxy issue.
- **Audit can't find Chromium** — run `npx playwright install chromium`, or set
  `PW_EXECUTABLE_PATH` to your Chromium binary.
- **FreeLLMAPI returns 429 or errors** — every provider in the chain is rate-limited; add more
  keys on the **Keys** page or wait for the daily reset (UTC midnight). Logs:
  `docker compose logs -f freellmapi`.
- **ui-ux-pro-max command not found** — re-run `npx ui-ux-pro-max-cli init --ai claude` and
  check the printed skill path; use that path in the `python3 …/search.py` commands.
