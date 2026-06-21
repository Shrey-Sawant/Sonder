"""
Circle Recommender Service - Personalized recommendations for Support Circles
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.circle import Circle
from models.user import User
from models.journal_entry import JournalEntry
from models.checkin import CheckIn
from core.encryption import decrypt_string
from datetime import datetime
from typing import List, Dict
import collections


class CircleRecommender:
    """Recommend circles based on student profile, mood history, journal themes, and time of day"""
    
    async def get_recommendations(self, user: User, db: AsyncSession) -> List[Circle]:
        """
        Get recommended support circles for a student
        
        Args:
            user: The current User object
            db: Database session
            
        Returns:
            List of recommended Circle objects
        """
        try:
            # 1. Fetch all available circles
            stmt = select(Circle)
            res = await db.execute(stmt)
            all_circles = res.scalars().all()
            
            if not all_circles:
                return []
                
            # 2. Fetch student's recent journal entries (limit to 5)
            stmt_journals = (
                select(JournalEntry)
                .where(JournalEntry.user_id == user.user_id)
                .order_by(JournalEntry.created_at.desc())
                .limit(5)
            )
            res_journals = await db.execute(stmt_journals)
            recent_journals = res_journals.scalars().all()
            
            # Extract recent moods & keywords
            recent_moods = []
            journal_texts = []
            for j in recent_journals:
                recent_moods.append(j.mood_selected.value if hasattr(j.mood_selected, 'value') else str(j.mood_selected))
                try:
                    decrypted_text = decrypt_string(j.entry_text)
                    if decrypted_text:
                        journal_texts.append(decrypted_text.lower())
                except Exception:
                    pass
                    
            # 3. Fetch recent checkins
            stmt_checkins = (
                select(CheckIn)
                .where(CheckIn.user_id == user.id)
                .order_by(CheckIn.created_at.desc())
                .limit(5)
            )
            res_checkins = await db.execute(stmt_checkins)
            recent_checkins = res_checkins.scalars().all()
            avg_checkin_score = sum(c.score for c in recent_checkins) / len(recent_checkins) if recent_checkins else 0
            
            # 4. Check time of day (late-night check: 11 PM to 4 AM)
            current_hour = datetime.now().hour
            is_late_night = current_hour >= 23 or current_hour < 4
            
            # 5. Score each circle
            scored_circles = []
            for circle in all_circles:
                score = 0.0
                
                # Check if student is already in this circle
                # We will handle user membership in API router, but if we have the chat thread, we can check.
                # However, for recommendations, we suggest circles the student might be interested in.
                
                # A. Profile focus area match (student_role)
                if user.student_role and circle.type.lower() == user.student_role.lower():
                    score += 6.0
                    
                # B. Mood matching
                # E.g. if recent moods are anxious/sad/overwhelmed and circle matches
                if recent_moods:
                    most_common_mood = collections.Counter(recent_moods).most_common(1)[0][0]
                    if most_common_mood in ["anxious", "overwhelmed", "frustrated"] and circle.sensitivity_level in ["medium", "high"]:
                        score += 3.0
                    if most_common_mood in ["sad", "numb"] and circle.type in ["burnout", "relationship stress"]:
                        score += 2.0
                        
                # C. Checkin PHQ-2 score matching
                # High score (> 3) triggers higher distress weight for high sensitivity circles
                if avg_checkin_score >= 3 and circle.sensitivity_level == "high":
                    score += 4.0
                    
                # D. Journal text keyword matching
                # See if decrypted journal entries contain any of the circle's crisis keywords
                if journal_texts and circle.crisis_keywords:
                    keyword_matches = 0
                    for text in journal_texts:
                        for kw in circle.crisis_keywords:
                            if kw.lower() in text:
                                keyword_matches += 1
                    # cap keyword boost
                    score += min(keyword_matches * 1.5, 4.5)
                    
                # E. Late night emotional boost
                # Late night users get recommended high-sensitivity circles (burnout, crisis support)
                if is_late_night:
                    if circle.sensitivity_level == "high":
                        score += 5.0
                    elif circle.sensitivity_level == "medium":
                        score += 3.0
                        
                # F. Tie breaker: newer circles get slightly higher priority
                score += (circle.created_at.timestamp() / 1e10)
                
                scored_circles.append((circle, score))
                
            # 6. Sort by score descending and return circles
            scored_circles.sort(key=lambda x: x[1], reverse=True)
            return [item[0] for item in scored_circles[:4]]
        except Exception as e:
            print(f"Error in CircleRecommender: {e}")
            return []


# Singleton instance
_circle_recommender = None

def get_circle_recommender() -> CircleRecommender:
    global _circle_recommender
    if _circle_recommender is None:
        _circle_recommender = CircleRecommender()
    return _circle_recommender
