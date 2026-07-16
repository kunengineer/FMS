# HỆ THỐNG QUẢN LÝ HOẠT ĐỘNG PHƯƠNG TIỆN (CẦN CẨU, XE NÂNG, XE CUỐC, XE ĐÀO)

Hệ thống quản lý vòng đời hoạt động, bàn giao ca, báo cáo sự cố an toàn lao động và bảo trì định kỳ cho đội phương tiện thi công của doanh nghiệp.

---

## 1. Tính năng nổi bật
* **Không hardcode danh mục**: Quản lý loại xe, ca làm việc, checklist an toàn động, hạng mục hư hỏng qua giao diện Admin.
* **Quy trình bàn giao ca nghiêm ngặt**: Ca sau bắt buộc xác nhận đã đọc cảnh báo lỗi chưa xử lý từ ca trước mới được phép mở ca.
* **Khóa xe thông minh**: Chặn không cho mở ca đối với xe có trạng thái `repairing` (đang sửa chữa) hoặc `inactive` (ngưng hoạt động).
* **Hourmeter & Bảo trì định kỳ**: Tự động tính số giờ hoạt động, cảnh báo bảo trì định kỳ theo chu kỳ (ví dụ: mỗi 250 giờ máy chạy thực tế).
* **Báo sự cố linh hoạt**: Hỗ trợ báo hư hỏng trong ca hoặc ngoài ca (Out of shift) kèm tải ảnh thực tế.
* **Chỉ số KPI & MTTR/MTBF**: Tự động tổng hợp và tính toán chỉ số dừng máy MTTR, MTBF theo chuẩn vận hành thiết bị.
* **Xuất Excel động**: Xuất báo cáo Excel 5 Sheet với cột động dựa trên danh mục lỗi hiện tại.
* **Bảo mật & Chống trùng lặp**: Đăng nhập JWT (cookie HttpOnly cho refresh token), RBAC kiểm tra permission_key từ database, chống trùng lặp dữ liệu bằng client-side `idempotency_key` (UUID).

---

## 2. Công nghệ sử dụng
* **Backend**: FastAPI (Python 3.10+) + SQLAlchemy + Pydantic v2 + PostgreSQL 15+ + openpyxl + pytest
* **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts + React Query + React Hook Form
* **Deploy**: Docker & Docker Compose

---

## 3. Hướng dẫn chạy hệ thống nhanh qua Docker Compose

Cách nhanh nhất để khởi chạy hệ thống (đã bao gồm PostgreSQL, Backend, Frontend tự động khởi tạo bảng và seed dữ liệu mẫu):

```bash
docker-compose up --build
```

Sau khi chạy xong:
* **Giao diện Web**: [http://localhost](http://localhost) (Nginx phục vụ)
* **Tài liệu API Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Cơ sở dữ liệu**: PostgreSQL chạy trên cổng `5432`

### Tài khoản đăng nhập mặc định (Seed data):
1. **Vai trò ADMIN**:
   * Mã nhân viên: `ADMIN`
   * Mật khẩu: `admin`
2. **Vai trò NGƯỜI VẬN HÀNH (Operator)**:
   * Mã nhân viên: `OP01`
   * Mật khẩu: `123456`
3. **Vai trò THỢ SỬA CHỮA (Mechanic)**:
   * Mã nhân viên: `ME01`
   * Mật khẩu: `123456`

---

## 4. Hướng dẫn chạy thủ công (Local Development)

### A. Khởi động Backend
1. Mở terminal, đi vào thư mục `backend`:
   ```bash
   cd backend
   ```
2. Tạo và kích hoạt môi trường ảo (Virtual Environment):
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Cài đặt các thư viện Python cần thiết:
   ```bash
   pip install -r requirements.txt
   ```
4. Khởi tạo cơ sở dữ liệu và nạp dữ liệu Seed mẫu (mặc định sẽ tạo file SQLite cục bộ phục vụ việc test nhanh nếu không cấu hình PostgreSQL):
   ```bash
   python -m app.seed
   ```
5. Khởi động backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### B. Khởi động Frontend
1. Cài đặt dependencies (sử dụng pnpm để tối ưu dung lượng):
   ```bash
   cd frontend
   pnpm install
   ```
2. Chạy React Development Server:
   ```bash
   pnpm dev
   ```
   Ứng dụng sẽ hoạt động tại địa chỉ: [http://localhost:5173](http://localhost:5173)

---

## 5. Kiểm thử hệ thống (Automated Tests)

Chúng tôi cung cấp bộ test suite sử dụng `pytest` để kiểm tra các ràng buộc: unique ca làm việc, idempotency key chống trùng lặp, lock xe đang sửa chữa, bắt buộc bàn giao sự cố ca trước, và độ chính xác của các công thức tính toán MTTR, MTBF.

Để chạy tests:
```bash
cd backend
pytest -v
```
