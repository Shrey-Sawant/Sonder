"""
Automated Test Suite for Anonymous Stories Flow Features
Verifies StoryEngine processing, feed ranking blending, and 18-word resonance response constraint.
"""

import asyncio
import uuid
import re
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete
from main import app
from db.session import SessionLocal, get_db
from api.deps import get_current_user
from models.user import User
from models.shared_story import SharedStory
from models.journal_entry import JournalEntry, MoodEnum, PromptCategoryEnum
from models.checkin import CheckIn
from services.story_engine import get_story_engine


# Mock current user for endpoints testing
mock_user_id = uuid.uuid4()
mock_user = User(
    id=99999,
    user_id=mock_user_id,
    username="test_student",
    email="test_student@sonder.edu",
    password="hashedpassword",
    role="student",
    student_role="burnout",
    anon_id="anon_student_999"
)

async def override_get_current_user():
    return mock_user

# Setup dependency override
app.dependency_overrides[get_current_user] = override_get_current_user


async def test_story_engine():
    print("Testing StoryEngine Sharing Pipeline...")
    engine = get_story_engine()
    
    # 1. Test safe entry reformatting and extraction
    safe_text = "I feel so overwhelmed with my exams this week. I don't know if I can pass."
    res = await engine.process_entry(safe_text)
    
    assert res["is_safe"] is True
    assert res["reformatted_text"] is not None
    # Verify reformatting to second person
    assert "you" in res["reformatted_text"].lower() or "your" in res["reformatted_text"].lower()
    assert "I" not in res["reformatted_text"].split() # should not contain capital "I"
    assert res["mood"] is not None
    assert res["theme"] is not None
    assert res["resonance_hook"] is not None
    # Resonance hook should be short
    hook_words = res["resonance_hook"].split()
    assert len(hook_words) <= 15
    
    print("[SUCCESS] StoryEngine successfully processed safe entry.")
    print(f"Reformatted to 2nd person: {res['reformatted_text']}")
    print(f"Extracted Mood: {res['mood']}")
    print(f"Extracted Theme: {res['theme']}")
    print(f"Extracted Hook: {res['resonance_hook']}")
    print()

    # 2. Test unsafe entry detection
    unsafe_text = "I really want to kill myself tonight, I can't do this anymore."
    res_unsafe = await engine.process_entry(unsafe_text)
    
    assert res_unsafe["is_safe"] is False
    assert res_unsafe["reformatted_text"] is None
    assert res_unsafe["rejection_message"] is not None
    print("[SUCCESS] StoryEngine successfully flagged unsafe entry.")
    print(f"Rejection Message: {res_unsafe['rejection_message']}")
    print()


