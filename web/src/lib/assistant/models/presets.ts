/* The providers the Model menu's form knows by name: each fills in its OpenAI-compatible base
   URL (Custom leaves it to you) and says whether it takes an API key. A preset is only a
   starting point: the saved provider keeps whatever address was saved, checked by the same rules
   as any other model (config.ts). Pure: browser and server. */

export const PRESETS = [
  { id: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", key: "none" },
  { id: "lmstudio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", key: "none" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", key: "required" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", key: "required" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", key: "required" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", key: "required" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", key: "required" },
  { id: "custom", label: "Custom", baseUrl: "", key: "optional" },
] as const;

export type Preset = (typeof PRESETS)[number];
export type PresetId = Preset["id"];

export const PRESET_IDS = PRESETS.map((p) => p.id) as [PresetId, ...PresetId[]];

/** The preset `id` names (Custom for anything else). */
export const presetOf = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
