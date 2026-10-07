"""
Crisis Detection Service - risk assessment for emotional wellbeing.

Classifies messages/entries into LOW/MEDIUM/HIGH risk categories. When the AI
provider is unavailable the service falls back to deterministic keyword rules
instead of reporting LOW, so a provider outage never silently disables crisis
detection.
"""

import json
import logging
from typing import Dict

from groq import Groq

from config.settings import settings

logger = logging.getLogger(__name__)

# Conservative, high-precision phrases. Matching any of these escalates to HIGH
# even when the AI model cannot be reached.
_HIGH_RISK_TERMS = (
    "kill myself",
    "kill my self",
    "end my life",
    "ending my life",
    "want to die",
    "wanna die",
    "better off dead",
    "no reason to live",
    "don't want to live",
    "dont want to live",
    "suicide",
    "suicidal",
    "self-harm",
    "self harm",
    "hurt myself",
    "cut myself",
    "overdose",
)

_MEDIUM_RISK_TERMS = (
    "hopeless",
    "worthless",
    "can't go on",
    "cant go on",
    "no way out",
    "trapped",
    "hate myself",
    "give up",
    "burden to everyone",
    "nobody would care",
)


class CrisisDetector:
    """Crisis signal detection backed by an LLM with a rule-based fallback."""

    def __init__(self):
        api_key = settings.GROQ_API_KEY
        self.client = Groq(api_key=api_key) if api_key else None
        self.model = "llama-3.3-70b-versatile"

    @staticmethod
    def get_system_prompt() -> str:
        return """You are assessing a message from a college student for emotional risk.
Classify as: LOW / MEDIUM / HIGH.

- LOW = general stress, sadness, academic anxiety
- MEDIUM = hopelessness, withdrawal signals, expressions of meaninglessness
- HIGH = mentions of self-harm, suicide ideation, severe abuse

Respond ONLY with JSON:
{"risk": "LOW"|"MEDIUM"|"HIGH", "signal": "brief description of what you detected"}"""

    @staticmethod
    def _keyword_assessment(text: str) -> Dict:
        lowered = (text or "").lower()
        for term in _HIGH_RISK_TERMS:
            if term in lowered:
                return {
                    "risk_level": "HIGH",
                    "signal": f"High-risk phrase detected: {term}",
                    "requires_intervention": True,
                }
        for term in _MEDIUM_RISK_TERMS:
            if term in lowered:
                return {
                    "risk_level": "MEDIUM",
                    "signal": f"Distress phrase detected: {term}",
                    "requires_intervention": True,
                }
        return {
            "risk_level": "LOW",
            "signal": "",
            "requires_intervention": False,
        }

    async def assess_risk(self, text: str, source_type: str = "message") -> Dict:
        """
        Assess the emotional risk level of a message.

        Args:
            text: The message/entry to assess.
            source_type: "message", "journal", or "mood_streak".
        """
        if not text or not text.strip():
            return {
                "risk_level": "LOW",
                "signal": "",
                "requires_intervention": False,
            }

        if self.client is None:
            return self._keyword_assessment(text)

        try:
            context = f"[{source_type.upper()}] "
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Assess this:\n\n{context}{text}"},
                ],
                max_tokens=200,
                response_format={"type": "json_object"},
            )

            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)

            risk_level = str(result.get("risk", "")).upper()
            if risk_level not in ("LOW", "MEDIUM", "HIGH"):
                # Unusable model output: defer to the deterministic rules.
                return self._keyword_assessment(text)

            return {
                "risk_level": risk_level,
                "signal": result.get("signal", ""),
                "requires_intervention": risk_level in ("MEDIUM", "HIGH"),
            }

        except json.JSONDecodeError as e:
            logger.warning("Crisis detection returned invalid JSON: %s", e)
            return self._keyword_assessment(text)
        except Exception as e:
            logger.error("Crisis detection provider error: %s", e)
            return self._keyword_assessment(text)


_detector = None


def get_crisis_detector() -> CrisisDetector:
    """Get or create singleton detector instance."""
    global _detector
    if _detector is None:
        _detector = CrisisDetector()
    return _detector
