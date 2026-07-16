import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import UploadFile
import io

# Configure stdout
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from app.models import Operator
from app.routers.imports import import_weekly_report_excel

# Create DB Session
engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

user = db.query(Operator).filter_by(operator_id="OP_DEFAULT").first()
if not user:
    user = db.query(Operator).first()

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
        print(f"\n--- Checking import details of {filepath} ---")
        mock_file = MockUploadFile(filepath)
        
        # We start a transaction but we will NOT commit it
        # Wait, since the code has db.commit(), let's run in a separate test SQLite database
        # or just run it and see the result, but wait! We want to see what is already in the PostgreSQL DB.
        # Let's run it on the live PG DB but rollback at the end.
        # Note: If the code calls db.commit(), standard SQLAlchemy nested transactions (savepoints)
        # allow rollback to savepoint even if db.commit() is called inside if we use begin_nested() correctly,
        # but in Postgres it's safest to just query and see what's returned.
        try:
            db.begin_nested()
            result = await import_weekly_report_excel(file=mock_file, db=db, current_user=user)
            print("Status Code: 200")
            print("Result stats:")
            import pprint
            pprint.pprint(result)
            db.rollback()
        except Exception as e:
            print("Error occurred:")
            import traceback
            traceback.print_exc()
            db.rollback()

import asyncio
asyncio.run(run_test())
db.close()
