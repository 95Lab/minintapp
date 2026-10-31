# MinintApp

[Tiếng Việt](README.md) | [English](README.en.md)

### Nền tảng all-in-one để tạo, vận hành và kinh doanh Flash App bằng AI

> **Từ một nhu cầu đến một ứng dụng. Từ một ứng dụng đến một cơ hội kinh doanh.**
>
> Temporary problem. Temporary software.

![Status](https://img.shields.io/badge/status-hackathon%20proposal-orange)
![Powered by](https://img.shields.io/badge/powered%20by-Codex-black)
![MVP target](https://img.shields.io/badge/MVP%20target-7%20hours-blue)

## 1. Ý tưởng

**MinintApp** giúp người không biết lập trình tạo **Flash App tương tác được** bằng cách mô tả nhu cầu bằng ngôn ngữ tự nhiên. Nền tảng quản lý việc tạo app, dữ liệu, sandbox, subdomain và deployment, đồng thời xây dựng marketplace để cộng đồng khám phá, sử dụng và mua bán app.

Ví dụ:

> “Tạo app bình chọn cho workshop hôm nay, 5 ứng viên, mỗi người vote một lần, hiển thị kết quả theo thời gian thực.”

Người dùng nhận bản xem trước, chỉnh sửa bằng hội thoại rồi publish lên subdomain HTTPS riêng để chia sẻ qua link hoặc QR. App có thể dùng tạm thời, giữ lại lâu dài hoặc phát triển thành sản phẩm trên marketplace.

**Trạng thái:** Repo đã có ứng dụng Next.js, engine tương tác và triển khai Control Plane/Runtime Plane với PostgreSQL, queue, sandbox gVisor, database PostgreSQL và role riêng và provisioning DNS. Xem [kiến trúc runtime](docs/architecture-runtime.md) để phân biệt phần đã có và giới hạn còn lại. Marketplace và thanh toán vẫn thuộc lộ trình sản phẩm.

## 2. Trải nghiệm all-in-one

```text
Mô tả nhu cầu → AI tạo app → Dùng thử và chỉnh sửa → Publish
    → Sử dụng và chia sẻ → Đăng marketplace nếu muốn
    → Người khác khám phá và tạo bản riêng
```

| Khả năng | Giá trị |
|---|---|
| Tạo bằng AI | Biến nhu cầu thành app mà không cần tự lập trình |
| Vận hành tích hợp | Sandbox, dữ liệu riêng và subdomain HTTPS do nền tảng quản lý |
| Chia sẻ tức thời | Người khác mở link hoặc quét QR để sử dụng |
| Marketplace | Creator niêm yết app miễn phí hoặc trả phí |
| Tạo bản riêng | Người mua có instance và dữ liệu độc lập, tùy chỉnh theo license |
| Cộng đồng creator | Khám phá, phản hồi, cải tiến và remix có cấp phép |

Mô hình thương mại ban đầu bán **quyền tạo bản app riêng từ một phiên bản đã phát hành**. Giá mua app và phí vận hành được công bố riêng; mua app không mặc định bao gồm mã nguồn, quyền bán lại hoặc hosting trọn đời.

## 3. Kiến trúc đề xuất

- **Control Plane:** Dashboard, API, PostgreSQL, queue, AI Builder và Scheduler.
- **Runtime Plane:** nhiều VM Worker, mỗi app chạy trong sandbox gVisor riêng với volume dữ liệu riêng.
- **Routing:** Cloudflare DNS API tạo subdomain; gateway định tuyến đến sandbox, tách DNS khỏi vị trí VM.
- **Vòng đời:** tạo, build, deploy, chạy, dừng, gia hạn và hết hạn.

Bản demo gom các thành phần lên **1 VM với N sandbox**. Giao diện Worker Agent được thiết kế để mở rộng đa VM ở giai đoạn sau.

## 4. MVP và kịch bản demo

Phạm vi 7 giờ: một template full-stack, prompt → preview → chỉnh sửa → publish, database PostgreSQL và role riêng cho mỗi app, subdomain thật qua Cloudflare API, start/stop và TTL. Marketplace demo hỗ trợ danh mục mẫu và tạo bản riêng miễn phí.

1. Tạo app bình chọn workshop bằng prompt và nhận subdomain HTTPS.
2. Đăng bản mẫu miễn phí lên marketplace.
3. Tài khoản khác tạo bản riêng với dữ liệu trống và tùy chỉnh cho workshop khác.
4. Hai app chạy trong hai sandbox độc lập; dừng một app, app còn lại vẫn hoạt động.

Thanh toán thật, hoàn tiền, payout cho creator, tự động cấp VM và phục hồi liên VM thuộc giai đoạn sau. Một VM vẫn là điểm lỗi chung của bản demo.

## 5. Tài liệu

| Tài liệu | Tiếng Việt | English |
|---|---|---|
| Tổng quan | [README](README.md) | [README](README.en.md) |
| Kiến trúc | [Thiết kế kiến trúc](architecture-design.md) | [Architecture Design](architecture-design.en.md) |
| Sản phẩm và kinh doanh | [Business Flow](business-flow.md) | [Business Flow](business-flow.en.md) |

## Đội thi

**Tên đội:** 95LAB

| Liên hệ | |
|---|---|
| 👤 Người liên hệ | Hiếu Nd (Đội trưởng) |
| 📧 Email | [hillnguyen528@gmail.com](mailto:hillnguyen528@gmail.com) |
| 📞 Điện thoại | 0969 895 364 |

**Thành viên**

| Thành viên | Vai trò | Học vị / Chuyên môn |
|---|---|---|
| **Hiếu Nd** | Đội trưởng | Thạc sĩ Công nghệ Thông tin, UEF - Ho Chi Minh City University of Economics and Finance |
| **Thức Nguyễn** | Thành viên · AI Developer | Học viên cao học, Trường ĐH Công nghệ Thông tin – ĐHQG-HCM (UIT) |
| **Mai Phan** | Thành viên · AI Developer | Học viên cao học, Trường ĐH Công nghệ Thông tin – ĐHQG-HCM (UIT) |


---

**Create it when you need it.**

**Keep it as long as you want.**

**Let it disappear when you don't.**
