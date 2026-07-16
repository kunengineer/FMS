import httpx
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

# Configure stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

filepath = "d:/Project/Fleet-Manager-System/Mau_Bao_Cao_Chuan.xlsx"
if not os.path.exists(filepath):
    print("File not found.")
    os._exit(1)

# Authenticate first
login_url = "http://127.0.0.1:8000/api/auth/login"
# Let's check a user to login. Usually OP_DEFAULT or admin.
# Let's try ME_ADMIN or OP_ADMIN or default admin if seeded.
# Let's try admin/123456
payload = {"username": "admin", "password": "password"} # wait, what are credentials?
# Let's check users in db to find valid login credentials.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Operator

engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()
u = db.query(Operator).first()
print(f"Sample operator in DB: id={u.operator_id}, name={u.full_name}")

# Let's perform the HTTP request with the auth headers or cookies from a session.
# We can bypass auth check in FastAPI if we use a mock token or get a real one.
# Let's try login with admin.
headers = {}
try:
    r = httpx.post("http://127.0.0.1:8000/api/auth/login", json={"operator_id": u.operator_id, "password": "password"})
    if r.status_code == 200:
        token = r.json()["access_token"]
        headers["Authorization"] = f"Bearer {token}"
        print("Logged in successfully!")
    else:
        # try default password '123456'
        r = httpx.post("http://127.0.0.1:8000/api/auth/login", json={"operator_id": u.operator_id, "password": "123456"})
        if r.status_code == 200:
            token = r.json()["access_token"]
            headers["Authorization"] = f"Bearer {token}"
            print("Logged in successfully with '123456'!")
        else:
            print(f"Login failed: {r.status_code} - {r.text}")
except Exception as e:
    print("Login error:", e)

# Send import request
url = "http://127.0.0.1:8000/api/imports/weekly-report"
files = {"file": ("Mau_Bao_Cao_Chuan.xlsx", open(filepath, "rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}

r = httpx.post(url, files=files, headers=headers, timeout=30.0)
print(f"Response status: {r.status_code}")
import pprint
pprint.pprint(r.json())
db.close()
