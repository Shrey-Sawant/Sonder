"""
Weekly Insights Service - Generates personalized emotional pattern insights
Analyzes mood data, journal categories, and timestamps from the past 7 days
"""

from groq import Groq
from config.settings import settings
from typing import Optional, Dict, List
import json
from datetime import datetime, timedelta
from collections import Counter


class InsightGenerator:
    """Generate weekly emotional insights"""
    
    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY if hasattr(settings, 'GROQ_API_KEY') else None)
        self.model = "mixtral-8x7b-32768"
    
    @staticmethod
    def get_system_prompt() -> str:
        """Get the insight generation system prompt"""
        return """You are generating a weekly emotional insight card for a college student.
Given mood data and journal categories, write:
- One observation (max 25 words, no jargon) - specific, data-driven
- One gentle reframe (max 25 words, no toxic positivity) - reframe the pattern healthily
- One micro-action suggestion (max 20 words, very small, doable today) - actionable tiny step

Output ONLY as JSON with no markdown:
{"observation": "...", "reframe": "...", "micro_action": "..."}"""
    
    def analyze_mood_frequency(self, moods: List[str]) -> Dict[str, int]:
        """Count mood frequency"""
        return dict(Counter(moods))
    
    def detect_time_of_day_pattern(self, timestamps: List[datetime]) -> Optional[str]:
        """Detect if entries cluster in specific hours"""
        if not timestamps:
            return None
        
        hours = [ts.hour for ts in timestamps]
        hour_counter = Counter(hours)
        
        # Group into time blocks
        morning = sum(hour_counter.get(h, 0) for h in range(6, 12))
        afternoon = sum(hour_counter.get(h, 0) for h in range(12, 18))
        evening = sum(hour_counter.get(h, 0) for h in range(18, 24))
        night = sum(hour_counter.get(h, 0) for h in range(0, 6))
        
        blocks = [
            ("morning (6am-12pm)", morning),
            ("afternoon (12pm-6pm)", afternoon),
            ("evening (6pm-12am)", evening),
            ("night (12am-6am)", night)
        ]
        
        peak_block, peak_count = max(blocks, key=lambda x: x[1])
        
        if peak_count >= len(timestamps) * 0.4:  # 40%+ of entries
            return peak_block
        
        return None
    
    def detect_positive_streaks(self, moods: List[str], timestamps: List[datetime]) -> Optional[List[Dict]]:
        """Detect consecutive days of positive moods"""
        positive_moods = {"hopeful", "calm", "grateful"}
        
        streaks = []
        current_streak = []
        
        for mood, ts in zip(moods, timestamps):
            if mood in positive_moods:
                if not current_streak or (current_streak and (ts.date() - current_streak[-1].date()).days <= 1):
                    current_streak.append(ts)
                else:
                    if len(current_streak) >= 3:
                        streaks.append({
                            "dates": [ts.date().isoformat() for ts in current_streak],
                            "mood": mood
                        })
                    current_streak = [ts]
            else:
                if len(current_streak) >= 3:
                    streaks.append({
                        "dates": [ts.date().isoformat() for ts in current_streak],
                        "mood": moods[timestamps.index(current_streak[-1])]
                    })
                current_streak = []
        
        return streaks if streaks else None
    
    async def generate_weekly_insights(
        self,
        moods: List[str],
        timestamps: List[datetime],
        categories: List[str]
    ) -> Optional[Dict]:
        """
        Generate weekly insights from journal data
        
        Args:
            moods: List of mood strings from past 7 days
            timestamps: Corresponding timestamps
            categories: Prompt categories (academic, social, identity, general)
        
        Returns:
            Dict with observation, reframe, micro_action
        """
        try:
            # Analyze patterns
            mood_freq = self.analyze_mood_frequency(moods)
            category_freq = dict(Counter(categories))
            time_pattern = self.detect_time_of_day_pattern(timestamps)
            positive_streaks = self.detect_positive_streaks(moods, timestamps)
            
            # Find most frequent mood
            top_mood, top_count = max(mood_freq.items(), key=lambda x: x[1]) if mood_freq else (None, 0)
            
            # Find most frequent category
            top_category, top_cat_count = max(category_freq.items(), key=lambda x: x[1]) if category_freq else (None, 0)
            
            # Build prompt
            data_summary = f"""
Past 7 days summary:
- Most frequent mood: {top_mood} ({top_count} of {len(moods)} entries)
- Mood breakdown: {json.dumps(mood_freq)}
- Most common journal topic: {top_category} ({top_cat_count} entries)
- Time of day pattern: {time_pattern or 'mixed throughout day'}
- Positive streaks: {json.dumps(positive_streaks) if positive_streaks else 'none identified'}
"""
            
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.get_system_prompt()},
                    {"role": "user", "content": f"Generate insights based on this data:\n{data_summary}"}
                ],
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            result = json.loads(response_text)
            
            return {
                "observation": result.get("observation", ""),
                "reframe": result.get("reframe", ""),
                "micro_action": result.get("micro_action", ""),
                "mood_frequency_data": json.dumps(mood_freq),
                "trigger_categories": json.dumps(category_freq),
                "time_of_day_pattern": time_pattern,
                "positive_streaks": json.dumps(positive_streaks) if positive_streaks else None
            }
        
        except json.JSONDecodeError as e:
            print(f"Error parsing insight response as JSON: {e}")
            return None
        except Exception as e:
            print(f"Error generating insights: {e}")
            return None


# Singleton instance
_generator = None

def get_insight_generator() -> InsightGenerator:
    """Get or create singleton generator instance"""
    global _generator
    if _generator is None:
        _generator = InsightGenerator()
    return _generator
