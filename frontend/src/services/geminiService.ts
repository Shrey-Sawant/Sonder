/**
 * AI companion client.
 *
 * Model calls are proxied through the Sonder backend so provider API keys are
 * never shipped to the browser. Do not reintroduce a client-side provider SDK
 * or inline API keys here.
 */
import api from './api';

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    const response = await api.post('/chatbot/chat', { message });
    const data = response.data;
    if (typeof data === 'string') return data;
    return data?.reply ?? data?.message ?? '';
  } catch (error) {
    console.error('AI companion error:', error);
    return "I'm listening, but I'm having a bit of trouble processing that right now. Can we try again?";
  }
};
