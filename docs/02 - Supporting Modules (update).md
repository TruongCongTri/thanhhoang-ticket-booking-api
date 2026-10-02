Để một hệ thống NestJS chuyển từ mức dự án chức năng thông thường (MVP/Functional) sang một nền tảng chuẩn doanh nghiệp (Enterprise-Grade, Production-Safe), toàn bộ các module hạ tầng dùng chung (Cross-Cutting / Supporting Modules) phải được thiết lập bài bản để bao bọc các module nghiệp vụ lõi (Domain Modules).  
Dưới đây là danh mục toàn diện các Supporting Modules chuẩn hóa theo **8 nhóm năng lực kiến trúc cấp Doanh nghiệp (Enterprise Taxonomy)**:

### **1\. Nhóm Vòng đời Ứng dụng & Ngữ cảnh Thực thi (Runtime Context & Process Lifecycle)**

* #### **AppConfigModule (Quản lý cấu hình kiểu tĩnh):**

  * Công nghệ: `@nestjs/config`, `joi` hoặc `zod`.  
  * Mục đích: Nạp và xác thực nghiêm ngặt toàn bộ biến môi trường (`.env`) ngay tại thời điểm ứng dụng khởi động (Bootstrap phase). Nếu thiếu hoặc sai kiểu dữ liệu của bất kỳ biến nào (DB port, Secret Key), ứng dụng lập tức fail-fast và dừng lại, ngăn ngừa lỗi runtime âm thầm trên production.

