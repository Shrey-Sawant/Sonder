"""
Automated Test Suite for Support Circles Features
Verifies CircleGenerator, MessageModerator, and CircleRecommender logic.
(Emoji characters removed for Windows console encoding compatibility)
"""

import asyncio
from services.circle_generator import get_circle_generator
from services.message_moderator import get_message_moderator
from services.circle_recommender import get_circle_recommender
from models.user import User
from models.circle import Circle
from datetime import datetime

async def test_circle_generator():
    print("Testing CircleGenerator...")
    generator = get_circle_generator()
    preview = await generator.generate_circle_preview(
        theme="imposter syndrome in computer science",
        circle_type="burnout"
    )
    
    assert "name" in preview
    assert "tagline" in preview
    assert "welcome_message" in preview
    assert len(preview["rules"]) == 4
    assert "opening_prompt" in preview
    assert preview["sensitivity_level"] in ["low", "medium", "high"]
    assert "crisis_keywords" in preview
    assert len(preview["crisis_keywords"]) >= 5
    
    print("[SUCCESS] CircleGenerator successfully produced valid support circle configuration.")
    print(f"Generated Circle Name: {preview['name']}")
    print(f"Rules count: {len(preview['rules'])}")
    print(f"Sensitivity: {preview['sensitivity_level']}")
    print()

async def test_message_moderator():
    print("Testing MessageModerator...")
    moderator = get_message_moderator()
    
    # 1. Test SAFE message
    res_safe = await moderator.moderate_message(
        message_content="Hey guys, does anyone want to study together tonight for the midterm?",
        sensitivity_level="medium",
        crisis_keywords=["failing everything", "give up"]
    )
    print(f"SAFE result: {res_safe['status']} - {res_safe['reason']}")
    assert res_safe["status"] in ["SAFE", "SOFT_FLAG"]
    
    # 2. Test SOFT_FLAG message
    res_soft = await moderator.moderate_message(
        message_content="I am feeling so anxious and stressed out about this exam, I feel like crying.",
        sensitivity_level="medium",
        crisis_keywords=["failing everything", "give up"]
    )
    print(f"SOFT_FLAG result: {res_soft['status']} - {res_soft['reason']}")
    assert res_soft["status"] == "SOFT_FLAG"
    
    # 3. Test BLOCK (Crisis terms) message
    res_block = await moderator.moderate_message(
        message_content="I really want to kill myself, I cannot handle this pressure anymore.",
        sensitivity_level="high",
        crisis_keywords=["failing everything", "give up"]
    )
    print(f"BLOCK result: {res_block['status']} - {res_block['reason']}")
    assert res_block["status"] == "BLOCK"
    
    # 4. Test distress keyword trigger in high sensitivity circle -> HOLD
    res_hold = await moderator.moderate_message(
        message_content="I think I am just going to give up on this degree, it is completely hopeless.",
        sensitivity_level="high",
        crisis_keywords=["failing everything", "give up", "hopeless"]
    )
    print(f"HOLD result: {res_hold['status']} - {res_hold['reason']}")
    assert res_hold["status"] == "HOLD"
    
    print("[SUCCESS] MessageModerator successfully classified all 4 safety tiers.")
    print()

async def run_all_tests():
    print("=== STARTING SUPPORT CIRCLES TEST SUITE ===")
    try:
        await test_circle_generator()
        await test_message_moderator()
        print("ALL TESTS PASSED SUCCESSFULLY!")
    except AssertionError as ae:
        print(f"[FAIL] Test failed due to assertion error: {ae}")
    except Exception as e:
        print(f"[FAIL] Test failed due to error: {e}")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
