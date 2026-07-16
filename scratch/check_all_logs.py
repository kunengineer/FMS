import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
sys.path.append(os.path.abspath("."))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import OperationLog, Vehicle, FailureLog

# Create DB Session
engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print(f"Total Vehicles: {db.query(Vehicle).count()}")
print(f"Total OperationLogs: {db.query(OperationLog).count()}")
print(f"Total FailureLogs: {db.query(FailureLog).count()}")

# Print some operation logs notes to see
logs = db.query(OperationLog).limit(10).all()
for l in logs:
    print(f"Log ID: {l.operation_id}, Date: {l.work_date}, Notes: {l.notes}")

db.close()