**Bảng đối chiếu hiện trạng & Các khoảng trống (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Điểm cần nâng cấp |
| :---- | :---- | :---- |
| **1\. Fail-Fast Validation (Zod)** | **ĐÃ CÓ** | Đã triển khai Zod schema, chặn tiến trình boot nếu thiếu biến. |
| **2\. Báo lỗi thân thiện cho DevOps / K8s** | **CÒN THIẾU** | Bản cũ in ra JSON raw của Zod (parsed.error.format()), rất khó đọc trên console log của Kubernetes Pod khi triển khai ConfigMap/Secret. Cần bộ format bảng lỗi trực quan (tên biến, giá trị hiện tại, lý do sai). |
| **3\. Bao phủ các biến hạ tầng cốt lõi** | **CÒN THIẾU** | Bản cũ mới chỉ có Database và Throttle. Hệ thống doanh nghiệp (đặc biệt theo blueprint đã lập) bắt buộc phải cấu hình: **Redis** (dùng cho cache, lock, rate-limit), **JWT Authentication**, và **Resilience timeouts**. |
| **4\. Typed Wrapper Service (AppConfigService)** | **CÒN THIẾU** | Hiện đang gọi configService.get('DB\_MASTER\_HOST') dạng chuỗi rời rạc. Cách này dễ gõ sai chính tả (typo) và không gom nhóm logic (database, redis, security). Cần một AppConfigService với các getter có kiểu tĩnh (strongly-typed). |
| **5\. Cơ chế Masking bảo vệ Secret khi kiểm tra cấu hình** | **CÒN THIẾU** | Cần phương thức getSanitizedConfig() để in log hoặc phục vụ /health audit mà không vô tình để lộ mật khẩu DB, khóa mã hóa và JWT Secret. |

**Cập nhật và nâng cấp toàn bộ mã nguồn src/core/config/**

Cấu trúc module hoàn chỉnh:

src/core/config/  
├── env.schema.ts             \# \[NÂNG CẤP\] Zod Schema toàn diện \+ Human-readable error formatter  
├── app-config.service.ts     \# \[MỚI\] Strongly-typed Wrapper Service \+ Masking  
├── app-config.module.ts      \# \[CẬP NHẬT\] Đăng ký Provider & Export AppConfigService  
└── env.schema.spec.ts        \# \[MỚI\] Test suite kiểm chuẩn Fail-Fast & Type Coercion

* #### **RequestContextModule (Quản lý ngữ cảnh thực thi xuyên suốt):**

  * Vấn đề: Để LoggerModule, AuditModule, Multi-Tenant hay SQL Query Log biết được traceId, userId, tenantId, clientIp hiện tại mà không phải truyền tham số (prop-drilling) qua hàng chục tầng Controller  Service  Helper  Repository.   
  * Công nghệ: AsyncLocalStorage (Node.js native), nestjs-cls.  
  * Mục đích: Cung cấp thread-local context an toàn cho phép trích xuất thông tin request hiện hành (`userId`, `tenantId`, `departmentId`, `traceId`, `clientIp`, danh sách `permissions`) ở bất kỳ tầng nào (Service, Repository, Helper) mà không cần truyền tham số thủ công (prop-drilling). 

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Điểm nghẽn thực tế |
| :---- | :---- | :---- |
| **1\. Isolation theo luồng với AsyncLocalStorage** | **ĐÃ CÓ** | Đã bọc request trong middleware bằng AsyncLocalStorage.run() an toàn bộ nhớ. |
| **2\. Điểm nghẽn vòng đời: Middleware vs Authentication Guard** | **LỖI LOGIC NGHIÊM TRỌNG** | Middleware chạy **trước** JwtAuthGuard. Tại thời điểm RequestContextMiddleware khởi tạo store, JWT token chưa được giải mã, nên user luôn là undefined. Bản hiện tại **chưa có hàm setUser()** để Guard/Interceptor nạp thông tin user vào store sau khi xác thực thành công\! |
| **3\. Truy xuất nhanh (Zero Prop-drilling Accessors)** | **CÒN THIẾU** | Mới chỉ có getCurrentUser(). Các tầng sâu như TypeORM Entity Subscriber, Logger, hay Audit Log phải liên tục kiểm tra this.context.getCurrentUser()?.id lặp đi lặp lại. Cần các getter chuyên dụng: getUserId(), getTenantId(), getUserRoles(), getUserRules(). |
| **4\. Ngữ cảnh cho Tác vụ nền (Background Queue, Cron, Outbox)** | **CÒN THIẾU** | Đối với worker BullMQ, cron job, hoặc Outbox poller, **hoàn toàn không có HTTP Request**. Nếu logger hoặc repository gọi contextService.getTraceId() trong queue, hệ thống sẽ rơi vào trạng thái rỗng. Cần phương thức runWithContext() và runAsSystem() để khởi tạo context hợp lệ cho worker nền. |
| **5\. Tính toán thời gian thực thi (Execution Duration)** | **CÒN THIẾU** | startTime đã được lưu nhưng chưa có hàm getDurationMs() để LoggerInterceptor tính toán chính xác số mili-giây xử lý của request. |

**Nâng cấp toàn diện mã nguồn src/core/context/**

src/core/context/  
├── request-context.model.ts          \# \[CẬP NHẬT\] Thêm helper types và non-HTTP context  
├── request-context.service.ts        \# \[CẬP NHẬT\] Thêm setUser, runAsSystem, shortcut getters  
├── request-context.middleware.ts     \# \[CẬP NHẬT\] Trích xuất Client IP & Forwarded Headers chuẩn K8s  
├── request-context.interceptor.ts    \# \[MỚI\] Tự động sync req.user vào AsyncLocalStorage sau Auth Guard  
├── request-context.module.ts         \# \[CẬP NHẬT\] Đăng ký Middleware & Export Interceptor  
└── request-context.service.spec.ts   \# \[CẬP NHẬT\] Test suite kiểm thử toàn bộ các kịch bản

* #### **GracefulShutdownModule (Xử lý vòng đời dừng ứng dụng an toàn):**

  * Vấn đề: Khi Kubernetes Scale-in hoặc Deploy phiên bản mới, Pod nhận tín hiệu `SIGTERM`. Nếu ngắt process đột ngột, các request HTTP đang dở dang sẽ bị lỗi 502, các consumer BullMQ bị đứt ngang gây hỏng trạng thái job, kết nối DB bị leak.   
  * Công nghệ: NestJS Lifecycle Hooks (`onApplicationShutdown`, `beforeApplicationShutdown`).  
  * Mục đích: Điều phối trình tự tắt tiến trình có kiểm soát khi nhận tín hiệu SIGTERM từ Kubernetes/Docker: ngừng nhận traffic mới từ Load Balancer, chờ xử lý hết in-flight HTTP requests, tạm dừng nhận job từ queue, flush buffer log/traces, và giải phóng an toàn kết nối cơ sở dữ liệu.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Tiêu chí kỹ thuật | Đánh giá hiện trạng & Rủi ro khi vận hành thực tế trên Kubernetes |
| :---- | :---- |
| **1\. Trình tự ngắt kết nối đa pha (Phased Decommissioning Sequence)** | **Rủi ro race condition:** Nếu đóng kết nối Database ngay khi nhận SIGTERM, các HTTP request hoặc queue job đang xử lý dở dang sẽ lập tức ném lỗi Connection terminated unexpectedly (HTTP 500/502). Việc tắt hệ thống bắt buộc phải tuân theo 5 pha nghiêm ngặt: **Drain Traffic  Pause Consumers  Drain HTTP  Flush Buffers  Release DB Pools**. |
| **2\. Tương tác với Kubernetes Readiness Probe** | Khi Pod nhận SIGTERM, Kubernetes Ingress Controller (hoặc AWS ALB) cần từ 3–8 giây để cập nhật iptables và gạch IP của Pod khỏi danh sách Endpoint. Cần cung cấp cờ trạng thái isShuttingDown() để endpoint /health/readiness lập tức trả về 503 Service Unavailable, báo hiệu Load Balancer ngừng định tuyến traffic mới vào Pod. |
| **3\. Cơ chế đăng ký móc đóng tài nguyên mở (Shutdown Registry)** | Hiện tại, việc đóng dataSource đang bị gắn cứng (hardcode) trong service shutdown. Khi dự án tích hợp thêm BullMQ, Redis, hay WebSocket, việc sửa trực tiếp vào core shutdown sẽ vi phạm nguyên tắc Open/Closed (OCP). Cần một ShutdownRegistry cho phép các module hạ tầng độc lập tự đăng ký hàm dọn dẹp theo pha tương ứng. |
| **4\. Đồng hồ bảo vệ cưỡng chế (Watchdog / Hard Timeout)** | Kubernetes cấp terminationGracePeriodSeconds (thường là 30–60 giây). Nếu một truy vấn SQL bị treo hoặc một kết nối HTTP của client không chịu đóng, tiến trình sẽ bị K8s tiêu diệt cưỡng bức bằng SIGKILL (kill \-9). Cần bộ đếm ngược (Watchdog Timer) để tự động process.exit(1) an toàn trước khi chạm ngưỡng SIGKILL. |

**Cấu trúc triển khai src/core/shutdown/**

src/core/shutdown/  
├── shutdown.interface.ts        \[mới\]  \# Khai báo các Phase tắt hệ thống và Handler contract  
├── shutdown.registry.ts           \[mới\] \# Central Registry để các module hạ tầng đăng ký clean-up hook  
├── graceful-shutdown.service.ts   \[cập nhật\] \# Điều phối vòng đời 5 pha và bộ đếm ngược Watchdog  
├── graceful-shutdown.module.ts   \[cập nhật\] \# Global Module  
└── graceful-shutdown.service.spec.ts \[mới\] \# Test suite kiểm thử trình tự 5 pha và cơ chế ngắt

### **2\. Nhóm Giám sát, Vận hành & Khả năng quan sát (Observability & APM)**

* #### **HealthModule (Kiểm chuẩn tình trạng hệ thống):**

  * Công nghệ: `@nestjs/terminus`, `@godaddy/terminus`.  
  * Mục đích: Cung cấp các endpoint `/health/liveness` và `/health/readiness` cho Kubernetes / Load Balancer. Kiểm tra ping sống còn thực tế tới PostgreSQL, Redis, Message Queue và dung lượng ổ đĩa/RAM khả dụng trước khi định tuyến traffic.

* #### **LoggerModule (Ghi log có cấu trúc & Truy vết):**

  * Công nghệ: `nestjs-pino` hoặc `winston`.  
  * Mục đích: Xuất log định dạng JSON chuẩn (Structured Logging), gắn `correlationId` / `traceId` xuyên suốt từ lúc request đi vào Gateway cho đến tầng Repository. Tự động che dấu (masking) các trường nhạy cảm như mật khẩu, số thẻ ngân hàng, token trước khi đẩy về ELK/Loki.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Lỗ hổng kỹ thuật |
| :---- | :---- | :---- |
| **1\. Structured Logging JSON (Pino)** | **ĐÃ CÓ** | Đã tích hợp nestjs-pino và pinoHttp xuất log JSON. |
| **2\. Tự động đính kèm traceId, userId, tenantId ở mọi tầng** | **CHƯA ĐẦY ĐỦ** | pinoHttp chỉ tự gắn metadata ở tầng Request/Response HTTP. Khi lập trình viên gọi this.logger.info(...) ở tầng Service/Repository hoặc bên trong Background Queue Worker, log không tự động mang theo traceId, userId, hay tenantId. Cần một AppLoggerService kế thừa để tự động nhúng ngữ cảnh từ RequestContextService vào mọi dòng log. |
| **3\. Che giấu dữ liệu nhạy cảm (Data Redaction / Masking)** | **CHƯA TOÀN DIỆN** | Cấu hình cũ mới chỉ che mật khẩu đơn giản. Nghiệp vụ Travel Tech & Thanh toán xử lý rất nhiều trường nhạy cảm: cvv, cardNumber, passportNumber, refreshToken, apiKey, pin, clientSecret. Bắt buộc phải che giấu theo chuẩn PCI-DSS và GDPR bằng wildcard (\*.\*). |
| **4\. Chuẩn hóa Serializer (Error & HTTP Objects)** | **CÒN THIẾU** | Khi ném ra một NestJS HttpException (chứa validation error array), serializer mặc định của Pino thường làm mất chi tiết lỗi (chỉ in message chung), gây khó khăn cho việc truy vết lỗi trên Grafana Loki / Kibana. |
| **5\. Phân tách định dạng môi trường (Dev Pretty vs Prod JSON)** | **CẦN TỐI ƯU** | Khi chạy trong Docker/Kubernetes trên Production, Pino bắt buộc phải xuất raw JSON một dòng duy nhất (Single-line NDJSON) để log shipper (Fluentbit / Promtail) thu gom với chi phí CPU tối thiểu. |

**Cập nhật và nâng cấp toàn bộ mã nguồn src/core/logger/**

 src/core/logger/  
├── logger.constants.ts          \# \[MỚI\] Danh mục trường nhạy cảm cần Masking (PCI-DSS/GDPR)  
├── logger.serializers.ts        \# \[MỚI\] Bộ chuyển đổi chuẩn cho Request, Response và Error Objects  
├── app-logger.service.ts        \# \[MỚI\] Logger Service tự động inject TraceId, UserId, TenantId  
├── logger.module.ts             \# \[CẬP NHẬT\] Đăng ký PinoHttp, Serializers và Export AppLogger  
└── app-logger.service.spec.ts   \# \[MỚI\] Test suite kiểm thử gắn context và che dấu dữ liệu

* #### **MetricsModule (Đo lường hiệu năng ứng dụng \- APM):**

  * Công nghệ: `prom-client`, `OpenTelemetry`.  
  * Mục đích: Thu thập chỉ số thời gian thực (Request duration, HTTP error rates, Event Loop lag, Heap memory, Active DB connection pool) và phơi endpoint `/metrics` cho Prometheus/Grafana cào dữ liệu để kích hoạt cảnh báo sớm.

* #### **TracingModule (Truy vết phân tán \- Distributed Tracing):**

  * Công nghệ: `@opentelemetry/sdk-node`, Jaeger, Zipkin.  
  * Mục đích: Tạo Span ID cho từng chặng gọi: từ API nội bộ đến truy vấn SQL và các cuộc gọi HTTP sang bên thứ ba (Aviation, Payment). Cho phép đo chính xác từng mili-giây độ trễ phát sinh ở module nào khi xảy ra bottleneck.

* #### **AuditLogModule (Lưu vết thay đổi dữ liệu & Tuân thủ pháp lý):**

  * Công nghệ: TypeORM/Prisma CDC (Change Data Capture) hoặc Outbox Poller, Elasticsearch / OpenSearch, PostgreSQL Partitioning.  
  * Mục đích:  
    * **Chiều Ghi (Immutable Ingestion):** Ghi nhận bất biến toàn bộ hành vi: Ai (`actor_id`), quyền hạn lúc đó, thực hiện thao tác gì (`action`), trên đối tượng nào (`resource_id`), thời điểm nào (`timestamp`), địa chỉ IP, User-Agent, và khác biệt dữ liệu (`diff snapshot: old_val vs new_val`). Không cho phép sửa/xóa dưới mọi hình thức (WORM).  
    * **Chiều Đọc & Phân quyền truy cập (Scoped Retrieval):** Cung cấp API tra cứu log được bọc bởi chính sách phân quyền dữ liệu theo phạm vi:  
      * *Cá nhân (`audit:read:own`):* Nhân viên chỉ xem được lịch sử thao tác của chính tài khoản mình.  
      * *Trưởng bộ phận (`audit:read:department`):* Trưởng phòng chỉ xem được log hoạt động của các thành viên trực thuộc cây tổ chức (Organizational Unit) do mình quản lý.  
      * *Kiểm toán viên / Admin (`audit:read:global`):* Xem toàn bộ log hệ thống, hỗ trợ đối soát gian lận và xuất báo cáo tuân thủ pháp lý (ISO 27001, SOC2, PCI-DSS).  
    * **Lưu trữ phân tầng (Hot/Cold Tiering):** Tự động chuyển đổi log sau 90 ngày từ Hot DB sang Cold Storage (S3 Glacier) để tối ưu chi phí lưu trữ dài hạn.

### **3\. Nhóm Bảo mật, Kiểm soát Lưu lượng & Dữ liệu (Security, Traffic & Access Control)**

* #### **AccessControlModule (Bộ phân quyền ma trận Resource:Action:Scope & Policy Engine):**

  * Công nghệ: `@casl/ability` hoặc `casbin`, kết hợp Redis caching permissions.  
  * Mục đích: Quản lý ma trận phân quyền cấp doanh nghiệp, tách biệt hoàn toàn Role và Permission:  
    * Người dùng được gán nhiều Roles; mỗi Role chứa danh sách các Permission chuẩn định dạng: `<resource>:<action>:<scope>` (ví dụ: `documents:approve:department`, `payroll:read:own`, `users:delete:global`).  
    * Cung cấp `PermissionsGuard` để đánh giá ngữ cảnh yêu cầu, kiểm tra quyền tĩnh và tính toán thuộc tính động (ABAC \- Attribute-Based Access Control, ví dụ: kiểm tra `target.department_id === user.department_id`).

**Bảng đánh giá hiện trạng & Các khoảng trống (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Chi tiết hiện trạng & Điểm còn thiếu |
| :---- | :---- | :---- |
| **1\. Định dạng \<resource\>:\<action\>:\<scope\>** | **ĐÃ ĐẠT** | Đã triển khai bộ parser trong CaslAbilityFactory và hỗ trợ scope OWN, DEPARTMENT, GLOBAL. |
| **2\. Động cơ tính toán ABAC** | **ĐÃ ĐẠT** | Đã sử dụng createMongoAbility để so khớp trực tiếp departmentId và userId. |
| **3\. PermissionsGuard & Route Decorator** | **CÒN THIẾU** | Chưa có @RequirePermissions() decorator và PermissionsGuard để chặn request ngay tại Controller. Hiện tại mới chỉ kiểm tra thủ công bằng code trong service (accessControlService.enforce(...)). |
| **4\. Cơ chế trích xuất đối tượng ABAC (Dynamic Subject Resolver)** | **CÒN THIẾU** | PermissionsGuard cần biết cách lấy dữ liệu thực tế (từ req.params.id, req.body, hoặc entity tải từ DB) để kiểm tra xem target.department\_id \=== user.department\_id trước khi cho phép vào Controller. |
| **5\. Phân rã Role  Permissions & Redis Caching** | **CÒN THIẾU** | Người dùng thường có nhiều Roles; mỗi Role gồm nhiều Permissions. Cần một tầng Cache (Redis) lưu danh sách permission đã làm phẳng (flattened & deduplicated) theo user\_id để tránh query database ở mọi request. |

**Nâng cấp và hoàn thiện toàn bộ mã nguồn src/core/access-control/**

Dưới đây là các thành phần bổ sung để hoàn thiện 100% logic theo chuẩn Enterprise:

src/core/access-control/

├── access-control.types.ts           \# (Đã có) Enum Action, Scope, Interfaces

├── casl-ability.factory.ts           \# (Đã có) Ability builder với MongoAbility

├── access-control.service.ts         \# (Đã có) Service kiểm tra logic mức runtime

├── permission.decorator.ts           \# \[MỚI\] Decorator @RequirePermissions()

├── permissions.guard.ts              \# \[MỚI\] Guard kiểm tra quyền tĩnh & ABAC động

├── permission-cache.service.ts       \# \[MỚI\] Cache quyền phẳng (Flattened Permissions) qua Redis

└── access-control.module.ts          \# \[CẬP NHẬT\] Đăng ký Guard, Cache Service và Factory

#### 

* #### **SecurityModule (Phòng thủ chiều sâu & Header an toàn):**

  * Công nghệ: `helmet`, `cors`, `csurf`.  
  * Mục đích: Cấu hình Content Security Policy (CSP), HSTS, chống Clickjacking (X-Frame-Options), chặn MIME sniffing, và quản lý danh sách trắng (Whitelist) CORS chặt chẽ giữa các domain nội bộ.

* #### **EncryptionModule / SecretsModule (Mã hóa dữ liệu & Quản lý khóa):**

  * Công nghệ: `crypto` native, HashiCorp Vault SDK, AWS KMS.  
  * Mục đích: Mã hóa ở cấp độ trường (Field-Level Encryption) cho các thông tin định danh cá nhân (PII) như CMND/Hộ chiếu, số thẻ trước khi lưu xuống PostgreSQL; đồng thời xoay vòng (rotate) API Key của đối tác định kỳ mà không cần restart server.

* #### **ThrottlerModule / RateLimiterModule (Kiểm soát lưu lượng & Chống lạm dụng):**

  * Công nghệ: `@nestjs/throttler`, `ioredis`.  
  * Mục đích: Bảo vệ API chống brute-force và DDoS theo thuật toán Sliding Window hoặc Token Bucket lưu trạng thái trên Redis. Phân cấp giới hạn: API công khai (ví dụ: 60 req/phút), API tra cứu giá (100 req/phút), API nhạy cảm như Login/OTP (5 req/phút).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Lỗ hổng kỹ thuật |
| :---- | :---- | :---- |
| **1\. Mã hóa cấp trường (Field-Level Encryption \- FLE)** | **CHƯA ĐẦY ĐỦ** | Mới có hàm encrypt() / decrypt() rời rạc trong EncryptionService. Chưa có TypeORM ValueTransformer để tự động hóa việc mã hóa khi ghi (to) và giải mã khi đọc (from) trên các cột thực thể PII (Hộ chiếu, CMND, Số thẻ ngân hàng). |
| **2\. Xoay vòng khóa (Zero-Downtime Key Rotation)** | **CÒN THIẾU** | Ciphertext hiện tại không lưu keyVersion. Khi xoay sang khóa mới, toàn bộ dữ liệu mã hóa bằng khóa cũ trong Database sẽ vĩnh viễn không giải mã được. Cần cấu trúc Ciphertext định danh phiên bản: enc:\<keyVersion\>:\<iv\>:\<authTag\>:\<ciphertext\> và cơ chế nạp khóa động mà không cần restart server. |
| **3\. Phân cấp Throttling theo 3 tầng nghiệp vụ** | **CÒN THIẾU** | Chưa thiết lập Named Throttlers (public: 60/phút, search: 100/phút, sensitive: 5/phút) và các route decorator chuyên dụng (@ThrottlePublic(), @ThrottleSearch(), @ThrottleSensitive()). |
| **4\. Định danh Tracker thông minh trong Rate Limiting** | **CÒN THIẾU** | Nếu chỉ rate limit theo ip, toàn bộ nhân viên dùng chung mạng văn phòng (NAT/Proxy) sẽ bị chặn oan khi một người gửi nhiều request. Cần một custom CustomThrottlerGuard ưu tiên theo userId (nếu đã đăng nhập) và fallback về clientIp (được trích xuất chuẩn qua Proxy headers). |
| **5\. Quản trị CORS Whitelist & CSP động** | **CHƯA CHẶT CHẼ** | Cấu hình CORS hiện tại nhận mảng chuỗi tĩnh. Cần regex resolver để hỗ trợ các domain/subdomain nội bộ an toàn (ví dụ: \*.travelcorp.vn), kết hợp bộ policy CSP chuẩn doanh nghiệp chặn tiêm nhiễm XSS và Clickjacking. |

**Cập nhật và nâng cấp toàn bộ mã nguồn src/core/security/**

src/core/security/  
├── encryption/  
│   ├── encryption.service.ts          	\# \[NÂNG CẤP\] AES-256-GCM \+ Phiên bản khóa \+ Xoay vòng khóa  
│   ├── encryption.transformer.ts      \# \[MỚI\] TypeORM ValueTransformer tự động FLE cho PII  
│   └── encryption.service.spec.ts    \# \[CẬP NHẬT\] Test suite kiểm thử mã hóa và xoay khóa  
├── throttler/  
│   ├── throttler.constants.ts         	\# \[MỚI\] Khai báo 3 tầng Rate Limit (public, search, sensitive)  
│   ├── throttler.decorators.ts        	\# \[MỚI\] Decorator @ThrottlePublic, @ThrottleSearch, @ThrottleSensitive  
│   ├── custom-throttler.guard.ts      \# \[MỚI\] Guard định danh tracker theo User ID hoặc Real Client IP  
│   └── throttler-storage.provider.ts \# \[MỚI\] Khởi tạo bộ nhớ lưu trữ Throttler (Redis / Memory)  
├── headers/  
│   └── security-headers.config.ts    \# \[MỚI\] Cấu hình chuẩn hóa Helmet CSP, HSTS, Frameguard, CORS  
└── security.module.ts                 	\# \[CẬP NHẬT\] Tích hợp và Export toàn bộ hệ thống bảo mật

* #### **IdempotencyModule (Chống trùng lặp giao dịch):**

  * Công nghệ: NestJS Interceptor \+ Redis Distributed Cache.  
  * Mục đích: Bắt buộc các request nhạy cảm (thanh toán, xuất vé, tạo đơn hàng) phải gửi kèm header `Idempotency-Key`. Nếu cùng một key được gửi lại khi request trước đang xử lý hoặc đã hoàn tất, hệ thống trả về ngay kết quả đã lưu trong cache, ngăn chặn hoàn toàn việc trừ tiền hoặc tạo trùng đơn hai lần.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Tiêu chí kỹ thuật | Đánh giá hiện trạng & Rủi ro khi vận hành |
| :---- | :---- |
| **1\. Trạng thái thực thi hai pha (Two-Phase State Machine)** | **Rủi ro Race Condition:** Nếu hai request thanh toán gửi lên đồng thời (trong cùng 10ms) với cùng một Idempotency-Key, cache chưa kịp lưu kết quả sẽ khiến cả hai request cùng lọt vào Controller trừ tiền 2 lần. Cần giải thuật khóa phân tán với trạng thái IN\_PROGRESS (sử dụng Redis SET NX EX) để trả về 409 Conflict lập tức cho request thứ hai. |
| **2\. Dấu vân tay Request (Request Fingerprint Matching)** | **Lỗ hổng Replay/Tampering:** Client vô tình gửi lại Idempotency-Key cũ của đơn đặt phòng \$50 nhưng body lần này lại là đơn xuất vé \$500. Nếu chỉ kiểm tra key thuần túy, hệ thống sẽ trả nhầm kết quả hoặc sai lệch trạng thái. Cần băm SHA-256 (method \+ path \+ body) để đối soát: nếu cùng key nhưng khác payload, lập tức ném 400 Bad Request (Payload Mismatch). |
| **3\. Tự động hoàn trả khóa khi xảy ra sự cố (Error Release)** | Nếu downstream API đối tác sập hoặc DB bị deadlock dẫn đến request thất bại (HTTP 500), hệ thống phải tự động xóa lock IN\_PROGRESS trong Redis để client có thể retry lại sau đó. |
| **4\. Trải nghiệm phát triển (Route Decorator)** | Cần decorator @Idempotent() cho phép cấu hình linh hoạt: bắt buộc có header (required: true/false), thời gian giữ kết quả (ttlSeconds, mặc định 24h), và custom header name. |

**Cấu trúc triển khai src/core/security/idempotency/**

src/core/security/idempotency/  
├── idempotency.constants.ts            \# Tên Header (Idempotency-Key), Redis Key Prefix  
├── idempotency.interface.ts            \# Cấu trúc bản ghi trạng thái (IN\_PROGRESS / COMPLETED)  
├── idempotency.decorator.ts            \# Decorator @Idempotent() cho các Controller Handlers  
├── idempotency-storage.service.ts      \# Quản lý khóa phân tán & Cache trên Redis (hỗ trợ Memory fallback)  
├── idempotency.interceptor.ts          \# Interceptor chặn trùng lặp, trả cache và khóa trạng thái  
├── idempotency.module.ts               \# Module xuất bản tính năng Idempotency  
└── idempotency.interceptor.spec.ts     \# Test suite kiểm thử toàn diện trạng thái và race condition

* #### **MultiTenancyModule (Cách ly dữ liệu đa tổ chức/doanh nghiệp):**

  * Công nghệ: PostgreSQL Row-Level Security (RLS), TypeORM/Prisma Tenancy Interceptors, Dynamic DB Schema Connection Pool.  
  * Mục đích: Tách biệt logic và dữ liệu giữa các doanh nghiệp khách hàng (Tenants) theo kiến trúc Shared Database / Separate Schema hoặc Discriminator Column kết hợp RLS, đảm bảo không bao giờ xảy ra rò rỉ dữ liệu chéo giữa các tenant trong hệ thống B2B SaaS / ERP.

**Bảng phân tích kiến trúc & Khoảng trống kỹ thuật (Gap Analysis)**

| Tiêu chí kỹ thuật | Đánh giá kiến trúc & Rủi ro bảo mật thực tế |
| :---- | :---- |
| **1\. Mô hình lưu trữ dữ liệu (Tenancy Pattern)** | **Mô hình Shared Database \+ Discriminator Column (tenant\_id) kết hợp PostgreSQL RLS** là giải pháp tối ưu chi phí hạ tầng và hiệu năng nhất cho B2B SaaS / ERP. (Mô hình Separate Database quá tốn kém Connection Pool; mô hình Separate Schema gây nghẽn và drift khi chạy Migration DDL đồng thời). |
| **2\. Phòng thủ chiều sâu 2 lớp (Defense-in-Depth)** | **Rủi ro nếu chỉ lọc ở tầng ORM (where: { tenantId }):** Nếu một lập trình viên vô tình viết câu query raw SQL hoặc quên mệnh đề where, toàn bộ dữ liệu của đối thủ cạnh tranh sẽ bị lộ ra ngoài. Bắt buộc phải có **PostgreSQL Row-Level Security (RLS)** chặn ngay tại tầng nhân DB kernel. |
| **3\. Điểm nghẽn Connection Pooling khi dùng RLS** | Trong Node.js / TypeORM, các kết nối trong pool được dùng chung. Nếu dùng lệnh SET app.current\_tenant\_id \= '...' thông thường, biến này sẽ lưu mãi trên kết nối đó, dẫn đến nguy cơ request sau dùng trúng kết nối cũ của tenant khác\! Giải pháp: Bắt buộc dùng lệnh **SET LOCAL app.current\_tenant\_id \= '...' bên trong Transaction** để Postgres tự hủy biến ngay khi kết thúc commit/rollback. |
| **4\. Tự động hóa ở tầng TypeORM (Zero-Boilerplate)** | Cần TenantBaseEntity và một TenancySubscriber tự động lấy tenantId từ RequestContextService để nạp vào entity trước khi INSERT, đồng thời kiểm tra tính toàn vẹn khi UPDATE/DELETE. |
| **5\. Cơ chế Bypass RLS cho SuperAdmin & Tác vụ hệ thống** | Các tác vụ nền (Outbox poller, quét đối soát toàn sàn, SuperAdmin báo cáo doanh thu) cần một cơ chế bypass có kiểm soát (app.bypass\_rls \= 'on') mà không làm sập quy tắc cách ly của các request bình thường. |

**Cấu trúc triển khai src/core/multitenancy/**

src/core/multitenancy/  
├── tenancy.constants.ts               \# Tên header, PostgreSQL session variable keys  
├── tenant-base.entity.ts              \# Entity nền tảng có trường tenant\_id & Index  
├── tenancy-context.middleware.ts      \# Bóc tách và xác thực Tenant từ Header / JWT / Subdomain  
├── tenancy.subscriber.ts              \# TypeORM Subscriber tự động inject và bảo vệ tenant\_id  
├── rls.service.ts                     \# Transaction Runner quản trị PostgreSQL RLS an toàn  
├── multitenancy.module.ts             \# Đăng ký Global Module  
└── multitenancy.spec.ts               \# Test suite kiểm thử cách ly dữ liệu và RLS logic

### **4\. Nhóm Dữ liệu, Đồng bộ & Tính nhất quán phân tán (Data Access, Persistence & Concurrency)**

* #### **DatabaseModule (Quản trị kết nối cơ sở dữ liệu mở rộng):**

  * Công nghệ: TypeORM / Prisma / Kysely.  
  * Mục đích: Cấu hình động cơ chế Connection Pooling (Min/Max pool, idle timeout), tự động ngắt kết nối chết, phân tách đường truyền Master-Replica (ghi vào Master, phân luồng đọc sang Replica để tối ưu tải).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Lỗ hổng kỹ thuật |
| :---- | :---- | :---- |
| **1\. Phân tách Master \- Replica (Write/Read Splitting)** | **ĐÃ CÓ** | Đã cấu hình node Master và Slaves trong TypeOrmModule.forRootAsync. |
| **2\. Tối ưu Connection Pool & Ngắt kết nối chết (Dead Connection Reaping)** | **CHƯA ĐẦY ĐỦ** | Mới cấu hình max/min. Thiếu cấu hình TCP Keep-Alive (keepAlive: true), statement\_timeout (ngắt truy vấn treo/chạy quá lâu làm khóa bảng), và query\_timeout ở tầng driver pg. |
| **3\. TypeORM Logger tích hợp Pino & Distributed Tracing** | **CÒN THIẾU** | Mặc định TypeORM log ra console bằng chuỗi thô. Khi có truy vấn lỗi hoặc truy vấn chậm (Slow Query) trên production, DevOps không thể biết truy vấn đó thuộc về traceId hay userId nào. Cần custom TypeOrmLogger gắn traceId từ RequestContextService. |
| **4\. Chuẩn hóa tên CSDL (Snake\_case Naming Strategy)** | **CÒN THIẾU** | Trong PostgreSQL, tiêu chuẩn tên bảng/cột là snake\_case (ví dụ: created\_at, booking\_code), trong khi code TypeScript dùng camelCase (createdAt, bookingCode). Thiếu SnakeNamingStrategy dẫn đến phải viết thủ công @Column({ name: '...' }) ở khắp nơi. |
| **5\. Thực thể nền tảng chuẩn Enterprise (BaseEntity)** | **CÒN THIẾU** | Mọi bảng giao dịch (Bookings, Items, Logs) đều cần: Khóa chính UUID v4, thời gian tạo (createdAt), cập nhật (updatedAt), xóa mềm (deletedAt), và cột @VersionColumn (Optimistic Locking chống xung đột đặt chỗ đồng thời). |

**Cập nhật và nâng cấp toàn bộ mã nguồn src/core/database/**

src/core/database/  
├── base.entity.ts               \# \[MỚI\] Base Entity (UUID, Timestamps, Soft-delete, Optimistic Lock)  
├── snake-naming.strategy.ts     \# \[MỚI\] Tự động chuyển đổi camelCase \<-\> snake\_case cho PostgreSQL  
├── typeorm-logger.service.ts    \# \[MỚI\] Custom TypeORM Logger gắn traceId & log cảnh báo Slow Query  
├── database.module.ts           \# \[CẬP NHẬT\] Đăng ký Master/Replica, Dead Connection Reaping & Pool  
└── snake-naming.strategy.spec.ts\# \[MỚI\] Test suite kiểm thử chuẩn hóa tên bảng/cột

* #### **CacheModule (Bộ nhớ đệm đa tầng):**

  * Công nghệ: `cache-manager`, `@keyv/redis`, thuật toán XFetch.  
  * Mục đích: Cung cấp decorator `@UseInterceptors(CacheInterceptor)` và service thao tác In-Memory Cache (RAM) kết hợp Distributed Cache (Redis). Quản lý chính sách hết hạn (TTL), cache tagging, chủ động xóa cache (Cache Invalidation) và chống sập DB khi key hết hạn đồng thời (Anti-Cache Stampede).

* #### **DistributedLockModule (Khóa phân tán):**

  * Công nghệ: `redlock`, `ioredis`.  
  * Mục đích: Cung cấp cơ chế khóa tài nguyên trong môi trường nhiều instance server (multi-pod). Đảm bảo chỉ có duy nhất một tiến trình được thực thi logic quan trọng tại một thời điểm (ví dụ: giữ ghế máy bay, trừ tồn kho phòng khách sạn, chạy settlement đối soát cuối ngày).

* #### **OutboxModule (Bảo đảm toàn vẹn thông điệp phân tán):**

  * Công nghệ: Transactional Outbox Pattern \+ Prisma/TypeORM.  
  * Mục đích: Lưu trữ các sự kiện cần gửi đi (Domain Events) vào chung một database transaction của nghiệp vụ chính. Một background poller sẽ quét bảng outbox để đẩy sang Message Queue, đảm bảo không bao giờ xảy ra tình trạng "ghi DB thành công nhưng publish message thất bại" (At-least-once delivery).

* #### **MigrationModule / DatabaseSeeder (Quản trị lược đồ & Dữ liệu khởi tạo):**

  * Vấn đề: Ở môi trường doanh nghiệp, migration không thể chạy tự do lúc ứng dụng boot trên nhiều Pod (gây lock table hoặc race conditions)   
  * Công nghệ: TypeORM / Prisma Migrate / Kysely CLI, Kubernetes InitContainers.  
  * Mục đích: Tách biệt việc nâng cấp lược đồ database (Schema Migration theo quy trình Zero-downtime Expand/Contract) và nạp dữ liệu danh mục tĩnh ban đầu (Lookup tables, quyền hệ thống) ra khỏi chu kỳ runtime của các Pod API chính, ngăn chặn hoàn toàn race conditions và table lock.

### **5\. Nhóm Giao tiếp Ngoại vi & Chống sụp đổ dây chuyền (Integration & Fault Tolerance)**

* #### **ResilienceModule / FaultToleranceModule (Chống sụp đổ dây chuyền & Cô lập lỗi):**

  * Vấn đề: Các hệ thống doanh nghiệp (như Booking, E-commerce, Fintech) phải gọi hàng loạt API bên thứ ba (Cổng thanh toán, Core Banking, GDS vé máy bay). Nếu đối tác phản hồi chậm (latent) hoặc sập, toàn bộ connection pool và event loop của NestJS sẽ bị nghẽn, kéo sập ứng dụng (Cascading Failure).   
  * Công nghệ: `opossum` (Circuit Breaker), `cockatiel` (Retry, Bulkhead, Fallback, Timeout policies).   
  * Mục đích: Cung cấp Circuit Breaker để tự động ngắt kết nối tạm thời khi dịch vụ bên thứ ba (Cổng thanh toán, Hãng bay, GDS) gặp sự cố hoặc quá tải, chuyển hướng tức thì sang Fallback; đồng thời áp dụng Bulkhead Pattern giới hạn số luồng đồng thời gọi ra ngoài để bảo toàn tài nguyên máy chủ.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis)**

| Hạng mục đặc tả | Trạng thái | Đánh giá hiện trạng & Lỗ hổng kỹ thuật |
| :---- | :---- | :---- |
| **1\. Circuit Breaker (opossum)** | **ĐÃ CÓ (CƠ BẢN)** | Đã bọc hàm qua Opossum với các sự kiện open, halfOpen, close. |
| **2\. Bulkhead Pattern (Cô lập tài nguyên)** | **CÒN THIẾU** | Chưa có cơ chế giới hạn số kết nối đồng thời (concurrency pool) độc lập cho từng đối tác. Nếu API Sabre bị nghẽn, các request gọi sang Sabre sẽ chiếm dụng toàn bộ tài nguyên máy chủ, làm nghẽn luôn các cuộc gọi sang Vietjet hoặc VNPay. |
| **3\. Retry với Exponential Backoff & Jitter** | **CÒN THIẾU** | Khi API đối tác gặp lỗi tạm thời (transient error / network blip), hệ thống ngắt mạch ngay mà không thử lại có kiểm soát. Cần thuật toán thử lại có giãn cách ngẫu nhiên (Full Jitter) để tránh gây quá tải dồn dập (Thundering Herd). |
| **4\. Trải nghiệm phát triển (Method Decorator)** | **CÒN THIẾU** | Việc phải gọi this.resilienceService.execute(...) thủ công trong từng hàm adapter gây lặp mã (boilerplate). Cần decorator @Resilient() để khai báo chính sách bảo vệ trực tiếp trên method. |
| **5\. Giám sát & Báo cáo trạng thái (Health/Metrics)** | **CÒN THIẾU** | Thiếu phương thức cung cấp trạng thái mạch (OPEN / CLOSED / HALF\_OPEN) và số liệu thống kê (failures, fallbacks, rejects) để tích hợp vào HealthModule và xuất metric cho Prometheus/Grafana. |

**Cập nhật và nâng cấp toàn bộ mã nguồn src/core/resilience/**

src/core/resilience/  
├── resilience.interface.ts      \# \[MỚI\] Interface cấu hình Circuit Breaker, Bulkhead, Retry & Metrics  
├── bulkhead.ts                  \# \[MỚI\] Bộ điều phối Bulkhead Semaphore phân lập luồng đồng thời  
├── resilience.service.ts        \# \[CẬP NHẬT\] Hợp nhất Circuit Breaker \+ Bulkhead \+ Retry \+ Fallback  
├── resilience.decorator.ts      \# \[MỚI\] Decorator @Resilient() declarative cho Adapters/Services  
├── resilience.module.ts         \# \[CẬP NHẬT\] Đăng ký Global Provider  
└── resilience.service.spec.ts   \# \[MỚI\] Test suite kiểm chuẩn Circuit Breaker, Bulkhead và Fallback

* #### **HttpClientModule / IntegrationModule (Chuẩn hóa giao tiếp HTTP ngoại vi):**

  * Vấn đề: Nếu mỗi service tự inject `HttpService` (`@nestjs/axios`) hoặc `fetch` riêng rẽ, hệ thống sẽ thiếu tính nhất quán về timeout, mTLS, header propagation, và centralized retry.  
  * Công nghệ: `@nestjs/axios`, custom Axios instances.  
  * Mục đích: Trừu tượng hóa các cuộc gọi ra API ngoài với timeout nghiêm ngặt, tự động gắn Header lan truyền (Trace/Correlation ID propagation), xác thực chứng chỉ hai chiều (mTLS), cơ chế Exponential Retry và log toàn bộ Request/Response (đã tự động che giấu PII).

* #### **WebhookModule (Quản trị Webhook hai chiều):**

  * Công nghệ: `crypto` (HMAC SHA-256), Queue-backed Webhook Dispatcher.  
  * Mục đích: Quản lý nhận và phát webhook an toàn: xác thực tính toàn vẹn payload gửi đến qua chữ ký số, đồng thời đảm bảo webhook hệ thống phát ra cho đối tác được thử lại định kỳ theo lịch trình nếu đối tác tạm thời mất kết nối.

### **6\. Nhóm Tác vụ nền, Giao tiếp không đồng bộ & Thời gian thực (Asynchronous, Messaging & Realtime)**

* #### **QueueModule (Hàng đợi tác vụ nền & Dead-Letter Queue):**

  * Công nghệ: `@nestjs/bullmq`, `bullmq`, Redis.  
  * Mục đích: Tách các tác vụ nặng ra khỏi chu kỳ Request-Response của người dùng: xuất báo cáo Excel, gọi API kích hoạt vé, đồng bộ dữ liệu. Tích hợp sẵn cơ chế Exponential Backoff Retry và luân chuyển job lỗi sang Dead-Letter Queue (DLQ) để dev phân tích nguyên nhân.

* #### **ScheduleModule (Lập lịch tác vụ phân tán):**

  * Công nghệ: `@nestjs/schedule` kết hợp Redis Redlock / ShedLock.  
  * Mục đích: Quản lý các cron jobs định kỳ (quét đơn quá hạn giữ chỗ, tính toán doanh thu ngày, gửi email nhắc lịch). Đảm bảo khi scale chạy 10 pods NestJS thì cron job chỉ được thực thi bởi duy nhất 1 pod.

* #### **NotificationModule (Cổng thông báo đa kênh):**

  * Công nghệ: Nodemailer, AWS SES, Twilio, Firebase Admin (FCM), Telegram SDK.  
  * Mục đích: Trừu tượng hóa việc gửi thông báo. Nhận yêu cầu gửi theo template (Handlebars/EJS) và tự động định tuyến: gửi OTP qua SMS, gửi E-ticket qua Email, bắn thông báo trạng thái đơn hàng qua Mobile Push Notification hoặc Webhook về Slack/Telegram nội bộ.

* #### **EventEmitterModule / DomainEventModule (Tách rời logic bằng sự kiện nội bộ):**

  * Công nghệ: `@nestjs/event-emitter`.  
  * Mục đích: Triển khai kiến trúc Event-Driven bên trong ứng dụng (In-process). Khi module Booking tạo vé thành công, nó chỉ việc phát ra sự kiện booking.created. Các module Analytics, Notification, LoyaltyPoint sẽ tự lắng nghe và xử lý độc lập mà không bị dính chặt mã nguồn (tight coupling).

* #### **WebSocketModule / RealtimeModule (Giao tiếp thời gian thực):**

  * Công nghệ: `@nestjs/websockets`, `@nestjs/platform-socket.io`, Redis Adapter.  
  * Mục đích: Duy trì kết nối song công với client qua Socket.io. Cấu hình Redis Pub/Sub Adapter để đồng bộ kết nối giữa các cụm server, phục vụ việc bắn thông báo tức thì, cập nhật biến động giá vé hoặc luồng duyệt đơn hàng theo thời gian thực.

### **7\. Nhóm Lưu trữ, Tài liệu & Xuất nhập dữ liệu (Storage & Document Processing)**

* #### **StorageModule (Trừu tượng hóa lưu trữ đối tượng \- Object Storage):**

  * Công nghệ: `@aws-sdk/client-s3`, MinIO Client.  
  * Mục đích: Cung cấp interface lưu file thống nhất. Xử lý logic tạo Presigned URL cho client upload trực tiếp lên S3/GCS (giảm tải băng thông cho server NestJS), quản lý phân quyền file (Public/Private), tự động tối ưu hóa kích thước ảnh và dọn dẹp file tạm.

* #### **DocumentReportModule (Bộ kết xuất chứng từ & PDF):**

  * Công nghệ: `puppeteer`, `pdfkit`, `exceljs`.  
  * Mục đích: Biên dịch file HTML/CSS template thành PDF độ phân giải cao phục vụ xuất vé điện tử, hợp đồng du lịch, hóa đơn VAT. Hỗ trợ cơ chế Streaming để đọc và xuất các file Excel đối soát hàng trăm ngàn dòng mà không làm tràn bộ nhớ (Out-of-Memory).

### **8\. Nhóm Quản trị API, Bản địa hóa & Trải nghiệm phát triển (API Governance & Developer Experience)**

* #### **SwaggerModule / OpenApiModule (Đặc tả và tài liệu hóa hợp đồng API):**

  * Công nghệ: `@nestjs/swagger`.  
  * Mục đích: Tự động sinh tài liệu OpenAPI/Swagger từ các DTO và Decorators, phân tách rõ ràng tài liệu API dành cho Client (Mobile/Web), API dành cho Đối tác B2B, và API nội bộ. Tích hợp Swagger UI phục vụ kiểm thử nhanh và xuất file schema cho frontend sinh code SDK tự động.

* #### **VersioningModule (Quản trị phiên bản & Lộ trình ngưng hỗ trợ API):**

  * Vấn đề: Các hệ thống B2B và Mobile Apps không thể bắt ép người dùng cập nhật ngay lập tức. API phải hỗ trợ chạy song song nhiều phiên bản.  
  * Công nghệ: NestJS URI/Header Versioning (`VersioningType.URI`), tiêu chuẩn RFC 8594 (Sunset & Deprecation headers).  
  * Mục đích: Định tuyến và duy trì nhiều phiên bản API song song (v1, v2) cho mobile app và đối tác B2B; tự động đính kèm các HTTP header Deprecation và Sunset để thông báo cho client lộ trình ngừng hỗ trợ các API cũ.

* #### **I18nModule (Bản địa hóa & Đa ngôn ngữ):**

  * Công nghệ: `nestjs-i18n`.  
  * Mục đích: Quản lý thông điệp phản hồi, mã lỗi (Error codes), và nội dung email theo đa ngôn ngữ (vi, en, ja, ko) dựa trên header Accept-Language của client gửi lên, tách biệt toàn bộ text cứng (hardcoded strings) ra khỏi logic xử lý.

* #### **FeatureFlagModule (Quản trị tính năng từ xa):**

  * Công nghệ: LaunchDarkly SDK, Unleash, hoặc database-backed flags.  
  * Mục đích: Cho phép bật/tắt tức thì một tính năng (ví dụ: cổng thanh toán mới, thuật toán tính giá mới, chương trình khuyến mãi) hoặc triển khai theo dạng Canary (cho 5% người dùng thử nghiệm trước) mà không cần build và deploy lại mã nguồn.

### 

### **9\. Cách tổ chức thư mục chuẩn trong NestJS Monorepo / Enterprise Project**

Mô hình phân tầng các supporting modules được cập nhật đầy đủ như sau:

Plaintext  
src/  
├── core/                           \# BẮT BUỘC KHỞI TẠO ĐẦU TIÊN (GLOBAL SINGLETONS / LIFECYCLE)  
│   ├── access-control/ 	\# AccessControlModule (CASL / Permission Matrix Engine)   
│   ├── config/                     	\# AppConfigModule (Zod/Joi validation)  
│   ├── context/                    	\# RequestContextModule (AsyncLocalStorage / CLS)  
│   ├── database/                   	\# DatabaseModule (Pool, Master/Replica)  
│   ├── logger/                     	\# LoggerModule (Pino structured log \+ Tracing)  
│   ├── resilience/                 	\# ResilienceModule (Circuit Breaker, Bulkhead)  
│   ├── security/                   	\# SecurityModule, ThrottlerModule, EncryptionModule  
│   └── shutdown/                   	\# GracefulShutdownModule (SIGTERM handlers)  
│  
├── common/                         \# DÙNG CHUNG TOÀN ỨNG DỤNG (CROSS-CUTTING UTILITIES)  
│   ├── constants/                  	\# System error codes, regexes  
│   ├── decorators/                 	\# @CurrentUser(), @Roles(), @IdempotencyKey()  
│   ├── filters/                    	\# AllExceptionsFilter, HttpExceptionFilter  
│   ├── guards/ 		\# JwtAuthGuard, PermissionsGuard (Resource:Action:Scope), ThrottlerGuard   
│   ├── interceptors/               	\# TimeoutInterceptor, TransformInterceptor, AuditInterceptor  
│   └── pipes/                      	\# Custom ValidationPipe, ParseDatePipe  
│  
├── infrastructure/                 \# CÁC DỊCH VỤ HẠ TẦNG KỸ THUẬT & TRÌNH ĐIỀU KHIỂN (PLUGINS/DRIVERS)  
│   ├── audit/ 		\# AuditLogModule (CDC Ingestion \+ Scoped Query Viewer API \+ S3 Tiering)   
│   ├── cache/                     	\# CacheModule (Redis)  
│   ├── http/                       	\# HttpClientModule (Centralized mTLS & trace forwarding)  
│   ├── lock/                       	\# DistributedLockModule (Redlock)  
│   ├── queue/                      	\# QueueModule (BullMQ setup & DLQ)  
│   ├── storage/                    	\# StorageModule (S3 / MinIO)  
│   ├── notification/               	\# NotificationModule (Mail, SMS, Telegram)  
│   ├── health/                     	\# HealthModule (Terminus probes)  
│   ├── metrics/                    	\# MetricsModule (Prometheus / APM)  
│   ├── outbox/                     	\# OutboxModule (Event relay)  
│   └── webhook/                    	\# WebhookModule (Signed dispatch & ingress)  
│  
└── modules/                        \# CÁC MODULE NGHIỆP VỤ LÕI (CORE BUSINESS DOMAIN)  
      ├── auth/ 			\# Authentication, Login, Token generation, Password reset   
    ├── users/ 			\# User profile, Roles & Permissions assignment   
    ├── bookings/  
    ├── flights/  
    ├── hotels/  
    └── payments/

Khi toàn bộ các module hỗ trợ này được thiết lập hoàn chỉnh, các module nghiệp vụ như Đặt vé máy bay hay Thanh toán chỉ cần tập trung duy nhất vào logic nghiệp vụ (Pure Business Logic), toàn bộ các bài toán về bảo mật, ghi vết, chống trùng lặp, mở rộng tải và phục hồi sự cố đều được các module hạ tầng xử lý tự động và nhất quán.