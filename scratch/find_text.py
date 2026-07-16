import openpyxl
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook("d:/Project/Fleet-Manager-System/Mau_Bao_Cao_Chuan.xlsx", data_only=True)
sheet = wb["MẪU_BÁO_CÁO"]
print("Sheet: MẪU_BÁO_CÁO")
for r in range(1, 10):
    vals = [sheet.cell(row=r, column=c).value for c in range(1, 18)]
    print(f"Row {r}: {vals}")
