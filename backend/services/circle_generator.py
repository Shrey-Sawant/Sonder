"""
Circle Generator Service - AI-powered creation of Support Circles
"""

from groq import Groq
from config.settings import settings
from typing import Dict
import json


class CircleGenerator:
    """Auto-generates support circle configuration from theme + type"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "llama-3.3-70b-versatile"
        
    @staticmethod
    def get_system_prompt() -> str:
        return """You are a circle configuration auto-generator for a mental wellness support platform.
Given a theme (e.g. 'feeling like an imposter') and a type (e.g. 'burnout' or 'first-year'), auto-generate a welcoming support group configuration.

You must generate:
- A warm, community-minded, unique name (e.g. 'Zen Zone', 'Freshstart Crew', 'Quiet Canopy')
- A tagline (inspiring, max 8 words)
- A welcome message (welcoming, explains the focus, max 40 words)
- Exactly 4 community rules tailored to this specific type/theme (focusing on respect, anonymity, safety, and mutual support)
- An opening prompt (a gentle question to kick off discussion, max 25 words)
- A sensitivity level: either "low", "medium", or "high" based on the type/theme. E.g. "relationship stress" or "burnout" gets "high", "exam season" gets "medium", "first-year" gets "low".
- A list of 6-8 crisis_keywords specific to this theme that might indicate emotional distress or need for intervention.

Respond ONLY with a JSON object in this format with no markdown wrappers:
{
  "name": "...",
  "tagline": "...",
  "welcome_message": "...",
  "rules": ["rule 1", "rule 2", "rule 3", "rule 4"],
  "opening_prompt": "...",
  "sensitivity_level": "low/medium/high",
  "crisis_keywords": ["keyword 1", "keyword 2", ...]
}"""

    async def generate_circle_preview(self, theme: str, circle_type: str) -> Dict:
        """
        Generate support circle configuration
        
        Args:
            theme: The core focus/theme of the circle
            circle_type: The student role or challenge category
            
        Returns:
            Dict containing configuration parameters
        """
        try:
            # Check if API key exists
            if not getattr(settings, 'GROQ_API_KEY', None) and not self.client.api_key:
                raise ValueError("Groq API key not configured")
                
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Generate support circle configuration for:\nTheme: {theme}\nType/Category: {circle_type}"}
                ],
                max_tokens=600,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            # Ensure format is validated
            return {
                "name": result.get("name", f"{theme.title()} Support"),
                "tagline": result.get("tagline", "A safe space to share and support."),
                "welcome_message": result.get("welcome_message", f"Welcome to the circle for {theme}. Let's support each other."),
                "rules": result.get("rules", [
                    "Respect the anonymity of all participants.",
                    "Be kind and supportive in all messages.",
                    "Share your own experiences, do not lecture.",
                    "Reach out for professional support if you need crisis help."
                ])[:4],
                "opening_prompt": result.get("opening_prompt", "How are you coping with this theme today?"),
                "sensitivity_level": result.get("sensitivity_level", "medium").lower(),
                "crisis_keywords": result.get("crisis_keywords", ["help", "crisis", "give up", "despair", "hopeless"])
            }
            
        except Exception as e:
            print(f"Error in CircleGenerator AI: {e}. Using fallback generator.")
            # Fallback generator in case of network/API error
            sensitivity = "medium"
            if circle_type in ["relationship stress", "burnout", "identity & belonging"]:
                sensitivity = "high"
            elif circle_type in ["first-year"]:
                sensitivity = "low"
                
            return {
                "name": f"The {theme.title()} Circle",
                "tagline": f"Supporting peers through {theme}.",
                "welcome_message": f"Welcome! This circle is a dedicated, secure space for students navigating {theme}. Together, we find balance.",
                "rules": [
                    f"Keep conversations anonymous and focused on {theme}.",
                    "Ensure respectful, empathetic responses.",
                    "Refrain from spamming or promotion.",
                    "Report messages that feel unsafe or inappropriate."
                ],
                "opening_prompt": f"Welcome! What brought you to the {theme} circle today?",
                "sensitivity_level": sensitivity,
                "crisis_keywords": [
                    "give up", "cant go on", "hopeless", "end it", "hurt myself", 
                    "despair", "collapse", "failing everything"
                ]
            }


# Singleton instance
_circle_generator = None

def get_circle_generator() -> CircleGenerator:
    global _circle_generator
    if _circle_generator is None:
        _circle_generator = CircleGenerator()
    return _circle_generator
