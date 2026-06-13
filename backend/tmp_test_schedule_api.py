import os
from dotenv import load_dotenv
load_dotenv()
from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token
from datetime import datetime, timedelta

# Use a verified student account from the DB output
email = 'shreysawant01@gmail.com'
role = 'student'
# Generate token using SECRET_KEY
access_token = create_access_token(data={'sub': email, 'role': role}, expires_delta=timedelta(minutes=60))
client = TestClient(app)
headers = {'Authorization': f'Bearer {access_token}'}

# Check busy slots for counsellor 23 tomorrow
from datetime import date
scheduled_date = (date.today() + timedelta(days=1)).isoformat()
print('Busy slots request', scheduled_date)
resp = client.get('/api/v1/schedule/busy-slots', headers=headers, params={'counsellor_id': 23, 'selected_date': scheduled_date})
print('busy slots status', resp.status_code, resp.text)

# Create a booking request at 10:00
payload = {
    'counsellor_id': 23,
    'scheduled_time': f'{scheduled_date}T10:00:00'
}
resp2 = client.post('/api/v1/schedule/', json=payload, headers=headers)
print('create status', resp2.status_code, resp2.text)

# Fetch schedule requests for authenticated student
resp3 = client.get('/api/v1/schedule/', headers=headers)
print('list status', resp3.status_code, resp3.text)
