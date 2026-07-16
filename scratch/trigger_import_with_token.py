import sys
import os
import httpx

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

# Configure stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.security import create_access_token

token = create_access_token(subject="ADMIN")
headers = {"Authorization": f"Bearer {token}"}

filepath = "d:/Project/Fleet-Manager-System/Mau_Bao_Cao_Chuan.xlsx"
url = "http://127.0.0.1:8000/api/imports/weekly-report"
files = {"file": ("Mau_Bao_Cao_Chuan.xlsx", open(filepath, "rb"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}

r = httpx.post(url, files=files, headers=headers, timeout=30.0)
print(f"Response status: {r.status_code}")
import pprint
pprint.pprint(r.json())
