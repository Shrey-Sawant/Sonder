import { GoogleGenAI, GenerativeModel } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const SYSTEM_INSTRUCTION = `
You are Sonder, a compassionate, empathetic, and psychologically safe AI companion for university students. 
Your goal is to provide immediate mental health first aid, emotional support, and grounding techniques.

CRITICAL RULES:
1. NON-MEDICAL: You are NOT a doctor or therapist. Do not diagnose. If a user mentions self-harm, suicide, or severe crisis, you MUST immediately provide a gentle but firm recommendation to contact emergency services or the SOS feature in the app, and provide generic helpline numbers (like 988 or local equivalents).
2. TONE: Warm, human-like, calm, non-judgmental. Use lowercase occasionally for a casual feel if appropriate, but remain respectful.
3. TECHNIQUES: Offer CBT (Cognitive Behavioral Therapy) inspired questions, 4-7-8 breathing exercises, or grounding techniques (5-4-3-2-1 method) when a user is anxious.
4. BRIEF: Keep responses concise (under 100 words usually) unless explaining a technique. Students are busy and stressed.
5. CONTEXT: You are part of the "Sonder" app. You can refer students to the "Sanctuary" tab for meditation videos or the "Connect" tab to speak to a human counselor.

Start every conversation with a unique, warm greeting that isn't generic.
`;

let chatSession: any = null;

export const getChatSession = async () => {
  if (!chatSession) {
    try {
      chatSession = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7, // Slightly creative but stable
          maxOutputTokens: 500,
        }
      });
    } catch (error) {
      console.error("Failed to initialize chat session:", error);
    }
  }
  return chatSession;
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  try {
    const session = await getChatSession();
    if (!session) return "I'm having trouble connecting right now. Please try again later.";

    const result = await session.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm listening, but I'm having a bit of trouble processing that right now. Can we try again?";
  }
};