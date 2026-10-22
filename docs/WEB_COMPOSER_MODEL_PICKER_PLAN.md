# AI Assistant: the model picker in the composer

Status: in progress (2026-10-22). Branch `feature/next-update`. Follows
`WEB_DOCS_AND_MODELS_PLAN.md` §2: the providers, the encrypted keys and the routes stay as they
are; only the way you pick and set up a model changes.

## Owner's decisions

- **The composer looks like the owner's mockup.** A rounded box with the text area on top. Its
  bottom row has the model chip on the left (`● Choose a model ▾`) and, on the right, "Enter to
  send · Shift+Enter for new line" with a round send button.
- **The text stays honest.** The web assistant is read-only, so the mockup's "tell me what to
  scan" and "fixes shown as a diff" are not used:
  - placeholder: "Ask anything about your assessments…"
  - footer: "Answers use your saved assessment data. Scans and approvals stay in the terminal."
- **The picker lives in the composer only.** The header's Model button goes.
- **The chip's dot** is amber with no usable model, green when one is active. The chip then shows
  the model's name (`● claude-sonnet-5-5 ▾`).
- **Flow: provider → credentials → model.** One click on a saved model switches straight to it.
- **Credentials stay the web's own:** the encrypted `models.json`/`models.key` in the
  assistant's folder, never shared with the terminal's `/provider` list. Keys never go back to
  the browser.
- **The cloud rule stays.**
  - Cloud providers (OpenAI, Anthropic, DeepSeek, OpenRouter, Groq) work only when the server
    runs with `LLM_ALLOW_REMOTE=1`, and the browser can't switch that on.
  - Without it they are listed but disabled, with the reason: "Start the dashboard with
    LLM_ALLOW_REMOTE=1 to use cloud models".

## The picker (a popover that opens upward from the chip)

1. **Choose a model.** The popover's first step has two parts.
   - **"Your models":** the active model (checked) and the other saved models; one click switches
     to a model, Enter or Space works too. When the env model is configured, the read-only
     Environment model (`web/.env.local`) is listed here as well.
   - **"Add or change a provider":** the presets, in this order:
     - OpenAI, Anthropic, DeepSeek, OpenRouter, Groq
     - Ollama (local), LM Studio (local)
     - Custom (OpenAI-compatible)
   - **Each provider row** shows its state: "key saved", "local", or disabled with the cloud
     reason. Choosing a provider goes to step 2.
   - **Removing a provider:** a saved provider has a Remove action in its row, with an inline
     confirm that defaults to No.
2. **Credentials** for the chosen provider.
   - The API key is a password field, never prefilled. When a key is saved, it shows "key saved:
     leave empty to keep it" and offers "Remove key".
   - The Base URL appears only for Custom, Ollama and LM Studio, prefilled from the preset.
   - Back and Continue.
   - Continue checks the provider through the existing test and fetch routes, then goes to
     step 3. A refusal stays on this step with the server's message.
3. **Choose a model.**
   - The provider's models: the fetched list as radio rows, plus "Type a model name".
   - Back and "Use this model".
   - The first save creates the provider (`POST /api/assistant/models`, `activate: true`). Later
     saves update it (`PATCH`) and switch to it (`PUT /models/active`).
   - The popover closes, and the chip shows the model name with a green dot.
- **Keys.** Escape goes back a step, then closes. Focus moves to each step's first control and
  returns to the chip on close. Lists use roving focus (arrows move, Enter chooses).
- **Phones.** The popover is a sheet above the composer.
- **Viewers.** The chip is disabled, with the reason ("Choosing a model needs the operator
  role").
- **Server.** The existing routes are reused. If anything is missing (for example a flag for
  "the cloud is allowed"), it is added to `GET /api/assistant/models`, still keyless and
  operator-only.

## Figma ("Local Web UI (Copy)")

- **Composer.** `Web/Chat/Composer` (W15) and every AI Assistant frame (W24, W24b) get the new
  composer and footer; the header loses the Model button.
- **Picker frames.** W24c's Model menu and Add model frames are replaced by the three picker
  steps, desktop and phone:
  - `WO:model-pick` (step 1, one cloud row disabled)
  - `WO:model-credentials` (step 2, Anthropic)
  - `WO:model-choose` (step 3)
  - phone versions `-ph`
- **Prototype.** Chip → step 1 → a provider → step 2 → Continue → step 3 → "Use this model" →
  the conversation with the chip showing the model. Back and Escape go back a step.

## Checks

- `npm test`, `npm run lint`, typecheck, `npm run build` and the full e2e.
- The e2e checks:
  - Custom provider → URL of the stand-in → Continue → pick `stub-model-2` → ask → the reply
    names `stub-model-2`
  - a cloud provider is disabled without the flag
  - one-click switch between saved models
  - no Model button in the header
  - axe on every step
- A live check in Chrome.
- Figma: the W91 check and exported frames.
