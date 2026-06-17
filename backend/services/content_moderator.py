"""
Content Moderation Service - AI-powered safety checks for shared stories
Ensures entries don't contain PII, crisis content, or hate before publishing
"""

from groq import Groq
from config.settings import settings
from typing import Optional, Dict
import json


class ContentModerator:
    """Content moderation for story sharing"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "mixtral-8x7b-32768"
    
    @staticmethod
    def get_system_prompt() -> str:
        """Get the moderation system prompt"""
        return """You are a content moderator for a mental health platform.
Review this journal entry for public sharing.
Flag if it contains: 
- Real names or identifying info (specific person names, full addresses)
- Identifying locations (specific institution names, dorm names)
- Crisis-level content (self-harm, suicide, severe abuse)
- Hate speech or discrimination

Respond ONLY with JSON:
{"safe": true/false, "reason": "brief explanation if unsafe"}"""
    
    async def check_content_safety(self, entry_text: str) -> Dict:
        """
        Check if content is safe to publish
        
        Args:
            entry_text: The journal entry to check
        
        Returns:
            Dict with safe: bool and reason: str
        """
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Review this entry:\n\n{entry_text}"}
                ],
                max_tokens=200,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            return {
                "safe": result.get("safe", False),
                "reason": result.get("reason", ""),
                "flagged": not result.get("safe", False)
            }
        
        except json.JSONDecodeError as e:
            print(f"Error parsing moderation response: {e}")
            # Default to unsafe on parsing error
            return {
                "safe": False,
                "reason": "Moderation system error",
                "flagged": True
            }
        except Exception as e:
            print(f"Error in content moderation: {e}")
            return {
                "safe": False,
                "reason": "Moderation system error",
                "flagged": True
            }


# Singleton instance
_moderator = None

def get_content_moderator() -> ContentModerator:
    """Get or create singleton moderator instance"""
    global _moderator
    if _moderator is None:
        _moderator = ContentModerator()
    return _moderator
