import requests
import sys

BASE_URL = "http://localhost:8081/api/v1"


def test_auth():
    # 1. Register Student
    student_email = f"student_{sys.argv[1]}@example.com"
    print(f"Testing with {student_email}")

    try:
        res = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": student_email,
                "username": f"student_{sys.argv[1]}",
                "password": "password123",
                "role": "student",
            },
        )
        if res.status_code != 200 and res.status_code != 201:
            if "already registered" in res.text:
                print("User already exists, proceeding to login...")
            else:
                print(f"Register Student Failed: {res.text}")
                return
        else:
            print("Register Student Success")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 2. Login Student
    res = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": student_email, "password": "password123"},
    )

    if res.status_code != 200:
        print(f"Login Student Failed: {res.text}")
        return

    token = res.json()["access_token"]
    print("Login Student Success, Token received")

    # 3. Get Me
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/users/me", headers=headers)

    if res.status_code != 200:
        print(f"Get Me Failed: {res.text}")
        return

    print(f"Get Me Success: {res.json()['role']}")

    # 4. Register Counsellor
    counsellor_email = f"counsellor_{sys.argv[1]}@example.com"
    res = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": counsellor_email,
            "username": f"counsellor_{sys.argv[1]}",
            "password": "password123",
            "role": "counsellor",
            "experience": 5,
            "certification": "PhD",
        },
    )

    if res.status_code == 200 or res.status_code == 201:
        print("Register Counsellor Success")
    elif "already registered" in res.text:
        print("Counsellor already exists")
    else:
        print(f"Register Counsellor Failed: {res.text}")

    # 5. Login Counsellor (Should fail)
    res = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": counsellor_email, "password": "password123"},
    )

    if res.status_code == 403:
        print("Login Counsellor correctly forbidden (Unverified)")
    elif res.status_code == 200:
        print("Login Counsellor SUCCEEDED (Should have failed!)")
    else:
        print(f"Login Counsellor Check Failed: {res.status_code} {res.text}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_auth.py <unique_suffix>")
        sys.exit(1)
    test_auth()
