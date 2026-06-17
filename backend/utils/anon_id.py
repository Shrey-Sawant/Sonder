"""
AnonID generator - creates unique anonymous identifiers
Format: [adjective][noun][3-digit number]
Example: calmRiver247, quietMoon091, boldEcho513
"""

import random
from typing import Optional


# Wellness-related adjectives (calm, quiet, bold, gentle, still, soft, bright, clear, open, warm)
ADJECTIVES = [
    "calm", "quiet", "bold", "gentle", "still", 
    "soft", "bright", "clear", "open", "warm"
]

# Nature-based nouns (river, moon, echo, forest, wave, peak, cloud, ember, tide, stone)
NOUNS = [
    "river", "moon", "echo", "forest", "wave",
    "peak", "cloud", "ember", "tide", "stone"
]


def generate_anon_id() -> str:
    """
    Generate a unique anonymous ID
    
    Format: [adjective][noun][3-digit number]
    Example: calmRiver247
    
    Returns:
        str: Unique anonymous ID
    """
    adjective = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    number = str(random.randint(0, 999)).zfill(3)
    
    # Format: adjective + capitalized noun + number
    return f"{adjective}{noun[0].upper()}{noun[1:]}{number}"


def validate_anon_id(anon_id: str) -> bool:
    """
    Validate that an anon_id follows the correct format
    
    Args:
        anon_id: The anonymous ID to validate
    
    Returns:
        bool: True if valid format
    """
    if not anon_id or len(anon_id) < 6:
        return False
    
    # Check if it ends with 3 digits
    if not anon_id[-3:].isdigit():
        return False
    
    body = anon_id[:-3]
    # Find the uppercase letter that separates adjective and noun
    cap_idx = -1
    for i, char in enumerate(body):
        if char.isupper():
            cap_idx = i
            break
            
    if cap_idx == -1:
        return False
        
    adj = body[:cap_idx]
    noun = body[cap_idx:].lower()
    
    return adj in ADJECTIVES and noun in NOUNS


# Test
if __name__ == "__main__":
    for _ in range(10):
        anon_id = generate_anon_id()
        print(f"{anon_id} - Valid: {validate_anon_id(anon_id)}")
