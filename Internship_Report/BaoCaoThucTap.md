# BÁO CÁO THỰC TẬP TỐT NGHIỆP
## ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ ĐỘI XE & NHẬT KÝ VẬN HÀNH (FLEET MANAGER SYSTEM)

**Giáo viên hướng dẫn:** [Tên giảng viên]  
**Sinh viên thực hiện:** [Họ tên của bạn]  
**Mã sinh viên:** [Mã sinh viên của bạn]  
**Lớp:** [Lớp của bạn]  

---

## 1. GIỚI THIỆU CHUNG VỀ ĐỀ TÀI
Trong các doanh nghiệp vận tải, logistics hoặc khai thác thiết bị công trình (như cẩu, nâng, xúc, lu), việc quản lý nhật ký chạy xe hàng ngày và tình trạng kỹ thuật của đội xe đóng vai trò vô cùng sống còn. Cách thức ghi chép truyền thống bằng sổ tay thường dẫn đến nhiều sai lệch thông tin, trễ hạn bảo dưỡng và không ghi nhận kịp thời các sự cố kỹ thuật gây mất an toàn lao động.

Hệ thống **Fleet Manager System** được phát triển nhằm số hóa toàn bộ quy trình vận hành và bảo trì:
- **Đơn giản hóa việc ghi nhận ca chạy:** Cho phép người vận hành điền thông tin mở ca, kiểm tra an toàn (checklist) và đóng ca nhanh chóng trên điện thoại di động.
- **Minh bạch hóa hoạt động bảo trì:** Tự động gửi thông tin báo hỏng đến tổ kỹ thuật, ghi chép lũy tiến tiến độ sửa chữa của thợ máy, và tự động mở khóa xe về trạng thái sẵn sàng ngay khi sửa xong.
- **Thống kê phân tích số liệu thực tế:** Trực quan hóa tỷ lệ xe chạy ca, biểu đồ sự cố, và tính toán tự động các chỉ số tin cậy kỹ thuật (MTTR - Mean Time to Repair, MTBF - Mean Time Between Failures) để tối ưu hoạt động khai thác thiết bị.

---

## 2. NGHIỆP VỤ HỆ THỐNG
Dự án được xây dựng dựa trên 3 trụ cột nghiệp vụ cốt lõi:

### a) Quy trình Mở ca & Bàn giao Xe (Operator Workflow)
1. **Kiểm tra an toàn:** Người vận hành chọn xe và ca chạy, bắt buộc phải trả lời bảng câu hỏi Checklist an toàn (độ lỏng ốc, dầu thủy lực, phanh, lốp...).
2. **Xử lý sự cố nguy hiểm:** Nếu phát hiện hư hỏng thuộc danh mục **Nguy hiểm (Dangerous)**, xe sẽ tự động chuyển sang trạng thái "Bị khóa/Không hoạt động" và tạo yêu cầu sửa chữa tức thì. Người vận hành không thể mở ca chạy xe.
3. **Ký xác nhận (Digital Signature):** Nếu xe đạt an toàn, người vận hành ký số trực tiếp trên màn hình điện thoại để lưu trữ dấu vết pháp lý và chính thức mở ca chạy xe.

### b) Quy trình Báo hỏng & Sửa chữa (Repair & Maintenance Workflow)
1. **Báo hỏng trong ca:** Trong quá trình vận hành, nếu xảy ra sự cố đột xuất, người vận hành có quyền khai báo trực tiếp thời gian xảy ra lỗi và mô tả hư hỏng kèm ảnh đính kèm.
2. **Nhận sửa chữa:** Thợ sửa máy (hoặc người vận hành có quyền) nhận yêu cầu sửa chữa, hệ thống ghi nhận mốc thời gian bắt đầu sửa (`repair_start`).
3. **Cập nhật tiến độ lũy tiến:** Mỗi lần thợ máy cập nhật tiến độ kỹ thuật, hệ thống sẽ chèn thêm một bản ghi chặng tiến trình mới vào lịch sử sửa chữa mà không ghi đè dữ liệu cũ, đảm bảo lưu vết hoàn chỉnh.
4. **Kết thúc sửa chữa:** Thợ máy xác nhận hoàn thành, ghi chú biện pháp khắc phục và phụ tùng thay thế đã dùng. Hệ thống tự động chuyển trạng thái xe về "Sẵn sàng" hoạt động.