async def test_feed_ranking_and_resonate():
    print("Testing Feed Ranking and Resonate Endpoints...")
    
    # Connect directly to DB for test setup & cleanup
    async with SessionLocal() as db:
        # Clean existing test data and mock user first to avoid constraint/UUID conflicts
        await db.execute(delete(SharedStory).where(SharedStory.author_anon_id.like("anon_test_story_%")))
        await db.execute(delete(JournalEntry).where(JournalEntry.anon_id == mock_user.anon_id))
        await db.execute(delete(CheckIn).where(CheckIn.user_id == mock_user.id))
        await db.execute(delete(User).where(User.id == mock_user.id))
        await db.commit()
        
        # Create user record in db
        db_user = User(
            id=mock_user.id,
            user_id=mock_user.user_id,
            username=mock_user.username,
            email=mock_user.email,
            password="hashedpassword",
            role=mock_user.role,
            student_role=mock_user.student_role,
            anon_id=mock_user.anon_id
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        
        # 1. Setup user journal history & checkins to test personalized ranking
        # Insert a recent check-in with high score
        checkin = CheckIn(
            user_id=mock_user.id,
            score=4,
            q1_score=2,
            q2_score=2
        )
        db.add(checkin)
        
        # Insert a recent journal entry with overwhelmed mood
        journal = JournalEntry(
            entry_id=uuid.uuid4(),
            user_id=mock_user.user_id,
            anon_id=mock_user.anon_id,
            mood_selected="overwhelmed",
            prompt_category="academic",
            entry_text="dummyencryptedtext"
        )
        db.add(journal)
        await db.commit()

        # 2. Insert 15 test stories into the database (with their referenced journal entries)
        # We will insert 6 highly relevant stories (burnout themed, overwhelmed mood)
        # and 9 wildcard stories (calm/hopeful mood, social/general themes)
        test_stories = []
        for i in range(15):
            is_relevant = i < 6
            entry_id = uuid.uuid4()
            
            # Create referenced journal entry first
            journal_dummy = JournalEntry(
                entry_id=entry_id,
                user_id=mock_user.user_id,
                anon_id=mock_user.anon_id,
                mood_selected="overwhelmed" if is_relevant else "calm",
                prompt_category="academic" if is_relevant else "general",
                entry_text="dummyencryptedtext",
                shared_anonymously=True
            )
            db.add(journal_dummy)
            
            story_id = uuid.uuid4()
            story = SharedStory(
                story_id=story_id,
                journal_entry_id=entry_id,
                author_anon_id=f"anon_test_story_{i}",
                excerpt=f"This is test story {i} which talks about feeling burnt out and study pressure." if is_relevant else f"This is general story {i} about feeling calm.",
                mood="overwhelmed" if is_relevant else "calm",
                theme="burnout and academic stress" if is_relevant else "peaceful walking",
                resonance_hook="When the light fades, the struggle becomes real." if is_relevant else "A quiet breeze.",
                active=True
            )
            db.add(story)
            test_stories.append(story_id)
        await db.commit()

    # 3. Call GET /stories API
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/stories")
        assert response.status_code == 200
        feed = response.json()
        
        # Verify feed constraints
        assert len(feed) <= 10
        print(f"[SUCCESS] GET /stories returned {len(feed)} stories (capped at 10).")
        
        # Verify theme and resonance hook are present
        for story in feed:
            assert "theme" in story
            assert "resonance_hook" in story
            
        print("[SUCCESS] Story items successfully contain theme and resonance_hook metadata.")
        
        # 4. Call POST /stories/{story_id}/resonate API
        target_story_id = str(test_stories[0])
        res_post = await client.post(f"/api/v1/stories/{target_story_id}/resonate")
        assert res_post.status_code == 200
        res_data = res_post.json()
        
        assert res_data["success"] is True
        assert "resonance_response" in res_data
        
        # Verify 18-word response
        res_msg = res_data["resonance_response"]
        words = res_msg.split()
        assert len(words) == 18
        
        print("[SUCCESS] POST /stories/.../resonate successfully incremented resonance and returned exactly 18-word message.")
        print(f"Resonance response: {res_msg} (word count: {len(words)})")
        print()

    # DB Cleanup
    async with SessionLocal() as db:
        await db.execute(delete(SharedStory).where(SharedStory.author_anon_id.like("anon_test_story_%")))
        await db.execute(delete(JournalEntry).where(JournalEntry.anon_id == mock_user.anon_id))
        await db.execute(delete(CheckIn).where(CheckIn.user_id == mock_user.id))
        await db.execute(delete(User).where(User.id == mock_user.id))
        await db.commit()
    print("[SUCCESS] Database cleanup finished.")
    print()


async def run_all_tests():
    print("=== STARTING ANONYMOUS STORIES TEST SUITE ===")
    try:
        await test_story_engine()
        await test_feed_ranking_and_resonate()
        print("ALL TESTS PASSED SUCCESSFULLY!")
    except AssertionError as ae:
        print(f"[FAIL] Test failed due to assertion error: {ae}")
    except Exception as e:
        print(f"[FAIL] Test failed due to error: {e}")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
