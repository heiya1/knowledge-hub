import type { AiProvider, AiMessage, IAiService } from '../interfaces/IAiService';

export interface AiServiceConfig {
  provider: AiProvider;
  apiKey?: string;
  ollamaModel?: string;
  ollamaUrl?: string;
}

export class AiService implements IAiService {
  private provider: AiProvider;
  private apiKey: string;
  private ollamaModel: string;
  private ollamaUrl: string;

  constructor(config: AiServiceConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey ?? '';
    this.ollamaModel = config.ollamaModel ?? 'llama3.2';
    this.ollamaUrl = config.ollamaUrl ?? 'http://localhost:11434';
  }

  isConfigured(): boolean {
    if (this.provider === 'ollama') return true;
    return this.apiKey.length > 0;
  }

  async *chat(
    messages: AiMessage[],
    options?: { context?: string }
  ): AsyncGenerator<string, void, unknown> {
    const allMessages = this.buildMessages(messages, options?.context);

    switch (this.provider) {
      case 'claude':
        yield* this.chatClaude(allMessages);
        break;
      case 'openai':
        yield* this.chatOpenAI(allMessages);
        break;
      case 'ollama':
        yield* this.chatOllama(allMessages);
        break;
    }
  }

  private buildMessages(messages: AiMessage[], context?: string): AiMessage[] {
    if (!context) return messages;

    const systemMessage: AiMessage = {
      role: 'system',
      content: context,
    };

    // Prepend system context
    return [systemMessage, ...messages];
  }

  private async *chatClaude(messages: AiMessage[]): AsyncGenerator<string, void, unknown> {
    // Claude API separates system from messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      stream: true,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join('\n\n');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta' &&
                parsed.delta?.text
              ) {
                yield parsed.delta.text;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *chatOpenAI(messages: AiMessage[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        stream: true,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async *chatOllama(messages: AiMessage[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.ollamaModel,
        stream: true,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
            if (parsed.done) return;
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
