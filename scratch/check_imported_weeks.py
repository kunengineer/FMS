import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import OperationLog

# Create DB Session
engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

logs = db.query(OperationLog).filter(
    (OperationLog.notes.like("%Weekly Report%") | OperationLog.notes.like("%báo cáo tuần%"))
).all()

print(f"Total Weekly Report OperationLogs in DB: {len(logs)}")
weeks = set()
for log in logs:
    weeks.add(str(log.work_date))
print(f"Imported weeks in database: {sorted(list(weeks))}")

db.close()
