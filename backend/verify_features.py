import requests
import sys

BASE_URL = "http://localhost:8081/api/v1"


def verify_features():
    # 1. Login Student
    student_email = "student_999@example.com"  # reusing or creating new
    try:
        # Register just in case
        requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": student_email,
                "username": "student_999",
                "password": "password123",
                "role": "student",
            },
        )
    except:
        pass

    res = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": student_email, "password": "password123"},
    )
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Chat Session
    res = requests.post(
        f"{BASE_URL}/chat/sessions",
        headers=headers,
        json={"student_id": res.json()["id"], "chat_type": "ai", "status": "active"},
    )
    if res.status_code == 200:
        print("Create Chat Session Success")
        session_id = res.json()["id"]

        # 3. Send Message
        res = requests.post(
            f"{BASE_URL}/chat/messages",
            headers=headers,
            json={
                "session_id": session_id,
                "sender_role": "student",
                "message": "Hello AI",
            },
        )
        if res.status_code == 200:
            print("Send Message Success")
    else:
        print(f"Create Session Failed: {res.text}")

    # 4. Schedule Request
    res = requests.post(
        f"{BASE_URL}/schedule/",
        headers=headers,
        json={
            "student_id": 1,  # assuming ID 1 exists
            "counsellor_id": 2,  # assuming
            "scheduled_time": "2025-12-30T10:00:00",
            "status": "pending",
        },
    )
    if res.status_code == 200:
        print("Create Schedule Request Success")
    else:
        print(f"Schedule Request Failed: {res.text}")


if __name__ == "__main__":
    verify_features()