### c) Quy trình Thống kê & Báo cáo (Analytics Workflow)
1. **Thống kê thời gian thực:** Dashboard tính toán tỷ lệ phân bổ trạng thái xe (Hoạt động, Đang sửa chữa, Ngưng hoạt động) cùng biểu đồ phân loại sự cố hàng tuần.
2. **Cảnh báo giờ máy bảo dưỡng:** Hệ thống tự động tính số giờ hoạt động từ lúc mở ca đến đóng ca của từng xe. Khi tổng số giờ máy vượt quá hạn mức quy định (ví dụ: 250 giờ chạy), hệ thống sẽ hiển thị cảnh báo bảo dưỡng.
3. **Xuất báo cáo dữ liệu:** Hỗ trợ trích xuất lịch sử sửa chữa và các chỉ số MTTR/MTBF ra định dạng file Excel (CSV) để phục vụ công tác thanh kiểm tra.

---

## 3. CÔNG NGHỆ VÀ KIẾN TRÚC HỆ THỐNG
Dự án áp dụng kiến trúc tách biệt hoàn toàn Client - Server (Decoupled Architecture):

### a) Backend (FastAPI + SQLite)
- **FastAPI:** Khung ứng dụng Web hiệu năng cao cho Python, tự động sinh tài liệu Swagger UI để kiểm thử API.
- **SQLAlchemy:** Trình ánh xạ quan hệ đối tượng (ORM) giúp thao tác cơ sở dữ liệu SQLite dưới dạng các lớp đối tượng Python.
- **JWT (JSON Web Token):** Mã hóa thông tin đăng nhập và phân quyền trên các header API để bảo mật thông tin.
- **Timezone handling:** Sử dụng naive local time (thời gian cục bộ không đổi) đồng nhất trên backend SQLite giúp việc tính toán ngày giờ của người dùng tại Việt Nam chính xác tuyệt đối mà không bị lệch 7 tiếng so với múi giờ UTC.

### b) Frontend (React + Vite + TypeScript)
- **Vite:** Công cụ đóng gói mã nguồn cực nhanh thay thế cho Create React App truyền thống.
- **TypeScript:** Ràng buộc chặt chẽ kiểu dữ liệu giúp phát hiện lỗi lập trình ngay trong quá trình biên dịch.
- **TailwindCSS:** Thư viện CSS tiện ích giúp thiết kế giao diện tùy biến (Responsive) nhanh chóng và giữ thẩm mỹ hiện đại.
- **Recharts:** Thư viện biểu đồ React gọn nhẹ vẽ dữ liệu thống kê trực quan.

### c) Cấu trúc sơ đồ Cơ sở dữ liệu (Database Schema)
Các bảng chính bao gồm:
- **`operators`:** Lưu thông tin nhân viên, tài khoản, mật khẩu băm (bcrypt) và vai trò (role_id).
- **`vehicles`:** Lưu thông tin mã xe, tên xe, biển số, tổng giờ máy hoạt động (`hourmeter`) và trạng thái kỹ thuật.
- **`operation_logs`:** Lưu lịch ký chạy ca: giờ mở ca, giờ đóng ca, số giờ máy đầu/cuối ca, chữ ký số dạng Base64 và tình trạng bàn giao.
- **`failures`:** Lưu yêu cầu báo hỏng, mức độ nghiêm trọng (dangerous / warning) và trạng thái khắc phục (`is_repaired`).
- **`repairs`:** Lưu thông tin các chặng sửa chữa tiến độ: thợ máy, thời gian bắt đầu/kết thúc, ghi chú khắc phục, phụ tùng sử dụng.

---

## 4. QUÁ TRÌNH TỐI ƯU HÓA GIAO DIỆN DI ĐỘNG (MOBILE LAYOUT OPTIMIZATION)
Vì người vận hành chạy xe làm việc ngoài hiện trường bằng điện thoại di động, giao diện đã được tối ưu hóa đặc biệt (Mobile First):

