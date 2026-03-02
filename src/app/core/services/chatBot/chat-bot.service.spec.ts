import { ChatService, ChatMessage } from './chat-bot.service';

describe('ChatService (rule-based studio flow)', () => {
  let service: ChatService;

  beforeEach(() => {
    localStorage.clear();
    service = new ChatService();
  });

  function userHistory(text: string): ChatMessage[] {
    return [
      {
        from: 'user',
        text,
        timestamp: new Date().toISOString()
      }
    ];
  }

  it('instrada il client alla chat studio quando richiesta assistenza umana', async () => {
    const result = await service.replyWithPlan('chat-1', userHistory('voglio parlare con lo studio'), { role: 'client' });

    expect(result.message.toLowerCase()).toContain('chat con lo studio');
    expect(result.chips).toContain('Apri chat studio');
  });

  it('richiede login per guest che chiede chat studio', async () => {
    const result = await service.replyWithPlan('chat-2', userHistory('voglio parlare con operatore studio'), { role: 'guest' });

    expect(result.message.toLowerCase()).toContain('devi prima accedere');
    expect(result.chips).toContain('Accedi per chat studio');
  });

  it('fornisce contatti studio su richiesta', async () => {
    const result = await service.replyWithPlan('chat-3', userHistory('mi dai telefono e indirizzo?'), { role: 'public' });
    expect(result.message).toContain('Telefono:');
    expect(result.message).toContain('Email:');
    expect(result.message).toContain('Indirizzo:');
  });

  it('gestisce fallback testuale senza modello LLM', async () => {
    const result = await service.replyWithPlan('chat-4', userHistory('testo casuale senza intent chiaro'), { role: 'client' });
    expect(result.message.toLowerCase()).toContain('posso aiutarti');
    expect(result.chips).toContain('Apri chat studio');
  });
});
