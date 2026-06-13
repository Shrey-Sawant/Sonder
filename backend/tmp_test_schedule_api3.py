import os
from dotenv import load_dotenv
load_dotenv()
from httpx import AsyncClient, ASGITransport
from main import app
from core.security import create_access_token
from datetime import date, timedelta
import asyncio

email = 'shreysawant01@gmail.com'
role = 'student'
access_token = create_access_token(data={'sub': email, 'role': role}, expires_delta=timedelta(minutes=60))
headers = {'Authorization': f'Bearer {access_token}'}

async def main():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        scheduled_date = (date.today() + timedelta(days=1)).isoformat()
        print('Busy slots request', scheduled_date)
        r1 = await client.get('/api/v1/schedule/busy-slots', headers=headers, params={'counsellor_id': 23, 'selected_date': scheduled_date})
        print('busy slots', r1.status_code, r1.text)

        payload = {'counsellor_id': 23, 'scheduled_time': f'{scheduled_date}T10:00:00'}
        r2 = await client.post('/api/v1/schedule/', json=payload, headers=headers)
        print('create', r2.status_code, r2.text)

        r3 = await client.get('/api/v1/schedule/', headers=headers)
        print('list', r3.status_code, r3.text)

asyncio.run(main())
