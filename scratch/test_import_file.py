import sys
import os

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import UploadFile
import io

# Configure stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Mock current user
from app.models import Operator
from app.routers.imports import import_weekly_report_excel

# Create DB Session
engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Get mock user (admin or any operator)
user = db.query(Operator).filter_by(operator_id="OP_DEFAULT").first()
if not user:
    user = db.query(Operator).first()
print(f"Logged in user: {user.full_name} ({user.operator_id})")

class MockUploadFile(UploadFile):
    def __init__(self, filepath):
        self.filename = os.path.basename(filepath)
        self.filepath = filepath
        with open(filepath, "rb") as f:
            self.file_content = f.read()
        self.file = io.BytesIO(self.file_content)

    async def read(self, size: int = -1) -> bytes:
        return self.file_content

async def run_test():
    files_to_test = [
        "d:/Project/Fleet-Manager-System/BC HDPT T23-2026.xlsx",
        "d:/Project/Fleet-Manager-System/Mau_Bao_Cao_Chuan.xlsx",
        "d:/Project/Fleet-Manager-System/BC HDPT T23-2026.xls"
    ]
    for filepath in files_to_test:
        if not os.path.exists(filepath):
            print(f"File not found: {filepath}")
            continue
        print(f"\n--- Testing import of {filepath} ---")
        mock_file = MockUploadFile(filepath)
        try:
            # We run in a transaction and rollback at the end to keep db clean
            db.begin_nested()
            result = await import_weekly_report_excel(file=mock_file, db=db, current_user=user)
            print("Import Success!")
            print("Result:", result)
            db.rollback() # Rollback to keep database clean
        except Exception as e:
            print("Import Failed!")
            import traceback
            traceback.print_exc()
            db.rollback()

import asyncio
asyncio.run(run_test())
db.close()
