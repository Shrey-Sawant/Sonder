"""
Message Moderator Service - 4-tier real-time chat moderation for Support Circles
"""

from groq import Groq
from config.settings import settings
from typing import Dict, List
import json


class MessageModerator:
    """Classifies support circle messages into SAFE, SOFT_FLAG, HOLD, or BLOCK"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "llama-3.3-70b-versatile"
        
    @staticmethod
    def get_system_prompt() -> str:
        return """You are a real-time message moderator for an anonymous student support group.
You must classify the user's message into one of four safety tiers:
1. SAFE: The message is supportive, normal discussion, or standard emotional venting.
2. SOFT_FLAG: The message shows mild anxiety, frustration, or minor sadness. It is safe to post, but indicates a need for a subtle wellness notice in the UI.
3. HOLD: The message is off-topic, spammy, contains identifying information, displays high levels of anger/aggression, or shows significant emotional distress (feeling helpless but no immediate self-harm threat). These messages are hidden from other group members and reviewed by moderators.
4. BLOCK: The message contains severe hate speech, harassment, explicit trigger words, or indicators of active self-harm/suicide crisis. These are blocked immediately and safety interventions are triggered.

You must adjust your strictness based on the support circle's sensitivity level (low, medium, or high). Circles with "high" sensitivity should be moderated much more conservatively.

Respond ONLY with a JSON object in this format with no markdown wrappers:
{
  "status": "SAFE/SOFT_FLAG/HOLD/BLOCK",
  "reason": "Brief reason for classification"
}"""

    async def moderate_message(
        self, 
        message_content: str, 
        sensitivity_level: str = "medium", 
        crisis_keywords: List[str] = None
    ) -> Dict:
        """
        Classify message using AI + keyword fallback
        
        Args:
            message_content: The text of the message to moderate
            sensitivity_level: "low", "medium", or "high"
            crisis_keywords: Custom list of keywords to check
            
        Returns:
            Dict containing classification status and reason
        """
        # 1. Immediate local keyword checks for active crisis fallback
        lower_content = message_content.lower()
        
        extreme_crisis_terms = [
            "suicide", "kill myself", "want to die", "end my life", 
            "self-harm", "cutting myself", "better off dead", "kill me"
        ]
        
        # Check extreme triggers
        if any(term in lower_content for term in extreme_crisis_terms):
            return {
                "status": "BLOCK",
                "reason": "Severe crisis indicators detected in message content."
            }
            
        # 2. Call AI Moderator
        try:
            if not getattr(settings, 'GROQ_API_KEY', None) and not self.client.api_key:
                raise ValueError("Groq API key not configured")
                
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Circle Sensitivity Level: {sensitivity_level}\nCrisis Keywords (if matched): {', '.join(crisis_keywords or [])}\nMessage to moderate: \"{message_content}\""}
                ],
                max_tokens=150,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            status = result.get("status", "SAFE").upper()
            if status not in ["SAFE", "SOFT_FLAG", "HOLD", "BLOCK"]:
                status = "SAFE"
                
            return {
                "status": status,
                "reason": result.get("reason", "Approved by automated moderator.")
            }
            
        except Exception as e:
            print(f"Error in MessageModerator: {e}. Running local rule-based fallback.")
            
            # Local rule-based fallback
            matched_keywords = []
            if crisis_keywords:
                for kw in crisis_keywords:
                    if kw.lower() in lower_content:
                        matched_keywords.append(kw)
                        
            if matched_keywords:
                # If high sensitivity circle, matching keywords goes to HOLD or BLOCK
                if sensitivity_level == "high":
                    return {
                        "status": "HOLD",
                        "reason": f"Distress keyword '{matched_keywords[0]}' detected in high-sensitivity circle."
                    }
                else:
                    return {
                        "status": "SOFT_FLAG",
                        "reason": f"Distress keyword '{matched_keywords[0]}' flagged."
                    }
                    
            # Check standard distress terms
            distress_terms = ["depressed", "anxious", "stress", "lonely", "sad", "fail", "empty", "cry"]
            if any(term in lower_content for term in distress_terms):
                return {
                    "status": "SOFT_FLAG",
                    "reason": "Mild distress or emotional vocabulary detected."
                }
                
            return {
                "status": "SAFE",
                "reason": "Passed rule-based checks."
            }


# Singleton instance
_message_moderator = None

def get_message_moderator() -> MessageModerator:
    global _message_moderator
    if _message_moderator is None:
        _message_moderator = MessageModerator()
    return _message_moderator
