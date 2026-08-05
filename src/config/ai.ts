export const SUPPORTED_AI_PROVIDERS = ["mock", "kimi", "groq", "openrouter", "gemini"] as const;

export type AIProviderName = (typeof SUPPORTED_AI_PROVIDERS)[number];

export function getAIProvider(): AIProviderName {
  const value = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();
  if ((SUPPORTED_AI_PROVIDERS as readonly string[]).includes(value)) {
    return value as AIProviderName;
  }
  throw new Error(
    `Unsupported AI provider "${value}". ` +
      `Supported providers: ${SUPPORTED_AI_PROVIDERS.join(", ")}. ` +
      `Set AI_PROVIDER in your .env file.`
  );
}
