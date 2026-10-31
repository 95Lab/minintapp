import { openAiProvider } from "./openai-llm-provider";
// OpenAI is the only provider. An absent key never selects a mock or another service.
export const activeLlmProvider = () => openAiProvider.isConfigured() ? openAiProvider : null;
