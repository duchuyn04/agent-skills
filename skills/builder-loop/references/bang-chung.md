# Bằng chứng chạy thật

## Tóm tắt

Tiêu chí người dùng nhìn thấy được (giao diện, luồng thao tác) cần bằng chứng chạy thật: ảnh chụp và video quay app đang chạy. Ảnh để reviewer xem nhanh từng trạng thái, video để thấy thứ tự thao tác và trạng thái loading. Task có tiêu chí như vậy phải có cả hai loại, thiếu một loại thì task chưa đạt.

File này có hai phần. Reviewer đọc "Phần của reviewer". File giao việc trỏ builder tới "Phần của builder" bằng đường dẫn đầy đủ, nên reviewer không phải chép lại từng luật.

## Phần của reviewer

1. Xác định module của task ở bước 4.
   - Hồ sơ ghi cách xác định ở mục `Bằng chứng chạy thật` thì làm theo hồ sơ.
   - Hồ sơ không ghi: lấy tên thư mục `tasks/<module>/` chứa tiêu chí, hoặc tên module trong spec của task. Không xác định được thì dùng `chung`.
   - Tên module viết thường, không dấu, nối bằng gạch nối, ví dụ `support-desk`, `calculator-ui`.
2. Lấy thư mục bằng chứng bằng `node "<thư mục skill>/scripts/check-task.mjs" evidence --task <task> --module <module>`.
   - Lệnh in đường dẫn `<gốc bằng chứng>/<module>/<task>/` và tạo thư mục nếu chưa có. Lệnh cũng tạo hai thư mục con `picture/` cho ảnh và `video/` cho video.
   - Gốc mặc định là `~/builder-loop-evidence/<tên repo>`. Thư mục này nằm ngoài repo nên ảnh không lẫn vào Git, và giữ lại được sau khi task xong. Hồ sơ đổi gốc bằng khóa `evidence.dir` trong mục `Kiểm tự động`.
   - Lệnh `loop.mjs handoff` tự gọi bước này và ghi đường dẫn đầy đủ của thư mục task, của `picture/` và của `video/` vào file giao việc. Chỉ chạy `evidence` bằng tay khi cần lấy lại đường dẫn, ví dụ ở task sửa lỗi giao diện.

`check-task` báo lỗi khi báo cáo nhắc tới ảnh hoặc video không tồn tại, và khi diff chạm giao diện mà báo cáo thiếu ảnh hoặc thiếu video. Nó cảnh báo khi bằng chứng nằm ngoài thư mục của module và task, khi ảnh không ở `picture/` hoặc video không ở `video/`, khi thư mục có file báo cáo không nhắc tới, và khi báo cáo chỉ có một loại bằng chứng mà diff không chạm giao diện.

## Phần của builder

Thư mục task, `picture/` và `video/` đã được tạo sẵn. Đường dẫn đầy đủ nằm trong file giao việc.

