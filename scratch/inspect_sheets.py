import openpyxl
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook("d:/Project/Fleet-Manager-System/Thống kê kết quả kiêm tra.xlsx", read_only=True)
sheet = wb['Câu trả lời biểu mẫu 1']

print("=== Anomalies (Failure or safety issue) ===")
for r_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), 2):
    col23 = row[22]
    col24 = row[23]
    
    col23_clean = str(col23).strip().lower() if col23 else ""
    col24_clean = str(col24).strip().lower() if col24 else ""
    
    is_anomaly = False
    if col23 and not any(k in col23_clean for k in ("bình thường", "bình thương", "binh thường", "none", "không")):
        is_anomaly = True
    if "không" in col24_clean:
        is_anomaly = True
        
    if is_anomaly:
        print(f"Row {r_idx}: Date={row[0]} Driver={row[2]} Vehicle={row[3]} | Col 23='{col23}' | Col 24='{col24}'")
