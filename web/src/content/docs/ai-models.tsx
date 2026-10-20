import { Callout, Code, DocLink, DocSection, DocTable, Mono, Steps } from "@/components/docs-primitives";
import type { GroupContent } from "@/content/docs/types";

export const aiModels: GroupContent = {
  providers: {
    lede: "/provider configures where a model comes from: set it up, test it, use one of its models, or remove it.",
    body: (
      <>
        <DocSection title="The catalog">
          <p>Six providers are built in. Each has its own rules for the key, the base URL and the number of models:</p>
          <DocTable
            caption="The provider catalog"
            head={["Provider (id)", "What it takes"]}
            rows={[
              { key: "Reconix (default) · reconix", value: <>An API key only. Its base URL and model come from <Mono>.env</Mono> (<Mono>LLM_BASE_URL</Mono>, <Mono>LLM_MODEL</Mono>) and are read-only in the form. One model.</> },
              { key: "OpenAI · openai", value: <>An API key. The models are built in (<Mono>gpt-4o-mini</Mono>, <Mono>gpt-4o</Mono>); you may list others, comma separated. A base URL is optional.</> },
              { key: "Anthropic · anthropic", value: <>An API key. Built-in models <Mono>claude-sonnet-5-5</Mono>, <Mono>claude-opus-5-5</Mono>, <Mono>claude-haiku-5-5</Mono>; others may be listed.</> },
              { key: "DeepSeek · deepseek", value: <>An API key. Built-in models <Mono>deepseek-chat</Mono>, <Mono>deepseek-reasoner</Mono>; others may be listed.</> },
              { key: "Ollama · ollama", value: <>No key. A base URL (default <Mono>http://localhost:11434</Mono>, from <Mono>OLLAMA_BASE_URL</Mono>) and exactly one model name.</> },
              { key: "Custom OpenAI-compatible · openai_compatible", value: "An optional key, a required base URL and exactly one model." },
            ]}
          />
        </DocSection>
        <DocSection title="Set up a provider">
          <Steps>
            <li>
              <Mono>/provider</Mono> opens the list with each provider&apos;s status (Untested, Reachable, Unreachable), its
              key hint such as <Mono>sk-…3f9a</Mono> and its models; <Mono>ACTIVE</Mono> marks the one whose model is in use.
              Pick one, or go straight to it with <Mono>/provider &lt;id&gt;</Mono>.
            </li>
            <li>
              Choose <strong>Set up</strong> (or <strong>Update</strong>), or type <Mono>/provider set &lt;id&gt;</Mono>. The
              form shows only the fields that provider takes: the API key (masked; on an update, leave it blank to keep
              the saved one), the base URL, and the model or comma-separated models.
            </li>
            <li>
              Save. The provider is stored as <strong>Untested</strong> and Reconix asks whether to test the connection
              now.
            </li>
          </Steps>
          <Code>{`/provider set reconix        # the API key for the .env endpoint
/provider set ollama         # base URL and one model, e.g. llama3.1
/provider set openai         # just the key; the models are built in`}</Code>
        </DocSection>
        <DocSection title="Test the connection">
          <p>
            <strong>Test connection</strong> in the submenu, or <Mono>/provider test &lt;id&gt;</Mono>. The test runs in the
            background (a notification says &quot;Testing …&quot;) and takes up to about twenty seconds (each request
            waits at most ten):
          </p>
          <ul>
            <li>
              <strong>Ollama:</strong> asks the server for its model list and checks the model is there
              (<Mono>llama3.1</Mono> matches <Mono>llama3.1:latest</Mono>).
            </li>
            <li>
              <strong>Reconix and the custom endpoint:</strong> asks <Mono>&lt;base URL&gt;/models</Mono> with the key; if the
              model is not listed or the endpoint has no model list, sends a one-token completion instead.
            </li>
            <li>
              <strong>OpenAI, Anthropic, DeepSeek:</strong> a one-token completion.
            </li>
          </ul>
          <p>
            The result is saved on the provider and shown as a notification, &quot;&lt;Provider&gt;: REACHABLE —
            model available&quot; (or &quot;reachable&quot;), or <strong>UNREACHABLE</strong> with a short, redacted
            reason: &quot;model not found&quot;, &quot;bad API key (unauthorized)&quot;, &quot;timed out&quot;,
            &quot;connection refused&quot; or &quot;could not reach the model&quot;. Only a Reachable provider&apos;s
            models can be activated.
          </p>
        </DocSection>
        <DocSection title="Use a model, or remove the provider">
          <p>
            <strong>Use a model</strong> (enabled once the provider is Reachable) lists its models; picking one makes it
            the active model, the same as <Mono>/model &lt;id&gt;/&lt;model&gt;</Mono>. <strong>Unset</strong> or{" "}
            <Mono>/provider unset &lt;id&gt;</Mono> asks &quot;This deletes …&apos;s saved key and settings.&quot; with
            &quot;No, keep it&quot; selected; removing it also clears the active model if it was this provider&apos;s.
          </p>
        </DocSection>
        <DocSection title="What is recorded">
          <p>
            Saving, testing, activating and removing a provider are written to the activity log and the audit trail
            (<Mono>/audit</Mono>): &quot;LLM provider saved: OpenAI&quot;, &quot;LLM provider OpenAI: reachable (model
            available)&quot;, and so on. The key itself appears nowhere; see{" "}
            <DocLink href="/docs/ai-models/configuration">Configuration</DocLink>.
          </p>
        </DocSection>
      </>
    ),
  },
  models: {
    lede: "/model picks the active model. It answers your chat lines; it never decides a gate.",
    body: (
      <>
        <DocSection title="Pick the active model">
          <p>
            <Mono>/model</Mono> lists every model of every configured provider, grouped by provider; a model is disabled
            with the hint &quot;Test the connection first&quot; until its provider is Reachable. <Mono>/model
            &lt;provider&gt;/&lt;model&gt;</Mono> activates one directly:
          </p>
          <Code>{`/model reconix/your-model-id
/model openai/gpt-4o-mini
/model ollama/llama3.1`}</Code>
          <p>
            The top bar then shows <Mono>llm: &lt;provider label&gt; · &lt;model&gt; ●</Mono> (for example{" "}
            <Mono>llm: Reconix (default) · your-model-id ●</Mono>), the chat notes &quot;Switched to
            OpenAI · gpt-4o-mini&quot;, and the switch is recorded in the activity log, the audit trail and the{" "}
            <Mono>model_switches</Mono> table of <Mono>llm.db</Mono>. With no configured, reachable provider the command
            says &quot;No models yet. Use /provider to set one up and test it.&quot;
          </p>
        </DocSection>
        <DocSection title="What the model does">
          <ul>
            <li>
              <strong>Chat during a run.</strong> A line typed at the prompt while an assessment runs goes to the active
              model with a fixed system prompt, a short description of the assessment state (target, template, scope
              status, phase, waiting gate, the findings&apos; ids, severities and titles, the approval decisions) and the
              last 40 chat turns. Every piece of text is cleaned and redacted first, the model gets no tools, and its
              reply is redacted and capped at 8,000 characters before it is shown. Both lines are saved in{" "}
              <Mono>llm.db</Mono> (<Mono>chat_messages</Mono>).
            </li>
            <li>
              <strong>The AI agent.</strong> With the backend harness installed, the active model is also the agent&apos;s
              model for <Mono>/assess</Mono>; switching models mid-assessment repoints the agent and keeps its whole
              conversation. See <DocLink href="/docs/assessment-guide/ai-agent">The AI agent</DocLink>.
            </li>
          </ul>
          <Callout variant="warning" title="Never a decision">
            The model proposes text. The scope, the policy checks, the approval gates and the vault are deterministic
            and ignore it; a different model never changes what is allowed to run. See{" "}
            <DocLink href="/docs/guardrails/llm-data-handling">LLM data handling</DocLink>.
          </Callout>
        </DocSection>
        <DocSection title="Switching mid-run">
          <p>
            <Mono>/model</Mono> works at any time. The run, its findings and its approvals are unchanged; only the next
            chat line (or the agent&apos;s next turn) uses the new model.
          </p>
        </DocSection>
        <DocSection title="With no model">
          <p>
            The scripted demo runs: chat lines get the built-in reply, and a target starts the simulated assessment. If
            a call to the active model fails, the chat shows &quot;LLM unavailable (&lt;reason&gt;). Showing the built-in
            reply.&quot; and falls back the same way, so the terminal keeps working offline.
          </p>
        </DocSection>
      </>
    ),
  },
  configuration: {
    lede: "One .env seeds the default provider; everything you add with /provider lives encrypted in ~/.reconix/llm.db.",
    body: (
      <>
        <DocSection title="The .env seed">
          <p>
            Copy <Mono>.env.example</Mono> to <Mono>.env</Mono> in the repository root; it is read once when the terminal
            starts and is git-ignored. The <Mono>LLM_*</Mono> block defines the built-in <strong>Reconix</strong> provider,
            which is also the configuration the AI agent shares:
          </p>
          <Code>{`LLM_BASE_URL=http://localhost:11434/v1   # any OpenAI-compatible endpoint (usually ends in /v1)
LLM_MODEL=your-model-id                  # the model id at that endpoint
LLM_TIMEOUT=120                          # per-request timeout, seconds`}</Code>
          <p>
            The Reconix provider&apos;s API key is <strong>not</strong> in <Mono>.env</Mono>: enter it with{" "}
            <Mono>/provider set reconix</Mono>. Saving copies the base URL and model into <Mono>llm.db</Mono>, and tests
            and chat read that copy: after changing <Mono>LLM_BASE_URL</Mono> or <Mono>LLM_MODEL</Mono>, restart, run{" "}
            <Mono>/provider set reconix</Mono> again (leave the key blank to keep it) and test again. The other
            providers are added entirely in the terminal.
          </p>
        </DocSection>
        <DocSection title="Where keys are stored">
          <DocTable
            caption="The files behind the LLM settings"
            head={["File", "Contents"]}
            rows={[
              { key: "~/.reconix/llm.db", value: <>One SQLite file, mode 0600 in a 0700 folder: the providers (encrypted key, key hint, base URL, models, test status), the active model, the chat history and the model switches. Move it with <Mono>LLM_DB</Mono>.</> },
              { key: "~/.reconix/llm.key", value: <>The Fernet key that encrypts the API keys, created 0600 on first use. Move it with <Mono>LLM_KEY_FILE</Mono>. Lose it and the saved keys cannot be read: set the providers up again.</> },
            ]}
          />
          <p>
            An API key is encrypted before it reaches the database and decrypted only for the call it is used in. What
            you see afterwards is a hint like <Mono>sk-…3f9a</Mono> (the first three and last four characters). LiteLLM&apos;s
            debug output and telemetry are off, and every provider error is reduced to a short redacted message, so a key
            never reaches the screen, a log, a report or a saved copy.
          </p>
        </DocSection>
        <DocSection title="Other settings">
          <Code>{`LLM_DB=~/.reconix/llm.db          # the providers database
LLM_KEY_FILE=~/.reconix/llm.key   # the encryption key
OLLAMA_BASE_URL=http://localhost:11434`}</Code>
          <p>
            The AI agent&apos;s settings (<Mono>KALI_MCP_TRANSPORT</Mono>, <Mono>KALI_MCP_URL</Mono>,{" "}
            <Mono>KALI_MCP_AUTH_TOKEN</Mono>, <Mono>KALI_MCP_SSH_HOST</Mono>, <Mono>KALI_MCP_REMOTE_CMD</Mono>,{" "}
            <Mono>HARNESS_DB_PATH</Mono>) sit in the same file; see{" "}
            <DocLink href="/docs/assessment-guide/ai-agent">The AI agent</DocLink>.
          </p>
          <Callout>
            The web dashboard&apos;s AI Assistant is configured separately, in <Mono>web/.env.local</Mono>: it has its own{" "}
            <Mono>LLM_BASE_URL</Mono> and <Mono>LLM_MODEL</Mono>, and reaches a model off this machine only with{" "}
            <Mono>LLM_ALLOW_REMOTE=1</Mono>. The terminal&apos;s providers are never shared with it.
          </Callout>
        </DocSection>
      </>
    ),
  },
  errors: {
    lede: "Every message /provider and /model can show, and what it means.",
    body: (
      <>
        <DocSection title="Setting up a provider">
          <DocTable
            caption="Messages when a provider is saved"
            head={["Message", "Meaning"]}
            rows={[
              { key: "Unknown provider.", value: "The id is not one of reconix, openai, anthropic, deepseek, ollama, openai_compatible." },
              { key: "<Provider> needs an API key.", value: "The provider requires a key and none is saved yet. Enter one." },
              { key: "That API key is too long.", value: "Keys are limited to 4,096 characters." },
              { key: "<Provider> needs a base URL.", value: "The custom OpenAI-compatible provider has no base URL." },
              { key: "The base URL must start with http:// or https://.", value: "Give the full endpoint, for example https://host/v1." },
              { key: "That base URL is too long.", value: "URLs are limited to 2,048 characters." },
              { key: "Put the API key in the key field, not in the base URL.", value: "A user:password@host URL is refused so the key is stored encrypted, never in plain text." },
              { key: "At least one model name is required.", value: "The model field is empty." },
              { key: "That model name is too long.", value: "Model names are limited to 200 characters." },
              { key: "<Provider> holds a single model.", value: "Ollama and the custom endpoint take exactly one model; frontier providers take a list." },
              { key: "Reconix's base URL comes from .env and can't be changed.", value: "The Reconix provider's base URL and model are read-only: edit .env, restart, then /provider set reconix to re-save them (see Configuration)." },
              { key: "Reconix's model comes from .env and can't be changed.", value: "Same for the model." },
            ]}
          />
        </DocSection>
        <DocSection title="Testing and activating">
          <DocTable
            caption="Messages when a provider is tested or a model activated"
            head={["Message", "Meaning"]}
            rows={[
              { key: "<Provider> is not configured. / … not configured yet.", value: "Set it up first (/provider set <id>)." },
              { key: "UNREACHABLE — model not found", value: "The model is not in the endpoint's list, or the completion came back 404. Check the model name (for Ollama, pull it first)." },
              { key: "UNREACHABLE — bad API key (unauthorized)", value: "The endpoint answered 401 or 403, or complained about the key." },
              { key: "UNREACHABLE — timed out", value: "No answer within a request's ten-second limit." },
              { key: "UNREACHABLE — connection refused", value: "Nothing listens at the base URL, or the host could not be reached." },
              { key: "UNREACHABLE — could not reach the model", value: "Any other provider or transport error; the detail is deliberately short." },
              { key: "Test the connection first — the provider is not reachable.", value: "Only a Reachable provider's model can be activated." },
              { key: "<model> is not configured for <Provider>.", value: "The model after the slash is not in that provider's list." },
              { key: "Use provider/model, e.g. openai/gpt-4o-mini.", value: "/model takes the id and the model separated by a slash." },
              { key: "No models yet. Use /provider to set one up and test it.", value: "No configured provider has any model to list." },
            ]}
          />
        </DocSection>
        <DocSection title="While chatting or assessing">
          <DocTable
            caption="Messages while a model is in use"
            head={["Message", "Meaning"]}
            rows={[
              { key: "LLM unavailable (<reason>). Showing the built-in reply.", value: "The call failed (the reasons above, plus “empty response from the model” and “the model's reply was too long”). The scripted reply is shown instead." },
              { key: "Pick a model first with /model.", value: "/assess needs an active model." },
              { key: "The harness backend isn't installed (pip install -e backend).", value: "/assess needs the backend harness." },
              { key: "No LLM model is active. Use /model to pick one.", value: "The agent was asked to run without an active model." },
              { key: "The assessment is running — you can chat once it finishes.", value: "The agent is in the middle of a turn; wait for it." },
            ]}
          />
          <p>
            More in <DocLink href="/docs/troubleshooting/model-connection">Troubleshooting · Model connection</DocLink>.
          </p>
        </DocSection>
      </>
    ),
  },
};
