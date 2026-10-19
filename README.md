# model-compare

Dashboard so sánh model AI cho lập trình. Mốc so sánh là **GLM-5.3**, xét theo năng lực coding, giá API, tốc độ và các gói subscription coding.
Dashboard comparing AI coding models against **GLM-5.3** on coding ability, API price, speed and coding subscriptions.

## Xem dashboard / View

Mở file `web/index.html` bằng trình duyệt. Không cần server hay cài gì thêm, chỉ cần có internet để tải thư viện biểu đồ ECharts từ CDN.

Dashboard gồm:
- Tóm tắt thứ hạng của GLM-5.3 và các model đáng tiền nhất (đường Pareto).
- Biểu đồ **Năng lực × Giá**, chọn trục tuỳ ý, có sẵn các gợi ý: Coding × Giá, Coding × Chi phí/task, SWE-bench × Giá, WebDev × Giá, Tốc độ × Giá.
- Biểu đồ benchmark coding, giá API và tốc độ, mỗi chỉ số một biểu đồ, xếp từ tốt đến kém.
- Bảng tổng hợp dạng heatmap, có thể sắp xếp theo từng cột.
- Máy tính chi phí API theo tháng (request/ngày, token, % cache-hit), kèm gói subscription rẻ nhất có model đó.
- Bảng giá các gói subscription coding: GLM Coding Plan, Kimi, MiniMax, Alibaba, Claude, ChatGPT.
- Có thể chuyển VI/EN và chế độ sáng/tối, lọc theo nhóm model.

## Cập nhật dữ liệu / Refresh data

Cần Python ≥ 3.11 và không phải cài thư viện nào.

```bash
python scripts/update.py          # lấy dữ liệu mới + build lại web/data.js, rồi xem: git diff
python scripts/update.py --push   # ...và tự commit + push để đồng bộ sang máy khác
```

Trên máy khác chỉ cần `git pull` rồi mở `web/index.html`.

Các lệnh lẻ: `python scripts/fetch_sources.py [openrouter|aa|tbench|vals]` để lấy từng nguồn, `python scripts/build.py` để chỉ build lại từ snapshot đang có.
Nếu một nguồn bị lỗi (trang đổi giao diện, mất mạng), snapshot cũ của nguồn đó được giữ nguyên.

## Nguồn dữ liệu / Sources

| Nguồn | Dữ liệu | Cách lấy |
|---|---|---|
| [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models) | Intelligence Index, Terminal-Bench 4.0, SciCode, tốc độ (tok/s), độ trễ, chi phí thực tế/task | tự động: đọc dữ liệu nhúng trong trang leaderboard |
| [OpenRouter](https://openrouter.ai/models) | giá input/output/cache theo từng provider, context window | tự động: API công khai |
| [Terminal-Bench](https://www.tbench.ai/leaderboard) | leaderboard chính thức Terminal-Bench 4.0 (model + agent) | tự động: đọc trang |
| [Vals AI — SWE-bench](https://www.vals.ai/benchmarks/swebench) | SWE-bench Verified, cùng harness mini-SWE-agent | tự động: đọc bảng HTML |
| [WebDev Arena](https://arena.ai/leaderboard/code/webdev) | Elo từ bình chọn mù của người dùng | **nhập tay** trong `data/manual.toml` (trang chặn script) |
| Trang giá chính hãng | gói subscription coding | **nhập tay** trong `data/plans.toml` |

Ghi chú:
- **Giá** là giá niêm yết của chính hãng, lấy từ endpoint chính hãng trên OpenRouter. `build.py` tự đối chiếu với giá trên Artificial Analysis và cảnh báo nếu hai bên lệch nhau quá 5%.
- **Điểm coding AA** là trung bình của Terminal-Bench 4.0 và SciCode. Đây là hai bài tạo nên nhóm Coding trong AA Intelligence Index.
- **SWE-bench** lấy từ Vals AI vì leaderboard trên swebench.com đã ngừng cập nhật từ 02/2026. Bảng của Vals ghi ngày cập nhật 01/09/2026, nên các model ra sau ngày đó (Claude Sonnet 5.5, GPT-6.1 Sol, Gemini 4 Argon) chưa có điểm.
- Dữ liệu Artificial Analysis được đọc từ trang web công khai chứ không qua API chính thức. Nếu AA đổi giao diện, script sẽ báo lỗi và giữ snapshot cũ.

## Thêm / bớt model

Sửa file `data/models.toml`. Mỗi model khai báo ID của nó trên từng nguồn; hướng dẫn chi tiết nằm ngay trong phần đầu file. Nếu một ID không tìm thấy ở nguồn nào, script sẽ gợi ý các tên gần giống. Điểm WebDev Arena thì thêm vào `data/manual.toml`.

## Cấu trúc / Layout

```
data/models.toml        danh sách model + ID ở từng nguồn
data/manual.toml        số liệu nhập tay (WebDev Arena, license)
data/plans.toml         gói subscription coding
data/snapshots/*.json   dữ liệu đã chuẩn hoá của từng nguồn (commit để xem lịch sử thay đổi)
scripts/                fetch_sources.py, build.py, update.py, common.py (chỉ dùng thư viện chuẩn)
web/                    index.html, app.js, style.css, data.js (do build.py sinh ra)
```
