# AGENTS.md

## Repository Safety Rules

- Do not read `.env` files or any other local secret files unless the user explicitly asks for that and makes the intent unambiguous.
- Do not print, summarize, quote, or expose secret values from environment files, tokens, API keys, cookies, or credentials.
- If code needs an environment variable such as `OPENROUTER_API_KEY`, treat it as present-or-missing configuration only. Do not inspect or reveal its value.
- Prefer documenting required environment variable names in code or README rather than opening local secret files.
- If debugging touches secret-bearing configuration, keep outputs redacted by default.
