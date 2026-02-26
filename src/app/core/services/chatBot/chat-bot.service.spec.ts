import { ChatService, ChatMessage } from './chat-bot.service';
import { LocalLlmService } from './local-llm.service';

describe('ChatService (AI-only message flow)', () => {
  let service: ChatService;
  let llmSpy: jasmine.SpyObj<LocalLlmService>;

  beforeEach(() => {
    localStorage.clear();
    llmSpy = jasmine.createSpyObj<LocalLlmService>('LocalLlmService', ['generateSupportReply']);
    service = new ChatService(llmSpy);
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

  it('usa la risposta AI per richieste chat', async () => {
    llmSpy.generateSupportReply.and.resolveTo('Risposta AI locale.');

    const result = await service.replyWithPlan('chat-1', userHistory('ciao assistente'), { role: 'client' });

    expect(llmSpy.generateSupportReply).toHaveBeenCalled();
    expect(result.message).toBe('Risposta AI locale.');
  });

  it('fallback quando il modello non risponde', async () => {
    llmSpy.generateSupportReply.and.resolveTo(null);

    const result = await service.replyWithPlan('chat-2', userHistory('messaggio qualsiasi'), { role: 'guest' });

    expect(llmSpy.generateSupportReply).toHaveBeenCalled();
    expect(result.message).toContain('Non riesco a rispondere');
  });

  it('usa chips coerenti con il ruolo', async () => {
    llmSpy.generateSupportReply.and.resolveTo('Supporto operativo admin.');

    const result = await service.replyWithPlan('chat-3', userHistory('dammi supporto'), { role: 'admin' });

    expect(result.chips).toEqual(['Vai al profilo', 'Apri booking']);
  });

  it('non crea action booking: la chat usa solo risposta AI', async () => {
    llmSpy.generateSupportReply.and.resolveTo('Per la prenotazione ti guido passo passo.');

    const result = await service.replyWithPlan('chat-4', userHistory('prenota domani alle 15'), { role: 'client' });

    expect(llmSpy.generateSupportReply).toHaveBeenCalled();
    expect(result.chips).toContain('Apri booking');
  });
});
