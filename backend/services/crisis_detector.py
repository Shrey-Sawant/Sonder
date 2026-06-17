"""
Crisis Detection Service - AI-powered risk assessment for emotional wellbeing
Classifies messages/entries into LOW/MEDIUM/HIGH risk categories
Runs server-side, never shown to user during analysis
"""

from groq import Groq
from config.settings import settings
from typing import Optional, Dict
import json


class CrisisDetector:
    """AI crisis signal detection"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "mixtral-8x7b-32768"
    
    @staticmethod
    def get_system_prompt() -> str:
        """Get the crisis detection system prompt"""
        return """You are assessing a message from a college student for emotional risk.
Classify as: LOW / MEDIUM / HIGH.

- LOW = general stress, sadness, academic anxiety
- MEDIUM = hopelessness, withdrawal signals, expressions of meaninglessness
- HIGH = mentions of self-harm, suicide ideation, severe abuse

Respond ONLY with JSON:
{"risk": "LOW"|"MEDIUM"|"HIGH", "signal": "brief description of what you detected"}"""
    
    async def assess_risk(self, text: str, source_type: str = "message") -> Dict:
        """
        Assess emotional risk level of a message
        
        Args:
            text: The message/entry to assess
            source_type: "message", "journal", or "mood_streak"
        
        Returns:
            Dict with risk level and signal description
        """
        try:
            context = f"[{source_type.upper()}] "
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Assess this:\n\n{context}{text}"}
                ],
                max_tokens=200,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            risk_level = result.get("risk", "LOW").upper()
            
            # Validate risk level
            if risk_level not in ["LOW", "MEDIUM", "HIGH"]:
                risk_level = "LOW"
            
            return {
                "risk_level": risk_level,
                "signal": result.get("signal", ""),
                "requires_intervention": risk_level in ["MEDIUM", "HIGH"]
            }
        
        except json.JSONDecodeError as e:
            print(f"Error parsing crisis detection response: {e}")
            # Default to LOW on parsing error
            return {
                "risk_level": "LOW",
                "signal": "Assessment error",
                "requires_intervention": False
            }
        except Exception as e:
            print(f"Error in crisis detection: {e}")
            return {
                "risk_level": "LOW",
                "signal": "Assessment error",
                "requires_intervention": False
            }


# Singleton instance
_detector = None

def get_crisis_detector() -> CrisisDetector:
    """Get or create singleton detector instance"""
    global _detector
    if _detector is None:
        _detector = CrisisDetector()
    return _detector
