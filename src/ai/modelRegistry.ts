import { ModelProfile } from './canvasTypes';

/**
 * Server-side allowlisted model registry.
 * Browser may select by `id` only — never arbitrary model strings or provider URLs.
 */
export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'gemini-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    capabilities: { tools: true, structuredOutput: true, images: true },
    tasks: ['chat', 'synthesis', 'layout', 'extraction'],
    maxInputTokens: 1000000,
    enabled: true,
  },
  {
    id: 'gemini-flash-lite',
    provider: 'google',
    modelId: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    capabilities: { tools: true, structuredOutput: true, images: false },
    tasks: ['chat', 'extraction'],
    maxInputTokens: 500000,
    enabled: true,
  },
  {
    id: 'gemini-pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    capabilities: { tools: true, structuredOutput: true, images: true },
    tasks: ['chat', 'synthesis', 'layout', 'extraction'],
    maxInputTokens: 1000000,
    enabled: true,
  },
];

export type TaskPreset = 'chat' | 'synthesis' | 'layout' | 'extraction';

export function listEnabledModels(): ModelProfile[] {
  return MODEL_PROFILES.filter((p) => p.enabled);
}

export function resolveModelProfile(
  profileId?: string | null,
  task: TaskPreset = 'chat'
): ModelProfile {
  const enabled = listEnabledModels();
  const requested = enabled.find((p) => p.id === profileId);
  if (requested && requested.tasks.includes(task)) return requested;
  const byTask = enabled.find((p) => p.tasks.includes(task));
  return byTask || enabled[0];
}

/** CopilotKit BuiltInAgent model specifier */
export function toCopilotKitModelId(profile: ModelProfile): string {
  if (profile.provider === 'google') return `google/${profile.modelId}`;
  if (profile.provider === 'openai') return `openai/${profile.modelId}`;
  return `anthropic/${profile.modelId}`;
}
