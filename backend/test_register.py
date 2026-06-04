import requests
import string
import random

email = f"test_{''.join(random.choices(string.ascii_lowercase, k=5))}@example.com"
url = "http://localhost:8000/api/v1/auth/register"
data = {
    "email": email,
    "username": f"counsler_{random.randint(100, 999)}",
    "password": "password123",
    "role": "counsellor"
}
try:
    response = requests.post(url, json=data)
    print("Status Code:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
