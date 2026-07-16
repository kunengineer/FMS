import sys
from sqlalchemy import create_engine, text

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")

with engine.connect() as conn:
    print("=== SHIFT LOG #12730 ===")
    res = conn.execute(text("SELECT operation_id, vehicle_id, work_date, notes FROM operation_logs WHERE operation_id = 12730"))
    for row in res:
        print(row)
        
    print("\n=== FAILURES ===")
    res2 = conn.execute(text("SELECT failure_id, description, is_repaired FROM failure_logs WHERE operation_id = 12730"))
    for row in res2:
        print(row)
        failure_id = row[0]
        
        print("\n=== REPAIRS FOR FAILURE", failure_id, "===")
        res3 = conn.execute(text("SELECT repair_id, repair_status, note, parts_used FROM repair_logs WHERE failure_id = :fid"), {"fid": failure_id})
        for row3 in res3:
            print(row3)