1. Bắt buộc có cả ảnh và video:
   - Ảnh: chụp cho từng tiêu chí mới hoặc màn hình bị ảnh hưởng (không chụp lại thừa các màn hình không đổi đã có ở task trước, trừ khi task yêu cầu tổng hợp), gồm trạng thái trước và sau thao tác chính. Luồng nhiều bước thì mỗi bước một ảnh. Ảnh để reviewer xem nhanh và so giữa các lượt.
     - Trước mọi ảnh `fullPage: true`, cuộn về đầu trang (`window.scrollTo(0, 0)`) và chờ font tải xong (`document.fonts.ready`) để thanh đầu trang cố định (`position: sticky` hoặc `fixed`) không cắt ngang giữa ảnh.
     - Ảnh đang mở hộp thoại, modal hay bottom sheet (`position: fixed`) bắt buộc chụp khung nhìn hiện tại (`fullPage: false`), không chụp `fullPage: true`.
   - Video: quay trọn luồng chính của task trên app chạy thật, từ trạng thái đầu tới trạng thái cuối. Task có nhiều luồng độc lập thì mỗi luồng một video. Video để thấy chuyển động, thứ tự thao tác và trạng thái loading mà ảnh không thể hiện.
   - Chỉ có ảnh hoặc chỉ có video đều là lỗi `Bắt buộc`, kể cả khi tiêu chí không nói về chuyển động.
   - Mọi tiêu chí nhìn thấy được phải xuất hiện trong ít nhất một ảnh và một video, và báo cáo ghi rõ ảnh và video nào chứng minh tiêu chí nào.
   - Video quay bằng Playwright thì bật con trỏ và nhãn thao tác, để người xem biết agent đang làm gì. Đặt `showActions: { cursor: 'pointer', position: 'top-right', duration: 800 }` trong `recordVideo` của `browser.newContext` (một số bản Playwright mới không nhận khóa `cursor` ở `recordVideo` mà bật qua `page.screencast.showActions({ cursor: 'pointer' })`; kiểm tra và ghi rõ bản đã dùng trong báo cáo). Con trỏ di chuyển từ thao tác này sang thao tác kế tiếp, phần tử vừa tác động được tô sáng và tên thao tác hiện ở góc.
   - Trước mỗi bước chính, gọi `page.screencast.showChapter('<tên bước>', { duration: 1500 })` để hiện thẻ tiêu đề giữa màn hình. Bản Playwright không có hai tùy chọn này thì ghi rõ trong báo cáo, và tự vẽ con trỏ bằng một phần tử gắn vào trang.
   - Giữ `showActions` và gắn thêm vòng tròn đỏ quanh con trỏ cùng vòng gợn sóng khi bấm, giống phần mềm quay màn hình. Dùng helper có sẵn `<thư mục skill>/references/video-cursor.ts`: chép nguyên file vào thư mục helper E2E của repo (ví dụ `e2e/video-cursor.ts`), rồi gọi `await installClickHighlight(context)` ngay sau `browser.newContext` của context quay video. Chỉ gọi cho context quay video, vì lớp phủ là một phần tử `aria-hidden` trong trang và có thể làm sai assert đếm phần tử.
   - Bấm liên kết `target="_blank"` mở tab mới thì video của context chỉ ghi tab chính, và cảnh bấm nút không có kết quả. Lưu thêm video của tab mới (`popup.video()`, đọc đường dẫn sau khi đóng context) thành file thứ hai trong `video/`, hoặc quay luồng trong một tab. Không dựng lại cảnh kết quả bằng `goto` rồi để người xem tưởng nút đã điều hướng.
2. Lưu ảnh vào `<thư mục task>/picture/` và video vào `<thư mục task>/video/`. Không để file ở gốc thư mục task.
3. Đặt tên file dạng `<số thứ tự 2 chữ số>-<tên ngắn của màn hình hoặc bước>.<đuôi>`, viết thường, không dấu, nối bằng gạch nối. Mỗi thư mục con đánh số riêng, bắt đầu từ `01`. Ví dụ: `picture/01-form-trong.png`, `picture/02-bao-loi-email.png`, `video/01-luong-dang-nhap.webm`.
4. Lượt sửa sau chụp lại thì ghi đè file cùng tên, để mỗi thư mục con chỉ còn bản mới nhất. Xóa ảnh và video không còn dùng.
5. Sửa lỗi giao diện của màn hình đã có ảnh bằng chứng thì không tạo thư mục mới (ví dụ `FIX-xxx`).
   - Tìm ảnh cũ của màn hình đó bằng `rg` trong gốc bằng chứng, rồi chụp lại đúng trạng thái của ảnh cũ, cùng tên file, trong `picture/` của task đã làm màn hình đó. Ghi đè ảnh cũ. Video cũ của màn hình đó cũng quay lại và ghi đè trong `video/`.
   - Trạng thái cần chụp chưa có ảnh thì thêm ảnh mới vào `picture/` của task đó, với số thứ tự kế tiếp. Luôn quay lại cả video của luồng chứa màn hình đó, vì lỗi sửa xong cần cả ảnh và video mới.
   - Chạy `check-task` với mã và module của task gốc để đường dẫn ảnh khớp. Báo cáo ghi rõ ảnh nào bị ghi đè.
6. Báo cáo ghi đường dẫn đầy đủ của từng file, trong backtick, cạnh tiêu chí tương ứng.
