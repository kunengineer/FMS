from sqlalchemy import create_engine
from sqlalchemy.sql import text

def clean_db():
    engine = create_engine("postgresql://postgres:Kien04112004!@localhost:5432/fleet_db")
    with engine.begin() as conn:
        # 1. Update safety confirmed checklist results
        print("=== Cleaning up safety confirmed checklist results ===")
        res_safety = conn.execute(text("""
            UPDATE checklist_results 
            SET result = true 
            WHERE checklist_id IN (
                SELECT checklist_id FROM checklist_items 
                WHERE lower(item_name) LIKE :pattern
            ) 
            AND (note IS NULL OR note = '' OR lower(note) LIKE :note_pat1 OR lower(note) LIKE :note_pat2)
            AND (note IS NOT NULL AND lower(note) NOT LIKE :not_pat1 AND lower(note) NOT LIKE :not_pat2)
        """), {
            "pattern": "%đảm bảo an toàn%",
            "note_pat1": "%đảm bảo%",
            "note_pat2": "%an toàn%",
            "not_pat1": "%không%",
            "not_pat2": "%ngưng%"
        })
        print(f"Updated {res_safety.rowcount} safety confirmed checklist rows.")

        # 2. Update failure notes checklist results
        print("=== Cleaning up failure note checklist results ===")
        res_failures = conn.execute(text("""
            UPDATE checklist_results 
            SET result = true 
            WHERE checklist_id IN (
                SELECT checklist_id FROM checklist_items 
                WHERE lower(item_name) LIKE :pattern1 OR lower(item_name) LIKE :pattern2
            ) 
            AND (note IS NULL OR note = '' OR lower(note) LIKE :note_pat1 OR lower(note) LIKE :note_pat2 OR lower(note) LIKE :note_pat3)
        """), {
            "pattern1": "%hư hỏng trong ca%",
            "pattern2": "%ghi chú hư hỏng%",
            "note_pat1": "%bình thường%",
            "note_pat2": "%bình thương%",
            "note_pat3": "%binh thường%"
        })
        print(f"Updated {res_failures.rowcount} failure note checklist rows.")

        # 3. Clean up empty/whitespace checklist results that were incorrectly marked as failed (result=false)
        print("=== Cleaning up empty/whitespace checklist results ===")
        res_empty = conn.execute(text("""
            UPDATE checklist_results 
            SET result = true, note = ''
            WHERE result = false 
            AND (note IS NULL OR trim(note) = '')
        """))
        print(f"Updated {res_empty.rowcount} empty/whitespace checklist rows to result=true.")

        # 4. Update OperationLog condition_before_shift to 'ok' if all checklist_results for that operation are true
        print("=== Updating OperationLog condition_before_shift ===")
        res_op_logs = conn.execute(text("""
            UPDATE operation_logs 
            SET condition_before_shift = 'ok' 
            WHERE condition_before_shift = 'broken' 
            AND operation_id NOT IN (
                SELECT DISTINCT operation_id 
                FROM checklist_results 
                WHERE result = false
            )
        """))
        print(f"Updated {res_op_logs.rowcount} OperationLog rows to condition_before_shift = 'ok'.")

        # 5. Delete "Cần cẩu đảm bảo an toàn để bắt đầu làm việc" duplicate from db
        print("=== Removing Crane safety duplicate ===")
        del_results = conn.execute(text("""
            DELETE FROM checklist_results 
            WHERE checklist_id IN (
                SELECT checklist_id FROM checklist_items 
                WHERE item_name = 'Cần cẩu đảm bảo an toàn để bắt đầu làm việc'
            )
        """))
        del_items = conn.execute(text("""
            DELETE FROM checklist_items 
            WHERE item_name = 'Cần cẩu đảm bảo an toàn để bắt đầu làm việc'
        """))
        print(f"Deleted {del_results.rowcount} results and {del_items.rowcount} checklist items.")

if __name__ == "__main__":
    clean_db()
