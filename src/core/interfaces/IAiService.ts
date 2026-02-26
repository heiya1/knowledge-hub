export type AiProvider = 'claude' | 'openai' | 'ollama';

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IAiService {
  chat(messages: AiMessage[], options?: { context?: string }): AsyncGenerator<string, void, unknown>;
  isConfigured(): boolean;
}
