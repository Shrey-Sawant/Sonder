"""
AI Reflection Service - Compassionate companion responses to journal entries
Uses Groq API for fast, low-latency responses
"""

from groq import Groq
from config.settings import settings
from typing import Optional
import json


class MoodCompanion:
    """AI companion for journal reflection"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "mixtral-8x7b-32768"  # Fast, reliable
    
    @staticmethod
    def get_system_prompt() -> str:
        """Get the companion system prompt"""
        return """You are a compassionate, non-clinical reflection companion for college students. 
When a student shares a journal entry:
- Acknowledge the emotion they selected first.
- Reflect back what you heard in 2 sentences — don't paraphrase word for word.
- Ask ONE gentle follow-up question (not advice).
- Never diagnose. Never say 'you should'.
- Tone: warm, peer-like, not therapist-clinical.
- Max response: 120 words."""
    
    async def generate_reflection(self, mood: str, entry_text: str) -> Optional[str]:
        """
        Generate AI reflection for a journal entry
        
        Args:
            mood: Selected mood (e.g., "calm", "anxious")
            entry_text: The journal entry text
        
        Returns:
            AI-generated reflection text
        """
        try:
            prompt = f"""The student selected this mood: {mood.upper()}

Their journal entry:
"{entry_text}"

Please provide a compassionate reflection."""
            
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            print(f"Error generating reflection: {e}")
            return None


# Singleton instance
_companion = None

def get_mood_companion() -> MoodCompanion:
    """Get or create singleton companion instance"""
    global _companion
    if _companion is None:
        _companion = MoodCompanion()
    return _companion
