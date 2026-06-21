"""
Story Engine Service - AI-powered processing of anonymous shared stories
"""

from groq import Groq
from config.settings import settings
from typing import Dict
import json
import re


class StoryEngine:
    """Handles safety moderation, 2nd-person reformatting, and metadata extraction for shared stories"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "llama-3.3-70b-versatile"
        
    @staticmethod
    def get_system_prompt() -> str:
        return """You are a content processing and safety engine for a student mental wellness platform.
Given a journal entry, process it in 3 steps:

1. Safety Moderation:
   - Check for severe crisis indicators (active suicide plans, self-harm intent or instructions), hate speech, and PII (explicit personal names, email addresses, phone numbers, student ID numbers).
   - If the entry has severe crisis indicators or hate speech, set "is_safe" to false. Write a supportive, brief rejection message in "rejection_message" (e.g. directing them to seek support, contact crisis lines, or focus on their safety).
   - General feelings of anxiety, sadness, exam stress, loneliness, relationship stress, or struggles are SAFE. Do NOT reject these.

2. Reformat to Second-Person (only if is_safe is true):
   - Rewrite the story from first-person ("I", "my", "we", "us", "me") to second-person ("you", "your", "yours").
   - Strip any specific names of professors, courses, or universities and replace them with generic descriptions (e.g., "Professor Davis" becomes "your professor").
   - Keep the emotional core, vulnerability, and details of the experience completely intact, but write it as if telling a story to the reader ("you").
   - Do NOT abbreviate or truncate the story text; reformat the whole entry.

3. Extract Mood, Theme, and Resonance Hook (only if is_safe is true):
   - "mood": A single-word representing the dominant emotion (e.g., "Overwhelmed", "Lonely", "Anxious", "Determined", "Heartbroken").
   - "theme": A short phrase representing the core issue (e.g., "academic pressure", "imposter syndrome", "relationship difficulties", "burnout").
   - "resonance_hook": A short, poetic, evocative 1-line hook representing the entry's core theme (e.g., "When the weight of expectations makes every step feel uphill."). This hook must be strictly under 15 words.

Respond ONLY with a JSON object in this format with no markdown wrappers:
{
  "is_safe": true/false,
  "reformatted_text": "..." (null if unsafe),
  "mood": "..." (null if unsafe),
  "theme": "..." (null if unsafe),
  "resonance_hook": "..." (null if unsafe),
  "rejection_message": "..." (null if safe)
}"""

    async def process_entry(self, entry_text: str) -> Dict:
        """
        Process a journal entry through the 3-step sharing pipeline
        
        Args:
            entry_text: Decrypted text of the journal entry
            
        Returns:
            Dict containing processing result
        """
        try:
            # Check if API key exists
            if not getattr(settings, 'GROQ_API_KEY', None) and not self.client.api_key:
                raise ValueError("Groq API key not configured")
                
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Process the following journal entry:\n\n{entry_text}"}
                ],
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            # Extract and validate fields
            is_safe = result.get("is_safe", True)
            if not is_safe:
                return {
                    "is_safe": False,
                    "reformatted_text": None,
                    "mood": "Unsafe",
                    "theme": "unsafe",
                    "resonance_hook": None,
                    "rejection_message": result.get(
                        "rejection_message",
                        "Sonder is a supportive space, but it looks like you might need immediate crisis support. Please contact a counselor or crisis hotline."
                    )
                }
                
            return {
                "is_safe": True,
                "reformatted_text": result.get("reformatted_text", entry_text),
                "mood": result.get("mood", "Contemplative"),
                "theme": result.get("theme", "general sharing"),
                "resonance_hook": result.get("resonance_hook", "A shared moment of connection."),
                "rejection_message": None
            }
            
        except Exception as e:
            print(f"Error in StoryEngine AI pipeline: {e}. Using fallback processing.")
            return self._run_fallback(entry_text)
            
    def _run_fallback(self, entry_text: str) -> Dict:
        """Rule-based fallback for moderation, reformatting, and metadata extraction"""
        # 1. Simple crisis keyword check
        crisis_words = [
            "suicide", "kill myself", "end my life", "slit my wrists", "want to die",
            "hanging myself", "overdose", "cutting myself"
        ]
        text_lower = entry_text.lower()
        if any(word in text_lower for word in crisis_words):
            return {
                "is_safe": False,
                "reformatted_text": None,
                "mood": "Unsafe",
                "theme": "unsafe",
                "resonance_hook": None,
                "rejection_message": "It sounds like you're going through a lot right now. Please consider reaching out to a professional counselor or crisis support. Sonder is here, but we want to ensure your safety first."
            }
            
        # 2. Basic rule-based first-to-second-person reformatter
        # Replacing common pronouns
        replacements = [
            (r"\bI am\b", "you are"),
            (r"\bI'm\b", "you're"),
            (r"\bI have\b", "you have"),
            (r"\bI've\b", "you've"),
            (r"\bI will\b", "you will"),
            (r"\bI'd\b", "you'd"),
            (r"\bI\b", "you"),
            (r"\bmy\b", "your"),
            (r"\bmyself\b", "yourself"),
            (r"\bme\b", "you"),
            (r"\bwe are\b", "you are"),
            (r"\bwe\b", "you"),
            (r"\bus\b", "you"),
            (r"\bour\b", "your")
        ]
        
        reformatted = entry_text
        for pattern, replacement in replacements:
            reformatted = re.sub(pattern, replacement, reformatted, flags=re.IGNORECASE)
            
        # Standardize capitalization of the first letter
        if reformatted:
            reformatted = reformatted[0].upper() + reformatted[1:]
            
        # 3. Simple metadata parsing
        mood = "Contemplative"
        theme = "general reflection"
        
        moods_mapping = {
            "stressed": ("Stressed", "academic pressure"),
            "anxious": ("Anxious", "anxiety"),
            "sad": ("Sad", "loneliness"),
            "lonely": ("Lonely", "isolation"),
            "tired": ("Tired", "burnout"),
            "hopeful": ("Hopeful", "future plans"),
            "excited": ("Excited", "positive change")
        }
        
        for keyword, (m, t) in moods_mapping.items():
            if keyword in text_lower:
                mood = m
                theme = t
                break
                
        hook = "A quiet moment shared in anonymity."
        if mood == "Stressed":
            hook = "When the pressure rises, remember you are not carrying it alone."
        elif mood == "Anxious":
            hook = "Finding stillness in the midst of a rushing mind."
        elif mood == "Lonely":
            hook = "In the quiet spaces, a voice whispers that someone else feels this too."
            
        return {
            "is_safe": True,
            "reformatted_text": reformatted,
            "mood": mood,
            "theme": theme,
            "resonance_hook": hook,
            "rejection_message": None
        }


# Singleton instance
_story_engine = None

def get_story_engine() -> StoryEngine:
    global _story_engine
    if _story_engine is None:
        _story_engine = StoryEngine()
    return _story_engine