### a) Thay thế bảng rộng bằng Card Layout
Bảng dữ liệu kiểu cột ngang truyền thống thường bị tràn hoặc vỡ chữ trên màn hình hẹp (320px - 480px). Trên di động, hệ thống tự động ẩn bảng (`hidden md:block`) và chuyển sang hiển thị các thẻ Card xếp dọc (`md:hidden p-4 space-y-3`). Mỗi thẻ hiển thị đầy đủ tiêu đề, các chỉ số quan trọng, nhãn cảnh báo nhiều màu sắc và nhóm nút hành động lớn dễ chạm bấm.

### b) Chuyển đổi thanh điều hướng sang Hamburger Menu Drawer
Bottom Navigation Bar chiếm dụng chiều cao màn hình di động có hạn và gây chật chội khi hiển thị quá 5 mục. Hệ thống đã loại bỏ hoàn toàn Bottom Nav, chuyển đổi sang nút Hamburger Menu cố định ở Header trái. Khi nhấn nút này, một Drawer Menu sẽ trượt ra mượt mà từ cạnh trái màn hình, hiển thị thông tin tài khoản đầy đủ, các liên kết phụ và nút Đăng xuất màu đỏ nổi bật.

### c) Thiết kế Sticky Footer cho Modal Nhập liệu
Tránh lỗi bàn phím ảo hoặc các thanh điều hướng của hệ điều hành di động che mất các nút lưu/hủy ở cuối hộp thoại nhập liệu. Các hộp thoại (Mở ca, Đóng ca, Báo sự cố) được cấu trúc lại gồm 2 phần: phần thân chứa các ô nhập liệu cuộn độc lập (`overflow-y-auto`) và phần đuôi chứa nút bấm luôn luôn cố định ở đáy hộp thoại (`shrink-0 bg-gray-50/80 p-4 border-t`).

---

## 5. TRIỂN KHAI VÀ VẬN HÀNH TRÊN MÁY CHỦ IIS (WINDOWS LOCAL SERVER)
Trong môi trường doanh nghiệp cục bộ, hệ thống được triển khai trên Internet Information Services (IIS) của Windows:

### a) Cấu hình Reverse Proxy qua web.config
Để chạy đồng thời Frontend tĩnh và Backend API trên cùng một cổng của card mạng, một luật định tuyến ngược (Reverse Proxy Rules) được thiết lập thông qua phần mở rộng **Application Request Routing (ARR)** và **URL Rewrite** của IIS:
- Các yêu cầu dạng `/api/*` và `/uploads/*` được tự động chuyển tiếp ngầm đến cổng dịch vụ backend FastAPI đang chạy cục bộ (`http://127.0.0.1:8000`).
- Tất cả các yêu cầu điều hướng trang web khác của React Router tĩnh sẽ được trỏ về `/index.html` của thư mục `dist/` để tránh lỗi HTTP 404 khi người dùng tải lại trang (F5).

---

## 6. KẾT LUẬN VÀ ĐÁNH GIÁ KẾT QUẢ
Trải qua 8 tuần thực tập phát triển hệ thống **Fleet Manager System**, sinh viên đã đạt được các kết quả cụ thể:
1. **Kiến thức chuyên môn:** Nắm vững quy trình thiết kế CSDL thực tế, viết RESTful API bằng FastAPI đạt chuẩn bảo mật và tối ưu giao diện React bằng TypeScript.
2. **Kỹ năng thực tế:** Biết cách xử lý các lỗi tương thích hiển thị trên thiết bị di động thực tế, xử lý múi giờ đồng bộ và cấu hình ứng dụng chạy mạng nội bộ IIS trong doanh nghiệp.
3. **Giá trị sản phẩm:** Hệ thống được chạy thử nghiệm trực tiếp tại bộ phận kỹ thuật thiết bị của doanh nghiệp, giúp cải thiện 40% tốc độ tiếp nhận thông tin bảo trì và loại bỏ hoàn toàn việc ghi chép sổ tay thất lạc.
