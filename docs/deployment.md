# Tự động deploy lên VPS bằng Docker

Luồng: push `main` → typecheck/unit/build/E2E → build Docker image → smoke trên container → đẩy chính image đã kiểm tra lên GHCR → SSH deploy → kiểm tra health nội bộ và HTTPS bên ngoài. Pull request chỉ chạy kiểm tra, không publish hoặc deploy. Có thể chạy lại bằng `workflow_dispatch` trên `main`.

Workflow: `.github/workflows/check.yml`. Các action deploy được khóa tuần tự; image được chọn bằng SHA256 digest, không dùng `latest` để deploy.

## Trạng thái thiết lập

Các file và workflow đã chuẩn bị trong repo. Chưa cấu hình kết nối VPS, chưa tạo GitHub Secrets và chưa chạy deploy thật. Cần đưa các thay đổi lên GitHub và hoàn tất bootstrap dưới đây để kích hoạt. Không có commit/push tự động trong tác vụ thiết lập.

Docker chưa có trên máy phát triển trong phiên thiết lập nên chưa kiểm tra container tại đây. Đã kiểm tra Next standalone bằng E2E, cú pháp workflow bằng actionlint và logic promote/rollback bằng các command giả lập. Job image trên GitHub sẽ thực sự build, kiểm tra Compose và smoke container trước khi publish.

## 1. Chuẩn bị VPS một lần

Cấu hình hiện tại dành cho Linux x86_64/amd64, một replica. VPS cần Docker Engine, Docker Compose plugin từ 2.20 trở lên, `curl`, `flock`, `tar`, Bash và user SSH có quyền chạy Docker. Cài Docker theo [hướng dẫn chính thức](https://docs.docker.com/engine/install/ubuntu/) đúng hệ điều hành VPS. Khuyến nghị ít nhất 2 GiB RAM; build diễn ra trên GitHub, không trên VPS.

Trỏ bản ghi DNS A của domain về VPS (và AAAA chỉ khi IPv6 hoạt động). Mở TCP 80/443, UDP 443 nếu dùng HTTP/3 và cổng SSH. Không cần công khai cổng 3000. Đảm bảo không có web server khác chiếm 80/443.

Tạo thư mục bằng user deploy, ví dụ:

```sh
sudo install -d -m 750 -o "$USER" -g "$(id -gn)" /opt/minintapp
cd /opt/minintapp
umask 077
printf '%s\n' 'APP_ORIGIN=https://app.example.com' > .env
touch .env.app
chmod 600 .env .env.app
```

Thay domain ví dụ bằng domain thật. APP_ORIGIN không có dấu `/` cuối, path hoặc dấu nháy trong file. Với domain thật Caddy tự quản lý HTTPS và giữ certificate trong Docker volume. Có thể dùng `http://IP_VPS` để kiểm tra ban đầu nhưng đó không phải kết nối HTTPS.

`.env.app` giữ biến runtime của ứng dụng, ví dụ OPENAI_API_KEY khi cần; hiện tại bình chọn mẫu không cần key. Không đưa `.env.app` vào Git hoặc upload như artifact. Workflow không ghi đè hai file môi trường của VPS.

Chỉ một container app được chạy. App dùng memory, nên **mỗi deploy/restart/rollback làm mất app và vote hiện có**; rollback chỉ khôi phục phần mềm, không khôi phục dữ liệu. Có khoảng gián đoạn ngắn khi thay container. Cần chuyển sang database trước khi yêu cầu dữ liệu bền hoặc nhiều replica.

## 2. GitHub Secrets và Variables

Trong repository → Settings → Secrets and variables → Actions, thêm các repository secrets:

| Secret | Nội dung |
|---|---|
| `VPS_HOST` | IPv4 hoặc hostname VPS, không có scheme/port |
| `VPS_USER` | User SSH được cấp quyền deploy |
| `VPS_SSH_KEY` | Private SSH key dành riêng cho deploy; public key tương ứng có trong authorized_keys của VPS |
| `VPS_KNOWN_HOSTS` | Dòng host key của VPS đã được xác minh, đúng hostname và cổng SSH |

Dùng key không cần passphrase trong automation. Giữ StrictHostKeyChecking; không tự tin cậy kết quả keyscan chưa đối chiếu fingerprint. Không gửi private key vào chat hoặc ghi vào repo. Có thể nạp key từ file local bằng GitHub CLI:

```sh
gh secret set VPS_SSH_KEY --repo 95Lab/minintapp < /path/to/deploy-private-key
gh secret set VPS_KNOWN_HOSTS --repo 95Lab/minintapp < /path/to/verified-known-hosts
```

Thêm repository variables:

| Variable | Giá trị |
|---|---|
| `VPS_PORT` | Tùy chọn, mặc định `22` |
| `VPS_APP_DIR` | Tùy chọn, mặc định `/opt/minintapp`; đường dẫn tuyệt đối không có khoảng trắng |
| `DEPLOY_ENABLED` | Đặt `true` sau khi VPS và secrets sẵn sàng |

Job dùng GitHub Environment `production`; nếu đặt quy tắc approval trên environment thì mỗi deploy sẽ chờ theo quy tắc đó. Workflow này không tự yêu cầu reviewer.

GHCR dùng GITHUB_TOKEN của workflow: job image có packages:write, job deploy có packages:read. Token đọc registry được chuyển qua stdin của SSH, lưu trong Docker config tạm trên VPS rồi xóa sau job; không cần lưu PAT dài hạn trên VPS cho deploy tự động. Nếu organization giới hạn package access, cấp Actions của repository quyền truy cập package vừa tạo. Không đưa token vào build args hoặc Docker image.

## 3. Chạy và kiểm tra

Sau khi các file được push lên `main`, theo dõi workflow **Check and deploy** trong GitHub Actions. Nếu DEPLOY_ENABLED chưa là true, image vẫn được kiểm tra/publish nhưng deploy VPS bị bỏ qua.

Trên VPS, sau lần deploy đầu:

```sh
cd /opt/minintapp
docker compose --env-file .env --env-file .image.env -f compose.yml ps
curl --fail https://app.example.com/api/health
```

Mở domain, tạo bình chọn và thử bằng một trình duyệt khác. Host cookie là HttpOnly/SameSite=Lax và Secure khi APP_ORIGIN là HTTPS. Caddy chuyển tiếp Host của domain; app dùng APP_ORIGIN để kiểm tra Origin và tạo cookie đúng khi TLS kết thúc tại proxy.

Xem logs giới hạn số dòng để tránh in dữ liệu không cần thiết:

```sh
docker compose --env-file .env --env-file .image.env -f compose.yml logs --tail 100 app proxy
```

## Rollback và lỗi

`deploy/deploy.sh` kéo image và validate Caddy trước khi thay container. Sau đó chờ health, kiểm tra public endpoint qua Caddy/TLS. Nếu lỗi sau khi thay container, script thử chạy lại image trong `.image.env` và job vẫn báo failed; nếu rollback cũng lỗi, thông báo nêu rõ để kiểm tra VPS. Lần deploy đầu chưa có image cũ nên sẽ dừng stack lỗi. `.image.previous.env` lưu image của lần thành công trước đó.

Rollback áp dụng image app với cấu hình Compose/Caddy hiện tại, không hoàn nguyên mọi thay đổi hạ tầng hoặc phục hồi memory. Không tự prune image/volume.

Rollback thủ công cần quyền pull GHCR (đăng nhập lại nếu package private), rồi:

```sh
cd /opt/minintapp
previous=$(sed -n 's/^MININTAPP_IMAGE=//p' .image.previous.env)
bash deploy.sh "$previous"
```

Tham khảo: [GitHub Actions — publish Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [Next standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
