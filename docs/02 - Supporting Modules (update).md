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

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- HealthModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Phân định Liveness vs Readiness Probes** | Gộp chung toàn bộ kiểm tra (DB, Redis, RAM) vào một endpoint /health. Khi Database hoặc Redis quá tải tạm thời, Kubernetes Liveness probe đánh dấu chết và tự động khởi động lại (restart) Pod dồn dập, tạo ra thảm họa khởi động lại dây chuyền (**Restart Storm**). | **Phân tách rạch ròi 2 Probes:**  • /health/liveness: Siêu nhẹ, chỉ kiểm tra Node.js Event Loop phản hồi và ngưỡng Heap Memory sống còn. • /health/readiness: Kiểm tra sâu toàn bộ phụ thuộc ngoại vi (PostgreSQL, Redis, Queue, Disk). |
| **2\. Tương tác với Graceful Shutdown** | Khi Pod nhận tín hiệu SIGTERM, K8s Ingress cần từ 3–8s để cập nhật iptables gỡ IP của Pod. Nếu readiness vẫn trả về 200 OK, Load Balancer sẽ tiếp tục điều hướng request mới vào Pod đang tắt, gây lỗi HTTP 502/504. | Kết nối trực tiếp với GracefulShutdownService: Nếu shutdownService.isShuttingDown() là true, /health/readiness lập tức trả về **503 Service Unavailable** để Load Balancer cô lập Pod ngay tức khắc. |
| **3\. Bỏ qua cơ chế bảo vệ xác thực (Public Bypass)** | Nếu không gắn decorator @Public(), JwtAuthGuard sẽ chặn các request thăm dò định kỳ từ kubelet của Kubernetes bằng lỗi 401 Unauthorized, khiến K8s hiểu lầm ứng dụng bị treo và tự động kill Pod liên tục. | Đánh dấu @Public() trên toàn bộ các route thăm dò sức khỏe để mở cổng cho hạ tầng giám sát nội bộ. |
| **4\. Đo lường độ trễ phụ thuộc (Latency Telemetry)** | Chỉ trả về chuỗi status: up mà không có thông tin chi tiết về mili-giây phản hồi (latencyMs) của DB query hay Redis ping. | Bổ sung metadata đo lường thời gian phản hồi thực tế (latencyMs) trong kết quả trả về của từng Health Indicator. |

**Cấu trúc triển khai src/infrastructure/health/**

src/infrastructure/health/  
├── indicators/  
│   ├── database.health.ts        \# Kiểm tra kết nối PostgreSQL Master & Replica (kèm đo Latency)  
│   └── redis.health.ts           \# Kiểm tra kết nối Redis Core (lệnh PING)  
├── controllers/  
│   └── health.controller.ts      \# Cung cấp 2 Probes chuẩn K8s: /liveness và /readiness  
├── health.module.ts              \# Đăng ký TerminusModule và các Indicators  
└── health.spec.ts                \# Test suite kiểm thử Liveness, Readiness, Failures và Shutdown 503

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

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- MetricsModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Chỉ số Node.js Runtime (Default Metrics)** | Chỉ đo lường số lượng HTTP request mà bỏ qua tài nguyên tiến trình máy chủ, dẫn đến không phát hiện kịp thời rò rỉ bộ nhớ (Memory Leak) hay nghẽn Event Loop lag. | Thu thập tự động toàn bộ Node.js runtime metrics qua prom-client: Event Loop lag, Heap Memory allocation, Garbage Collection (GC) pauses, Process CPU usage. |
| **2\. Bùng nổ số lượng nhãn (High Cardinality Hazard)** | Gắn trực tiếp req.url động (ví dụ /bookings/123e4567-e89b...) vào nhãn metric làm Prometheus cạn kiệt RAM và treo hệ thống giám sát. | **Chuẩn hóa đường dẫn (Route Normalization):** Chỉ sử dụng route pattern của Express (req.route.path hoặc ánh xạ UUID/ID về placeholder :id) trong metric labels. |
| **3\. Đo lường phân phối độ trễ (Latency Distribution)** | Chỉ đo thời gian trung bình (Average) làm mất dấu vết các request chậm cực đoan (p95, p99 spikes). | Sử dụng **Histogram** (http\_request\_duration\_seconds) với các buckets chuẩn hóa quốc tế (5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s). |
| **4\. Bảo vệ truy cập Scraper (Bypass Auth an toàn)** | Nếu áp dụng JwtAuthGuard toàn cục, Prometheus Scraper của Kubernetes sẽ bị chặn bởi lỗi 401 Unauthorized. | Đánh dấu @Public() trên endpoint /metrics để cho phép hệ thống Prometheus nội bộ cào dữ liệu mà không cần Bearer token. |

**Cấu trúc triển khai src/infrastructure/metrics/**

src/infrastructure/metrics/  
├── metrics.constants.ts       \# Tên Metrics, Metric Buckets, Label Keys theo chuẩn OpenTelemetry  
├── services/  
│   └── metrics.service.ts     \# Khởi tạo MeterProvider, PrometheusExporter & Instruments (Counter, Histogram, UpDownCounter)  
├── interceptors/  
│   └── metrics.interceptor.ts \# Đo độ trễ nano-giây, đếm requests và chuẩn hóa route (:id)  
├── controllers/  
│   └── metrics.controller.ts  \# Endpoint /metrics phơi dữ liệu Prometheus Scraper qua OpenTelemetry Exporter  
├── metrics.module.ts          \# Module toàn cục xuất bản Metrics  
└── metrics.spec.ts            \# Test suite kiểm thử OpenTelemetry metrics

* #### **TracingModule (Truy vết phân tán \- Distributed Tracing):**

  * Công nghệ: `@opentelemetry/sdk-node`, Jaeger, Zipkin.  
  * Mục đích: Tạo Span ID cho từng chặng gọi: từ API nội bộ đến truy vấn SQL và các cuộc gọi HTTP sang bên thứ ba (Aviation, Payment). Cho phép đo chính xác từng mili-giây độ trễ phát sinh ở module nào khi xảy ra bottleneck.

### **1\. TracingModule (Truy vết phân tán \- Distributed Tracing)**

Đối chiếu trực tiếp với đặc tả kỹ thuật của **TracingModule** (thuộc Nhóm 2: Giám sát, Vận hành & Khả năng quan sát):

* **Công nghệ:** @opentelemetry/api, @opentelemetry/sdk-trace-base (hoặc @opentelemetry/sdk-node), W3C TraceContext standard (traceparent).  
* **Mục đích:** Tạo Span ID cho từng chặng gọi: từ HTTP Controller  Service nghiệp vụ  Database Query  API bên thứ ba. Cho phép đo lường độ trễ phát sinh theo từng mili-giây và liên kết hoàn hảo với traceId của RequestContextService.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- TracingModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Chuẩn hóa cấp Doanh nghiệp (Enterprise-Grade) |
| :---- | :---- | :---- |
| **1\. Đồng bộ W3C TraceContext & AsyncLocalStorage** | traceId trong RequestContextService bị tách rời khỏi W3C traceparent header, khiến hạ tầng APM (Jaeger/Tempo/Datadog) không thể map log với distributed span tree. | Tự động phân giải hoặc khởi tạo Span chuẩn OpenTelemetry, ánh xạ đồng nhất giữa spanContext().traceId và contextService.getTraceId(). |
| **2\. Khả năng bao bọc hàm khai báo (Declarative Span Decorator)** | Việc viết thủ công tracer.startActiveSpan(), span.recordException(), span.end() gây boilerplate dày đặc và dễ quên đóng span khi phát sinh Exception. | Cung cấp method decorator @TraceSpan('span\_name') tự động ghi nhận thời gian thực thi, bắt lỗi (span.setStatus({ code: SpanStatusCode.ERROR })) và đóng span an toàn. |
| **3\. Trừu tượng hóa Span Injector & Extractor** | Khi gọi API bên ngoài (Axios / mTLS) hoặc bắn message sang BullMQ, nếu không inject context vào header thì chuỗi span sẽ đứt gãy hoàn toàn. | Cung cấp TraceContextPropagator hỗ trợ inject W3C headers vào outgoing HTTP/Queue request và extract từ incoming request. |

**Cấu trúc triển khai src/infrastructure/tracing/**

src/infrastructure/tracing/  
├── tracing.constants.ts            \# Tên Tracer, W3C Header keys, Span attributes  
├── decorators/  
│   └── trace-span.decorator.ts     \# Method decorator @TraceSpan(name?)  
├── services/  
│   ├── app-tracer.service.ts       \# Service quản lý Span lifecycle, manual span creation, error logging  
│   └── trace-propagator.service.ts \# Inject/Extract W3C traceparent headers  
├── tracing.module.ts               \# Global Module  
└── tracing.spec.ts                 \# Test suite kiểm thử Span creation, error recording, W3C injection

* #### **AuditLogModule (Lưu vết thay đổi dữ liệu & Tuân thủ pháp lý):**

  * Công nghệ: TypeORM/Prisma CDC (Change Data Capture) hoặc Outbox Poller, Elasticsearch / OpenSearch, PostgreSQL Partitioning.  
  * Mục đích:  
  * **Chiều Ghi (Immutable Ingestion):** Ghi nhận bất biến toàn bộ hành vi: Ai (`actor_id`), quyền hạn lúc đó, thực hiện thao tác gì (`action`), trên đối tượng nào (`resource_id`), thời điểm nào (`timestamp`), địa chỉ IP, User-Agent, và khác biệt dữ liệu (`diff snapshot: old_val vs new_val`). Không cho phép sửa/xóa dưới mọi hình thức (WORM).  
  * **Chiều Đọc & Phân quyền truy cập (Scoped Retrieval):** Cung cấp API tra cứu log được bọc bởi chính sách phân quyền dữ liệu theo phạm vi:  
    * *Cá nhân (`audit:read:own`):* Nhân viên chỉ xem được lịch sử thao tác của chính tài khoản mình.  
    * *Trưởng bộ phận (`audit:read:department`):* Trưởng phòng chỉ xem được log hoạt động của các thành viên trực thuộc cây tổ chức (Organizational Unit) do mình quản lý.  
    * *Kiểm toán viên / Admin (`audit:read:global`):* Xem toàn bộ log hệ thống, hỗ trợ đối soát gian lận và xuất báo cáo tuân thủ pháp lý (ISO 27001, SOC2, PCI-DSS).  
  * **Lưu trữ phân tầng (Hot/Cold Tiering):** Tự động chuyển đổi log sau 90 ngày từ Hot DB sang Cold Storage (S3 Glacier) để tối ưu chi phí lưu trữ dài hạn.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- AuditLogModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Tính bất biến (WORM Enforcement)** | Lập trình viên hoặc SQL injection có thể chạy lệnh UPDATE audit\_logs hoặc DELETE FROM audit\_logs làm mất dấu vết gian lận. | Cài đặt **Database Trigger / Rule trên PostgreSQL** chặn hoàn toàn lệnh UPDATE và DELETE trên bảng audit\_logs. Ở tầng TypeORM Entity, không khai báo @UpdateDateColumn hay @DeleteDateColumn. |
| **2\. Bắt biến động dữ liệu (Deep Diff Capture)** | Chỉ lưu log thô dạng User updated booking mà không biết trường nào bị sửa đổi (ví dụ: bị sửa giá vé từ 5.000.000đ xuống 500.000đ). | Tạo hàm tính toán sai khác (calculateDiff(oldVal, newVal)), bóc tách chính xác những trường bị thay đổi theo cặp: { \[field\]: { from, to } } và tự động lọc bỏ các trường nhạy cảm (passwords, tokens). |
| **3\. Truy xuất phân quyền theo phạm vi (Scoped Query Viewer)** | API /audit-logs nếu không được bảo vệ theo scope sẽ làm lộ thông tin mật hoặc vi phạm quyền riêng tư của nhân viên. | Tích hợp trực tiếp với CASL matrix: tự động ép điều kiện SQL dựa theo quyền người gọi: actorId \= user.id (OWN), departmentId \= user.departmentId (DEPARTMENT), hoặc toàn quyền (GLOBAL). |
| **4\. Cơ chế lưu trữ phân tầng (Hot/Cold Tiering)** | Sau 1 năm, bảng audit log có thể lên đến hàng chục triệu bản ghi, làm đầy dung lượng ổ cứng SSD đắt tiền của PostgreSQL. | Cung cấp AuditTieringService định kỳ quét các bản ghi cũ hơn 90 ngày, xuất nén định dạng NDJSON gzip đẩy lên **S3 Glacier / Cold Tier**, sau đó dọn dẹp phân vùng cũ. |

**Cấu trúc triển khai src/infrastructure/audit/**

src/infrastructure/audit/  
├── entities/  
│   └── audit-log.entity.ts          \# Entity bất biến (WORM), UUID, Diff Snapshot, Actor metadata  
├── interfaces/  
│   └── audit.interface.ts           \# Types: AuditAction, AuditScope, EntityDiff, QueryFilters  
├── utils/  
│   └── diff-calculator.util.ts      \# Tính toán sai khác Old vs New snapshot, che giấu trường nhạy cảm  
├── subscribers/  
│   └── audit-entity.subscriber.ts   \# TypeORM Subscriber tự động bắt INSERT, UPDATE, SOFT\_DELETE  
├── services/  
│   ├── audit-writer.service.ts      \# Service ghi log bất biến (hỗ trợ async queue hoặc direct DB)  
│   ├── audit-viewer.service.ts      \# Service tra cứu có phân quyền Scoped Retrieval (OWN, DEPARTMENT, GLOBAL)  
│   └── audit-tiering.service.ts     \# Service quét dọn Hot/Cold storage sang S3 sau 90 ngày  
├── controllers/  
│   └── audit-viewer.controller.ts   \# API Endpoint tra cứu dành cho Admin, Lead, User  
├── audit.module.ts                  \# Module đóng gói Provider & Controller  
└── audit.spec.ts                    \# Test suite kiểm thử Ingestion, Diff, Scoped Retrieval & Tiering

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

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- CacheModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Hiện tượng Cache Stampede (Thundering Herd)** | Khi một key cache có lưu lượng truy cập cao (ví dụ: Tra cứu chuyến bay Tết HAN-SGN) hết hạn, hàng ngàn request đồng thời thấy cache trống và cùng lúc đập vào Database/GDS API bên dưới, làm tê liệt toàn bộ hệ thống. | Triển khai **Thuật toán Tải trước tối ưu xác suất (Probabilistic Early Expiration \- XFetch)** hoặc Single-Flight Lock: Chủ động làm mới cache trong nền trước khi key thực sự hết hạn dựa trên thời gian tính toán và hệ số . |
| **2\. Gắn nhãn Cache & Xóa hàng loạt (Cache Tagging / Invalidation)** | Khi cập nhật dữ liệu một khách sạn, phải xóa hàng loạt cache: trang chi tiết, danh sách tìm kiếm, trang gợi ý... Thao tác KEYS \* trong Redis làm khóa đơn luồng (Single-thread Block) của Redis trên Production. | Xây dựng hệ thống **Cache Tagging** sử dụng Redis SET để theo dõi các key thuộc cùng một Tag. Khi xóa theo Tag, dùng pipeline UNLINK (xóa bất đồng bộ, không khóa luồng). |
| **3\. Cô lập Tenant trong Cache (Multi-Tenant Cache Leaks)** | Trong hệ thống B2B SaaS, nếu không gắn namespace tenant, Tenant A có thể đọc hoặc ghi đè cấu hình, thông tin vé của Tenant B. | Tự động chèn tiền tố: cache:{tenantId}:{key} lấy động từ RequestContextService. |
| **4\. Dự phòng sự cố Redis (Redis Fault Tolerance)** | Khi cụm Redis gặp sự cố mạng (network partition) hoặc quá tải, ứng dụng không được phép crash hoặc ném lỗi 500 ra ngoài. | Cung cấp cơ chế **Fail-Open / Memory Fallback**: Khi Redis ngắt kết nối, chuyển tạm sang đọc DB trực tiếp hoặc lưu tạm trên In-Memory LRU Cache, ghi log cảnh báo nhưng không làm gián đoạn nghiệp vụ. |

**Cấu trúc triển khai src/infrastructure/cache/**

src/infrastructure/cache/

├── interfaces/

│   └── cache.interface.ts          \# Options: TTL, Tags, XFetch Params, CacheStorage

├── algorithms/

│   └── xfetch.algorithm.ts          \# Thuật toán XFetch chống Cache Stampede

├── services/

│   ├── redis-cache.service.ts       \# Core Service: Get, Set, Invalidate, InvalidateByTag

│   └── cache-tag.manager.ts         \# Quản lý ánh xạ Key \<-\> Tags qua Redis Sets

├── decorators/

│   └── cacheable.decorator.ts       \# Decorator @Cacheable({ ttl, tags, xfetch: true })

├── interceptors/

│   └── http-cache.interceptor.ts    \# Interceptor tự động cache GET response theo Route

├── cache.module.ts                  \# Module đăng ký ioredis client & providers

└── cache.spec.ts                    \# Test suite kiểm thử XFetch, Tag Invalidation, Fault Tolerance

* #### **DistributedLockModule (Khóa phân tán):**

  * Công nghệ: `redlock`, `ioredis`.  
  * Mục đích: Cung cấp cơ chế khóa tài nguyên trong môi trường nhiều instance server (multi-pod). Đảm bảo chỉ có duy nhất một tiến trình được thực thi logic quan trọng tại một thời điểm (ví dụ: giữ ghế máy bay, trừ tồn kho phòng khách sạn, chạy settlement đối soát cuối ngày).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- DistributedLockModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Tránh giải phóng khóa nhầm (Unsafe Release Race Condition)** | Pod A giữ lock nhưng xử lý quá hạn TTL. Lock tự nhả và được cấp cho Pod B. Khi Pod A chạy xong, nếu gọi DEL key đơn thuần, Pod A sẽ vô tình xóa lock mà Pod B đang sở hữu, dẫn tới vi phạm tính toàn vẹn (Mutual Exclusion Failure). | Sử dụng **giá trị ngẫu nhiên bất biến (Fencing Token / Random UUID Value)** cho mỗi lần xin lock kết hợp **Lua Script nguyên tử**: chỉ xóa key nếu giá trị lưu trong Redis trùng khớp với token của phiên làm việc hiện tại. |
| **2\. Tự động gia hạn khóa (Lock Heartbeat / Auto-Extension)** | Khi xử lý tác vụ phân tán nặng (như đối soát settlement cuối ngày hoặc tích hợp thanh toán ngân hàng chậm), tác vụ có thể kéo dài vượt quá TTL ban đầu của lock. | Cung cấp cơ chế **Watchdog Heartbeat** ngầm: tự động gia hạn TTL định kỳ (khi đã trôi qua 50% thời hạn) chừng nào tác vụ vẫn còn đang thực thi. |
| **3\. Trải nghiệm phát triển (Method Decorator)** | Việc viết thủ công acquireLock(), bọc try / finally, và releaseLock() ở từng Service gây phân mảnh mã nguồn, dễ quên giải phóng lock khi xảy ra lỗi. | Cung cấp method decorator @DistributedLock('flight:seat:\#seatNumber') hỗ trợ bóc tách tham số động từ arguments (SpEL / Template expression). |
| **4\. Ngăn chặn Deadlock khi lỗi kết nối mạng (Retry với Full Jitter)** | Khi hàng chục luồng cùng xin lock cho cùng một ghế máy bay, việc thử lại đồng thời khiến Redis bị dội tải (Thundering Herd). | Thuật toán retry với **Exponential Backoff và Full Jitter**: phân tán thời gian thử lại ngẫu nhiên trong khoảng cấu hình cho phép. |

**Cấu trúc triển khai src/infrastructure/lock/**

src/infrastructure/lock/  
├── interfaces/  
│   └── lock.interface.ts            \# LockOptions, LockHandle contract  
├── scripts/  
│   └── lua-scripts.ts               \# Lua Script nguyên tử (Safe Release & Safe Extend)  
├── services/  
│   └── distributed-lock.service.ts  \# Service lõi: acquire, release, runWithLock, watchdog  
├── decorators/  
│   └── distributed-lock.decorator.ts \# Decorator @DistributedLock() cho Service methods  
├── lock.module.ts                   \# Module đăng ký Redlock / ioredis client  
└── lock.spec.ts                     \# Test suite kiểm thử Mutual Exclusion, Safe Release, Watchdog

* #### **OutboxModule (Bảo đảm toàn vẹn thông điệp phân tán):**

  * Công nghệ: Transactional Outbox Pattern \+ Prisma/TypeORM.  
  * Mục đích: Lưu trữ các sự kiện cần gửi đi (Domain Events) vào chung một database transaction của nghiệp vụ chính. Một background poller sẽ quét bảng outbox để đẩy sang Message Queue, đảm bảo không bao giờ xảy ra tình trạng "ghi DB thành công nhưng publish message thất bại" (At-least-once delivery).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- OutboxModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Tính nguyên tử (Dual-Write Problem)** | Gọi broker.emit() ngay sau repo.save(entity). Nếu mạng chập chờn hoặc Broker sập đúng thời điểm đó, dữ liệu đã lưu vào DB nhưng sự kiện bị mất vĩnh viễn (Inconsistent State). | **Transactional Outbox:** Bắt buộc ghi bản ghi sự kiện vào bảng outbox\_events bên trong **cùng một ACID Transaction** (EntityManager / QueryRunner) với thực thể nghiệp vụ. |
| **2\. Xung đột đồng thời khi Scale nhiều Pod (Worker Collision)** | Khi chạy 10 Pods NestJS, các tiến trình Poller đồng thời quét bảng Outbox sẽ đọc trùng một tập bản ghi, dẫn đến việc publish sự kiện lặp lại hàng loạt lần. | Sử dụng câu lệnh khóa bi quan của PostgreSQL: **FOR UPDATE SKIP LOCKED**. Các Pod tự động bỏ qua các dòng đang bị Pod khác xử lý, triệt tiêu tranh chấp và cho phép mở rộng tải xử lý song song (Horizontal Scalability). |
| **3\. Phục hồi sự cố & Exponential Backoff** | Khi downstream Message Queue (BullMQ/Kafka) quá tải, poller liên tục retry dồn dập khiến server cạn kiệt CPU. | Thiết lập lịch trình lũy thừa: nextRetryAt \= NOW() \+ delay \* (2 ^ retryCount). Nếu chạm ngưỡng maxRetries (ví dụ: 5 lần), chuyển trạng thái sang DEAD\_LETTER và kích hoạt cảnh báo giám sát. |
| **4\. Lan truyền ngữ cảnh truy vết (Trace Preservation)** | Khi sự kiện được đọc ra từ Outbox để bắn sang Queue, nếu không lưu metadata ngữ cảnh, Worker phía sau sẽ mất toàn bộ traceId, tenantId, actorId. | Lưu trực tiếp traceId, tenantId, actorId vào các cột của bảng outbox\_events. |
| **5\. Dọn dẹp dữ liệu lịch sử (Outbox Pruning)** | Bảng Outbox tích tụ hàng triệu bản ghi đã gửi thành công sau vài tuần, gây chậm chỉ mục index và tốn dung lượng lưu trữ. | Cung cấp task định kỳ dọn dẹp (Hard delete hoặc đẩy sang Cold Tier) các sự kiện có trạng thái PUBLISHED cũ hơn 7 ngày. |

**Cấu trúc triển khai src/infrastructure/outbox/**

src/infrastructure/outbox/  
├── outbox.constants.ts          \# Event status enum, batch size, poll interval, max retries  
├── entities/  
│   └── outbox-event.entity.ts   \# Entity outbox\_events (UUID, aggregateId, eventType, payload, status, retryCount, traceId, tenantId)  
├── interfaces/  
│   └── outbox.interface.ts      \# OutboxEventStatus, CreateOutboxEventDto, OutboxRelayHandler  
├── services/  
│   ├── outbox.service.ts        \# Service lưu event vào cùng transaction của nghiệp vụ chính  
│   ├── outbox-poller.service.ts \# Polling background task với FOR UPDATE SKIP LOCKED  
│   └── outbox-cleaner.service.ts\# Cron task dọn dẹp các processed event cũ  
├── outbox.module.ts             \# Module xuất bản OutboxService & background poller  
└── outbox.spec.ts               \# Test suite kiểm thử Transactional persistence, Poller SKIP LOCKED, Retry & DLQ

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

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- HttpClientModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Lan truyền Trace Context (Header Propagation)** | Khi NestJS gọi sang API đối tác (Sabre, Vietjet, VNPay), nếu không gửi kèm x-trace-id, chuỗi truy vết phân tán sẽ bị đứt gãy. | Axios Request Interceptor tự động lấy traceId, tenantId, userId từ RequestContextService và gán vào header gọi đi. |
| **2\. Xác thực chứng chỉ hai chiều (Centralized mTLS)** | Các đối tác hàng không (GDS) và Ngân hàng yêu cầu kết nối bảo mật mTLS (Mutual TLS: client cert \+ key \+ CA). Cấu hình rải rác dễ lộ cert hoặc sai lệch TLS socket. | Cung cấp MtlsAgentFactory tạo https.Agent chuyên dụng nạp chứng chỉ an toàn từ cấu hình/file hệ thống (cert, key, ca). |
| **3\. Centralized Retry & Exponential Backoff** | Lỗi mạng tạm thời (chớp nhoáng / 502 / 503 / 504\) làm fail giao dịch nếu không có cơ chế retry tự động với Full Jitter. | Tích hợp thuật toán thử lại có giãn cách ngẫu nhiên (Exponential Backoff \+ Jitter) cho các HTTP status code có thể phục hồi (Idempotent requests, 502, 503, 504, ECONNRESET). |
| **4\. Che giấu PII khi ghi log Request/Response** | URL, Request Body hoặc Response Body trả về từ cổng thanh toán/GDS chứa số thẻ tín dụng, CVV, mật khẩu. In log thô sẽ vi phạm PCI-DSS. | Sử dụng AppLoggerService kết hợp hàm Masking chuyên sâu: tự động che giấu các trường nhạy cảm trước khi xuất log. |

**Cấu trúc triển khai src/infrastructure/http/**

src/infrastructure/http/  
├── interfaces/  
│   └── http-client.interface.ts     \# Request options, mTLS credentials, Retry config  
├── security/  
│   └── mtls-agent.factory.ts        \# Tạo https.Agent bảo mật mTLS (CA, Cert, Key)  
├── interceptors/  
│   ├── trace-propagation.interceptor.ts \# Lan truyền x-trace-id, x-tenant-id tự động  
│   └── http-logger.interceptor.ts   \# Ghi log Request/Response che giấu dữ liệu PI  
├── client/  
│   └── app-http.client.ts           \# Wrapper Service chuẩn Enterprise thay thế trực tiếp Axios  
├── http.module.ts                   \# Đăng ký HttpClientModule  
└── http.spec.ts                     \# Test suite kiểm thử Trace propagation, Retry, Masking

* #### **WebhookModule (Quản trị Webhook hai chiều):**

  * Công nghệ: `crypto` (HMAC SHA-256), Queue-backed Webhook Dispatcher.  
  * Mục đích: Quản lý nhận và phát webhook an toàn: xác thực tính toàn vẹn payload gửi đến qua chữ ký số, đồng thời đảm bảo webhook hệ thống phát ra cho đối tác được thử lại định kỳ theo lịch trình nếu đối tác tạm thời mất kết nối.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- WebhookModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Toàn vẹn dữ liệu & Chống giả mạo (HMAC Signature)** | Kẻ tấn công có thể giả lập cuộc gọi Webhook thanh toán thành công (Fake Payment Ingress) vào endpoint máy chủ nếu không có cơ chế ký số. | Sử dụng **HMAC SHA-256** tạo chữ ký số trên payload kết hợp so khớp an toàn với **crypto.timingSafeEqual** để triệt tiêu lỗ hổng Timing Attack. |
| **2\. Chống tấn công phát lại (Replay Attack Defense)** | Hacker bắt gói tin Webhook hợp lệ và gửi lại (Replay) nhiều lần để kích hoạt xuất vé hoặc nạp tiền lặp lại. | Bắt buộc gửi kèm header thời gian (X-Webhook-Timestamp), kiểm tra độ lệch thời gian (Tolerance Window, mặc định tối đa 300s/5 phút), từ chối ngay lập tức nếu timestamp quá hạn. |
| **3\. Dispatcher hai chiều có thử lại (Reliable Egress Dispatch)** | Khi hệ thống bắn webhook thông báo trạng thái đơn hàng cho đối tác B2B, nếu server đối tác bị 500/503 hoặc timeout, webhook sẽ bị mất vĩnh viễn. | Xây dựng **WebhookDispatcherService** tích hợp AppHttpClient với chính sách Exponential Backoff Retry và chuyển trạng thái thất bại vào queue/log để đối soát. |
| **4\. Ingress Guard linh hoạt (Multi-Provider Ingress Support)** | Mỗi đối tác (Stripe, VNPay, GDS, Zalo) có quy chuẩn header chữ ký khác nhau (X-Signature, X-Hub-Signature-256, X-Signature-SHA256). | Cung cấp **WebhookSignatureGuard** và decorator **@VerifyWebhookSignature()** hỗ trợ cấu hình động header name và secret resolver theo từng nhà cung cấp. |

**Cấu trúc triển khai src/infrastructure/webhook/**

src/infrastructure/webhook/  
├── webhook.constants.ts            \# Tên headers, thuật toán mã hóa, tolerance window  
├── interfaces/  
│   └── webhook.interface.ts        \# Dispatch options, Ingress verification types  
├── security/  
│   └── webhook-signer.ts           \# Tiện ích sinh HMAC và so khớp timing-safe  
├── decorators/  
│   └── webhook-verifier.decorator.ts \# Decorator cấu hình xác thực Webhook cho route  
├── guards/  
│   └── webhook-signature.guard.ts  \# Guard tự động xác minh chữ ký & timestamp của Ingress  
├── services/  
│   └── webhook-dispatcher.service.ts \# Dịch vụ ký số và phát Webhook ra bên ngoài (Egress)  
├── webhook.module.ts               \# Module xuất bản tính năng Webhook hai chiều  
└── webhook.spec.ts                 \# Test suite kiểm thử Signer, Replay Defense, Guard & Dispatcher

### **6\. Nhóm Tác vụ nền, Giao tiếp không đồng bộ & Thời gian thực (Asynchronous, Messaging & Realtime)**

* #### **QueueModule (Hàng đợi tác vụ nền & Dead-Letter Queue):**

  * Công nghệ: `@nestjs/bullmq`, `bullmq`, Redis.  
  * Mục đích: Tách các tác vụ nặng ra khỏi chu kỳ Request-Response của người dùng: xuất báo cáo Excel, gọi API kích hoạt vé, đồng bộ dữ liệu. Tích hợp sẵn cơ chế Exponential Backoff Retry và luân chuyển job lỗi sang Dead-Letter Queue (DLQ) để dev phân tích nguyên nhân.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- QueueModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Mất dấu vết phân tán trong Worker (Trace Context Loss)** | Worker BullMQ chạy trong tiến trình nền không có HTTP request context. Khi xảy ra lỗi hoặc in log trong worker, toàn bộ traceId, tenantId, userId bị mất sạch (undefined), khiến DevOps không thể liên kết job lỗi với request ban đầu của khách hàng. | Bắt buộc bọc job payload với **Metadata Envelope** (traceId, tenantId, actorId, enqueuedAt). Trong WorkerHost, sử dụng RequestContextService.runWithContext() để khôi phục hoàn chỉnh thread-local context trước khi gọi hàm nghiệp vụ. |
| **2\. Dead-Letter Queue (DLQ) tự động hóa** | Khi một job vượt quá số lần retry (ví dụ: thất bại 5 lần), mặc định BullMQ chỉ chuyển job sang trạng thái failed trong cùng queue, dễ bị trôi mất hoặc bị xóa tự động bởi cấu hình removeOnFail. | Triển khai **DLQ Event Listener**: Khi sự kiện failed kích hoạt và attemptsMade \>= attempts, tự động chuyển toàn bộ payload, stack trace, metadata và lý do lỗi sang một Queue riêng biệt (\<queueName\>-dlq) để phục vụ lưu trữ phân tích hoặc hỗ trợ retry thủ công. |
| **3\. Ngắt kết nối sạch khi Kubernetes Scale-in (Graceful Shutdown)** | Khi Pod nhận SIGTERM, nếu ngắt tiến trình đột ngột, các worker đang xử lý dở dang (ví dụ: đang gọi API xuất vé hoặc trừ tiền) sẽ bị đứt ngang, làm hỏng trạng thái job hoặc bị kẹt lock. | Đăng ký hook vào **ShutdownRegistry (Pha 2: PAUSE\_CONSUMERS)**: Khi nhận SIGTERM, worker lập tức gọi worker.pause() để ngừng nhận job mới và đợi các job đang chạy hoàn tất trước khi đóng connection pool. |
| **4\. Exponential Backoff kèm Full Jitter** | Nếu các job cùng retry sau đúng khoảng thời gian cố định (ví dụ: đúng 5s sau khi API đối tác bị 503), hàng loạt job sẽ dội tải đồng thời vào hệ thống đối tác (Thundering Herd). | Thiết lập chiến lược backoff cấp queue dạng exponential với độ trễ cơ sở được cấu hình chuẩn cho từng loại hàng đợi. |

**Cấu trúc triển khai src/infrastructure/queue/**

src/infrastructure/queue/  
├── constants/  
│   └── queue.constant.ts           \# Tên danh mục Queues, DLQ Suffixes, Default Options  
├── interfaces/  
│   └── queue.interface.ts          \# Envelope Job Data (Payload \+ Trace \+ Tenant Metadata)  
├── producers/  
│   └── base-queue.producer.ts      \# Producer cơ sở tự động nhúng Context hiện tại vào Job  
├── consumers/  
│   ├── base-queue.worker.ts        \# WorkerHost cơ sở tự động phục hồi AsyncLocalStorage Context  
│   └── dlq-monitor.service.ts      \# Dịch vụ tự động luân chuyển Job kiệt sức retry sang DLQ  
├── queue.module.ts                 \# Đăng ký BullMQModule và tích hợp Graceful Shutdown Hook  
└── queue.spec.ts                   \# Test suite kiểm thử Trace restoration, Retry và DLQ dispatch

* #### **ScheduleModule (Lập lịch tác vụ phân tán):**

  * Công nghệ: `@nestjs/schedule` kết hợp Redis Redlock / ShedLock.  
  * Mục đích: Quản lý các cron jobs định kỳ (quét đơn quá hạn giữ chỗ, tính toán doanh thu ngày, gửi email nhắc lịch). Đảm bảo khi scale chạy 10 pods NestJS thì cron job chỉ được thực thi bởi duy nhất 1 pod.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- ScheduleModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Tranh chấp chạy trùng Multi-Pod (Cron Storm Collision)** \[cite: 1\] | 10 Pods K8s chạy đồng thời cron @Cron('0 0 \* \* \*'). Cả 10 máy cùng quét cơ sở dữ liệu để hủy vé hoặc trừ tiền, dẫn đến Race Condition và khóa chết Database\[cite: 1\]. | Cung cấp method decorator **@DistributedCron(cronTime, lockKey, { ttlMs })**: Sử dụng DistributedLockService xin lock phân tán qua Redis. Chỉ Pod nào xin được khóa mới thực thi tác vụ; 9 Pod còn lại tự động bỏ qua an toàn\[cite: 1\]. |
| **2\. Thiếu ngữ cảnh thực thi (Cron Context Gap)** | Cron job kích hoạt tự động theo timer tiến trình, hoàn toàn không có HTTP request. Các truy vấn TypeORM, RLS hay lệnh in log sẽ bị undefined đối với traceId và userId. | Tự động sinh traceId: cron:\<jobName\>:\<timestamp\> và bọc luồng trong RequestContextService.runWithContext() trước khi chạy thân hàm cron. |
| **3\. Lệch đồng hồ máy chủ (Clock Drift Protection)** | Khi Pod 1 hoàn thành cron sau 200ms và giải phóng khóa ngay lập tức, Pod 2 bị lệch đồng hồ 500ms có thể thấy khóa trống và kích hoạt chạy lại lần thứ 2\. | Không giải phóng khóa ngay khi cron chạy quá nhanh; duy trì khóa tối thiểu (Minimum Lock Retention) tương ứng với chu kỳ chạy của cron để chặn tái kích hoạt do lệch giờ máy chủ. |

**Cấu trúc triển khai src/infrastructure/schedule/**

src/infrastructure/schedule/  
├── decorators/  
│   └── distributed-cron.decorator.ts \# Decorator @DistributedCron bọc Redlock và Context  
├── schedule.module.ts                \# Global Module đăng ký NestJS Schedule  
└── schedule.spec.ts                  \# Test suite kiểm thử chống chạy trùng multi-pod

* #### **NotificationModule (Cổng thông báo đa kênh):**

  * Công nghệ: Nodemailer, AWS SES, Twilio, Firebase Admin (FCM), Telegram SDK.  
  * Mục đích: Trừu tượng hóa việc gửi thông báo. Nhận yêu cầu gửi theo template (Handlebars/EJS) và tự động định tuyến: gửi OTP qua SMS, gửi E-ticket qua Email, bắn thông báo trạng thái đơn hàng qua Mobile Push Notification hoặc Webhook về Slack/Telegram nội bộ.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- NotificationModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Trừu tượng hóa Đa kênh (Multi-Channel Dispatcher Pattern)** | Các service nghiệp vụ (Booking, Payment, Auth) tự gọi trực tiếp Nodemailer hay Axios tới Telegram/Twilio, gây phân mảnh mã nguồn và khó khăn khi thay đổi nhà cung cấp (Vendor Lock-in). | Cung cấp interface thống nhất NotificationChannelAdapter cho từng kênh (EMAIL, SMS, TELEGRAM, PUSH). Một NotificationDispatcherService trung tâm sẽ nhận một yêu cầu và tự động phân luồng tới nhiều kênh đồng thời. |
| **2\. Biên dịch mẫu động (Secure Template Rendering)** | Việc ghép chuỗi HTML/Text thủ công dễ bị tấn công HTML/Script Injection khi render dữ liệu từ người dùng (ví dụ: tên hành khách chứa thẻ \<script\>). | Triển khai TemplateRendererService hỗ trợ placeholder động ({{user.name}}), tự động escape các ký tự nguy hiểm để ngăn ngừa tiêm nhiễm mã độc vào email/tin nhắn. |
| **3\. Cô lập lỗi kênh truyền (Channel Failure Isolation)** | Khi gửi đồng thời Email và Telegram, nếu Telegram Bot API bị timeout, toàn bộ tiến trình không được phép văng Exception làm đứt việc gửi Email cho khách hàng. | Thực thi các kênh theo mô hình độc lập (Concurrent Settled Execution \- Promise.allSettled), tổng hợp kết quả chi tiết từng kênh (\`status: SUCCESS |
| **4\. Che giấu thông tin định danh (PII Masking in Logs)** | Log quá trình gửi tin vô tình in nguyên bản số điện thoại, địa chỉ email, mã OTP hoặc số thẻ của người nhận lên ELK/Loki, vi phạm chuẩn bảo mật PCI-DSS/GDPR. | Tự động che giấu (masking) thông tin người nhận trong log (ví dụ: 098\*\*\*321, a\*\*\*e@gmail.com). |

**Cấu trúc triển khai src/infrastructure/notification/**

src/infrastructure/notification/  
├── interfaces/  
│   └── notification.interface.ts       \# Enums (EMAIL, SMS, TELEGRAM), Recipient, Payload, DispatchResult  
├── templates/  
│   └── template-renderer.service.ts    \# Biên dịch template an toàn (HTML escaping, nested variable lookup)  
├── channels/  
│   ├── notification-channel.interface.ts \# Interface chuẩn hóa cho các Channel Adapters  
│   ├── email.channel.ts                \# Adapter gửi Email (Nodemailer / AWS SES)  
│   ├── sms.channel.ts                  \# Adapter gửi SMS OTP (Twilio / SMS Gateway)  
│   └── telegram.channel.ts             \# Adapter gửi Alert / Chat qua Telegram Bot API  
├── services/  
│   └── notification-dispatcher.service.ts \# Điều phối đa kênh, tích hợp Context & Che giấu PII  
├── notification.module.ts              \# Module đăng ký các kênh và Provider toàn cục  
└── notification.spec.ts                \# Test suite kiểm thử Template engine, Routing và Isolated Failure

* #### **EventEmitterModule / DomainEventModule (Tách rời logic bằng sự kiện nội bộ):**

  * Công nghệ: `@nestjs/event-emitter`.  
  * Mục đích: Triển khai kiến trúc Event-Driven bên trong ứng dụng (In-process). Khi module Booking tạo vé thành công, nó chỉ việc phát ra sự kiện booking.created. Các module Analytics, Notification, LoyaltyPoint sẽ tự lắng nghe và xử lý độc lập mà không bị dính chặt mã nguồn (tight coupling).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- DomainEventModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Bảo toàn ngữ cảnh truy vết (Trace & Tenant Preservation)** | Khi phát sự kiện bất đồng bộ qua emitAsync(), luồng xử lý của Listener có thể bị tách rời khỏi AsyncLocalStorage, làm mất traceId, tenantId và actorId trong log của listener. | Chuẩn hóa mọi sự kiện kế thừa từ **BaseDomainEvent** (tự động nhúng traceId, tenantId, actorId, occurredAt). Listener bọc thực thi trong RequestContextService.runWithContext(). |
| **2\. Cô lập lỗi giữa các Listeners (Listener Failure Isolation)** | Mặc định nếu một listener ném ngoại lệ (ví dụ: Analytics DB bị lỗi), phương thức emitAsync() sẽ ném Exception ra ngoài làm đứt ngang các listener còn lại (ví dụ: không gửi được email thông báo vé). | Cung cấp **AppEventPublisher** thực thi an toàn bằng Promise.allSettled: Ghi log lỗi của listener bị hỏng nhưng vẫn đảm bảo tất cả listener khác được thực thi trọn vẹn. |
| **3\. Định danh sự kiện chuẩn kiểu tĩnh (Type-Safe Event Mapping)** | Dùng chuỗi string phân mảnh ('order-created', 'OrderCreated') dễ gây lỗi chính tả dẫn đến listener không bao giờ được kích hoạt. | Khai báo hằng số danh mục sự kiện và ràng buộc chặt chẽ kiểu payload tương ứng của từng Event Class. |

**Cấu trúc triển khai src/infrastructure/events/**

src/infrastructure/events/  
├── constants/  
│   └── event.constants.ts          \# Tên các Domain Events chuẩn hóa  
├── bases/  
│   └── base-domain.event.ts        \# Lớp cơ sở tự động mang metadata phân tán  
├── services/  
│   └── app-event-publisher.service.ts \# Publisher bọc Promise.allSettled và Trace preservation  
├── events.module.ts                \# Global Module đăng ký EventEmitterModule  
└── events.spec.ts                  \# Test suite kiểm thử Trace propagation và Error isolation

* #### **WebSocketModule / RealtimeModule (Giao tiếp thời gian thực):**

  * Công nghệ: `@nestjs/websockets`, `@nestjs/platform-socket.io`, Redis Adapter.  
  * Mục đích: Duy trì kết nối song công với client qua Socket.io. Cấu hình Redis Pub/Sub Adapter để đồng bộ kết nối giữa các cụm server, phục vụ việc bắn thông báo tức thì, cập nhật biến động giá vé hoặc luồng duyệt đơn hàng theo thời gian thực.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- WebSocketModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Đồng bộ Multi-Pod (Cluster Synchronization)** | Khi chạy 5 Pods trên Kubernetes, Client A kết nối Pod 1, Client B kết nối Pod 2\. Lệnh server.to('room').emit() mặc định chỉ bắn cho client trong cùng 1 Node.js process. | Cấu hình **RedisIoAdapter (@socket.io/redis-adapter)**: Mọi lệnh phát tin nhắn đều qua Redis Pub/Sub để phát tán đồng nhất đến toàn bộ các Pods. |
| **2\. Xác thực Token lúc Handshake (WS Authentication Guard)** | JwtAuthGuard của HTTP Controller không bắt được kết nối WebSocket lúc bắt tay (Handshake), dẫn đến nguy cơ ai cũng mở được Socket kết nối vào máy chủ. | Triển khai **WsJwtGuard**: Trích xuất Bearer token từ handshake.auth.token hoặc handshake.headers.authorization, xác thực JWT và gán user context vào socket.data.user. |
| **3\. Cô lập kênh theo Tenant & User (Room Isolation)** | Client có thể nghe trộm biến động giá hoặc thông tin đặt chỗ của khách hàng / đối tác khác. | Tự động phân tách phòng cách ly: Khi kết nối thành công, tự động socket.join(\\tenant:\${tenantId}\\\`)\` và \`socket.join(\\\`user:\${userId}\`)\`. |
| **4\. Ngắt kết nối có kiểm soát khi Scale-in (Graceful Teardown)** | Pod K8s bị kill đột ngột khiến client tưởng mất mạng bất thường và liên tục thử kết nối lại cùng lúc (Thundering Herd). | Đăng ký hook vào GracefulShutdownService: Khi nhận SIGTERM, server chủ động gửi thông điệp reconnect\_please rồi đóng socket sạch sẽ. |

**Cấu trúc triển khai src/infrastructure/websocket/**

src/infrastructure/websocket/  
├── adapters/  
│   └── redis-io.adapter.ts          \# Custom Socket.io Adapter tích hợp Redis Pub/Sub  
├── guards/  
│   └── ws-jwt.guard.ts              \# Guard xác thực danh tính JWT qua WebSocket Handshake  
├── services/  
│   └── realtime-emitter.service.ts  \# Service nghiệp vụ gửi tin nhắn tới Tenant/User/Room  
├── gateways/  
│   └── app-events.gateway.ts        \# Gateway chính xử lý kết nối, phân phòng và ngắt kết nối  
├── websocket.module.ts              \# Global Module  
└── websocket.spec.ts                \# Test suite kiểm thử WsJwtGuard và Room Routing

### **7\. Nhóm Lưu trữ, Tài liệu & Xuất nhập dữ liệu (Storage & Document Processing)**

* #### **StorageModule (Trừu tượng hóa lưu trữ đối tượng \- Object Storage):**

  * Công nghệ: `@aws-sdk/client-s3`, MinIO Client.  
  * Mục đích: Cung cấp interface lưu file thống nhất. Xử lý logic tạo Presigned URL cho client upload trực tiếp lên S3/GCS (giảm tải băng thông cho server NestJS), quản lý phân quyền file (Public/Private), tự động tối ưu hóa kích thước ảnh và dọn dẹp file tạm.

Đối chiếu trực tiếp với đặc tả kỹ thuật của **StorageModule** trong tài liệu kiến trúc (thuộc Nhóm 7: Lưu trữ, Tài liệu & Xuất nhập dữ liệu):

Đặc tả yêu cầu:

* **Công nghệ:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, MinIO Client.  
* **Mục đích:** Cung cấp interface lưu file thống nhất. Xử lý logic tạo Presigned URL cho client upload trực tiếp lên S3/GCS (giảm tải băng thông và RAM cho server NestJS), quản lý phân quyền file (Public/Private), tự động cô lập file theo Tenant, và dọn dẹp file tạm.

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- StorageModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Giải pháp chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. Tải trực tiếp qua Presigned URL (Zero-Proxy Upload)** | Cho client upload file (ảnh vé, PDF hợp đồng, tài liệu định danh) truyền qua server NestJS sẽ gây nghẽn băng thông mạng, tràn bộ nhớ RAM (OOM) và làm tắc nghẽn Event Loop khi nhiều người cùng tải lên đồng thời. | Cung cấp phương thức **generatePresignedUploadUrl()**: Tạo URL có chữ ký số (AWS Signature v4) và thời hạn ngắn (ví dụ: 15 phút) để Client đẩy trực tiếp lên AWS S3 / MinIO mà không đi qua máy chủ ứng dụng. |
| **2\. Phân quyền tệp tin (Public vs Private Access)** | Lưu nhầm tài liệu cá nhân nhạy cảm (hộ chiếu, CMND, sao kê) vào bucket public khiến ai có link cũng tải được, vi phạm nghiêm trọng luật GDPR và bảo mật thông tin PII. | Phân lập rõ 2 phân vùng: **PUBLIC** (tự động trả về CDN/Direct URL) và **PRIVATE** (bảo vệ tuyệt đối, bắt buộc tạo Presigned Download URL có thời hạn tối đa 5–15 phút kèm kiểm tra quyền hạn). |
| **3\. Cô lập dữ liệu tệp tin theo Tenant (Multi-Tenant Path Isolation)** | File upload của các doanh nghiệp lưu chung một thư mục gốc dễ dẫn đến việc ghi đè (overwrite) hoặc quét file chéo giữa các bên. | Chuẩn hóa quy tắc đặt khóa đối tượng (Object Key): tenants/{tenantId}/{visibility}/{category}/{YYYY}/{MM}/{uuid}\_{sanitizedName} kết hợp context từ RequestContextService. |
| **4\. Phòng chống Path Traversal & Tệp tin độc hại** | Người dùng gửi fileName chứa ký tự nguy hiểm (../../etc/passwd hoặc .php/.exe) để tấn công khai thác máy chủ hoặc S3 bucket. | Bộ lọc làm sạch tên tệp (sanitizeFileName): Loại bỏ đường dẫn tương đối, ép đuôi file hợp lệ, băm UUID chống trùng lặp, và kiểm tra Content-Type whitelist. |
| **5\. Tính tương thích môi trường (AWS S3 & Local MinIO)** | Môi trường Dev/Staging thường dùng MinIO (yêu cầu forcePathStyle: true, endpoint custom), trong khi Production dùng AWS S3 chuẩn. | Trừu tượng hóa S3 Client Factory: Tự động cấu hình endpoint, forcePathStyle, và region tương thích hoàn toàn giữa AWS S3 và MinIO. |

**Cấu trúc triển khai src/infrastructure/storage/**

src/infrastructure/storage/  
├── interfaces/  
│   └── storage.interface.ts          \# StorageVisibility, PresignedUrlOptions, UploadResult  
├── utils/  
│   └── file-sanitizer.util.ts        \# Làm sạch tên file, Path Traversal defense, Object Key builder  
├── services/  
│   ├── s3-storage.service.ts         \# Service lõi: Presigned Put/Get, Upload buffer, Delete, Check exist  
│   └── storage-url.signer.ts         \# Tiện ích sinh Signed URL cho Private Assets  
├── storage.module.ts                 \# Đăng ký S3Client Provider (AWS S3 / MinIO)  
└── storage.spec.ts                   \# Test suite kiểm thử Presigned URL, Path Isolation & Sanitization

* #### **DocumentReportModule (Bộ kết xuất chứng từ & PDF):**

  * Công nghệ: `puppeteer`, `pdfkit`, `exceljs`.  
  * Mục đích: Biên dịch file HTML/CSS template thành PDF độ phân giải cao phục vụ xuất vé điện tử, hợp đồng du lịch, hóa đơn VAT. Hỗ trợ cơ chế Streaming để đọc và xuất các file Excel đối soát hàng trăm ngàn dòng mà không làm tràn bộ nhớ (Out-of-Memory).

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- DocumentReportModule)**

| Tiêu chuẩn kỹ thuật | Rủi ro / Điểm nghẽn thực tế | Chuẩn hóa cấp Doanh nghiệp (Enterprise-Grade) |
| :---- | :---- | :---- |
| **1\. Tràn bộ nhớ khi xuất Excel lớn (OOM Hazard)** | Dùng new ExcelJS.Workbook() và nạp toàn bộ 200,000 dòng dữ liệu vào RAM cùng lúc gây crash Node.js process bằng mã lỗi JavaScript heap out of memory. | Sử dụng **ExcelJS.stream.xlsx.WorkbookWriter**: Ghi trực tiếp theo từng row xuống Write Stream (HTTP response stream hoặc temporary disk file), giữ mức sử dụng RAM cố định (\< 60MB). |
| **2\. Biên dịch PDF vé & hóa đơn điện tử** | Ghép nối canvas/HTML không chuẩn gây vỡ layout và lỗi font Unicode tiếng Việt khi in chứng từ. | Triển khai PdfDocumentService bọc pdfkit với cấu hình font Unicode nhúng sẵn, bố cục hóa đơn tabular rõ ràng, tạo PDF dạng stream đẩy thẳng lên S3 hoặc client download. |
| **3\. Tích hợp trực tiếp với StorageModule** | Tạo file xong lưu vào local disk của Pod K8s gây cạn disk (disk full) và mất file khi Pod restart. | Tự động stream kết quả lên S3StorageService để nhận Presigned URL có thời hạn, tránh lưu file rác trên container filesystem. |

**Cấu trúc triển khai src/infrastructure/document/**

src/infrastructure/document/  
├── interfaces/  
│   └── document.interface.ts          \# Invoice/Ticket PDF data structure, Excel Column definition  
├── services/  
│   ├── excel-stream.service.ts        \# Service streaming hàng trăm ngàn dòng Excel qua WorkbookWriter  
│   └── pdf-generator.service.ts       \# Service xuất vé & hóa đơn VAT dạng PDF stream  
├── document-report.module.ts          \# Global Module  
└── document-report.spec.ts            \# Test suite kiểm thử Streaming Excel và PDF rendering

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

#### **Common Decorators**

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- Decorators)**

| Decorator | Mục đích & Nghiệp vụ | Khoảng trống & Điểm cần chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. @CurrentUser()** | Trích xuất thông tin người dùng đã xác thực | Trích xuất an toàn từ request.user hoặc fallback về RequestContextService. Hỗ trợ truyền thuộc tính con: @CurrentUser('id'), @CurrentUser('tenantId'), @CurrentUser('roles'). |
| **2\. @Roles()** | Đánh dấu vai trò yêu cầu của endpoint | Tạo metadata array để kết hợp cùng RolesGuard / RBAC kiểm tra quyền hạn của người dùng. |
| **3\. @IdempotencyKey()** | Trích xuất giá trị key chống trùng lặp | Parameter Decorator trích xuất trực tiếp chuỗi key từ header Idempotency-Key (dùng khi controller cần log hoặc lưu khóa nghiệp vụ). |
| **4\. @CurrentTenant()** | Trích xuất mã định danh Tenant | Parameter Decorator lấy nhanh tenantId đã qua middleware xác thực phục vụ kiểm tra cách ly dữ liệu. |
| **5\. @TraceId()** | Trích xuất Correlation / Trace ID | Trích xuất Trace ID từ Request Headers hoặc RequestContextService mà không cần inject service. |
| **6\. @Public()** | Bỏ qua cơ chế kiểm tra Authentication Guard | Đánh dấu endpoint công khai (Login, Register, Health probe) không yêu cầu JWT Bearer Token. |

**Cấu trúc triển khai src/common/decorators/**

src/common/decorators/  
├── current-user.decorator.ts      \# @CurrentUser(prop?) trích xuất User Context  
├── current-tenant.decorator.ts    \# @CurrentTenant() trích xuất Tenant ID  
├── trace-id.decorator.ts          \# @TraceId() trích xuất Trace / Correlation ID  
├── idempotency-key.decorator.ts   \# @IdempotencyKey() trích xuất header idempotency-key  
├── roles.decorator.ts             \# @Roles(...roles) gán Metadata Role cho RBAC  
├── public.decorator.ts            \# @Public() đánh dấu bỏ qua JwtAuthGuard  
├── index.ts                       \# Barrel export  
└── decorators.spec.ts             \# Test suite kiểm thử toàn bộ các custom decorators

#### **Common Filter**

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- Exception Filters)**

| Tiêu chuẩn kỹ thuật | Thực tế thường gặp & Lỗ hổng | Chuẩn hóa cấp Doanh nghiệp (Enterprise-Grade) |
| :---- | :---- | :---- |
| **1\. Cấu trúc phản hồi lỗi chuẩn** | Các lỗi trả về định dạng phân mảnh: lúc thì chuỗi, lúc thì object lồng, không đồng nhất giữa 400 (Validation) và 500 (Crash). | Chuẩn hóa theo tiêu chuẩn quốc tế **RFC 7807 (Problem Details for HTTP APIs)** kết hợp Envelope chuẩn: success: false, statusCode, errorCode, message, details, traceId, timestamp, path. |
| **2\. Bắt lỗi cơ sở dữ liệu (TypeORM / Postgres)** | Lỗi TypeORM (Unique constraint 23505, Foreign Key 23503, Deadlock 40P01) ném ra ngoài dưới dạng 500 Internal Server Error, để lộ schema DB thô cho client. | Bắt trực tiếp TypeORMError và QueryFailedError, phân loại mã lỗi Postgres để chuyển hướng thành 409 Conflict hoặc 400 Bad Request an toàn. |
| **3\. Che giấu Stack Trace trên Production** | Ném nguyên bản stack ra ngoài response API gây rò rỉ đường dẫn file máy chủ và cấu trúc nội bộ. | **Tuyệt đối ẩn Stack Trace** trên Production (NODE\_ENV=production), chỉ xuất hiện stack khi ở môi trường development hoặc test. |
| **4\. Liên kết Observability & Truy vết lỗi** | Bộ lọc ngoại lệ log ra console thô, không biết lỗi thuộc traceId hay userId nào. | Bắt buộc liên kết với AppLoggerService và RequestContextService để log chi tiết kèm traceId, clientIp, user context đẩy về ELK/Loki. |

**Cấu trúc triển khai src/common/filters/**

src/common/filters/  
├── error-response.interface.ts     \# Interface chuẩn hóa RFC 7807 cho API Error Envelope  
├── http-exception.filter.ts         \# Bắt và format các lỗi kế thừa từ HttpException (4xx, 5xx)  
├── all-exceptions.filter.ts        \# Bắt toàn bộ lỗi chưa dự liệu (Uncaught Errors, TypeORM, Crash)  
├── index.ts                        \# Barrel export  
└── filters.spec.ts                 \# Test suite kiểm thử toàn diện cả 2 filters

#### **Common Guard**

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- Common Guards)**

| Guard | Vai trò kiến trúc | Khoảng trống & Điểm cần chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. JwtAuthGuard** | Xác thực danh tính (Authentication) | Cần tích hợp cờ @Public() để bypass cho các endpoint công khai (Login, Register, Health probe). Khi giải mã token JWT, phải trích xuất và validate đầy đủ cấu trúc RequestUserContext (id, email, tenantId, departmentId, roles, rules) và tự động nạp vào RequestContextService qua setUser(). |
| **2\. RolesGuard** | Phân quyền vai trò thô (Coarse-grained RBAC) | Kiểm tra metadata @Roles(...) đối chiếu với user.roles. Chặn nhanh request nếu người dùng không thuộc bất kỳ vai trò hợp lệ nào trước khi chạy các tính toán nặng hơn của CASL/ABAC. |
| **3\. PermissionsGuard** | Phân quyền ma trận hạt mịn & ABAC (Resource:Action:Scope) | Cần được export và chuẩn hóa tại tầng common/guards/ để các Controller sử dụng trực tiếp cùng decorator @RequirePermissions(). |
| **4\. ThrottlerGuard** | Chống Brute-Force & DDoS đa tầng | Kế thừa từ CustomThrottlerGuard đã hoàn thiện ở src/core/security/, nhận diện tracker linh hoạt theo user:\<userId\> hoặc ip:\<clientIp\> qua Reverse Proxy. |

**Cấu trúc triển khai src/common/guards/**

src/common/guards/  
├── jwt-auth.guard.ts         \# Kiểm tra tính hợp lệ của JWT, hỗ trợ @Public() & đồng bộ Context  
├── roles.guard.ts            \# RBAC Guard kiểm tra metadata @Roles()  
├── permissions.guard.ts      \# Re-export / Facade cho PermissionsGuard (Resource:Action:Scope & ABAC)  
├── throttler.guard.ts        \# Re-export / Facade cho CustomThrottlerGuard  
├── index.ts                  \# Barrel export  
└── guards.spec.ts            \# Test suite kiểm thử toàn diện chuỗi Guard

#### **Common Interceptors**

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- Common Interceptors)**

| Interceptor | Vai trò kiến trúc | Khoảng trống & Điểm cần chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. TransformInterceptor** | Đóng gói Envelope chuẩn đầu ra cho Client | Mọi response 2xx phải được đóng gói thống nhất: { success: true, statusCode, data, meta: { traceId, timestamp, durationMs, pagination? } }. Phải nhận diện và giữ nguyên cấu trúc nếu data trả về là luồng Stream (File download/PDF) hoặc đã có format phân trang. |
| **2\. TimeoutInterceptor** | Ngắt kết nối các request bị treo ở tầng HTTP Controller | Chặn đứng việc request giữ kết nối vô thời hạn làm nghẽn Event Loop. Khi vượt quá ngưỡng cấu hình (mặc định 15s), tự động ngắt và chuyển thành RequestTimeoutException (HTTP 408\) kèm thông tin traceId. Hỗ trợ decorator tùy biến @SetRequestTimeout(ms). |
| **3\. AuditInterceptor** | Ghi nhận bất biến hành vi gọi API (HTTP Ingestion Hook) | Ghi nhận toàn bộ siêu dữ liệu: Ai (actor\_id), gọi phương thức gì (POST/PUT/PATCH/DELETE), trên URI nào, địa chỉ IP, User-Agent, mã trạng thái HTTP trả về, thời gian xử lý (durationMs). Bỏ qua các phương thức đọc an toàn (GET, OPTIONS, HEAD) để tránh làm ngập (flood) bảng log. |

**Cấu trúc triển khai src/common/interceptors/**

src/common/interceptors/  
├── response-envelope.interface.ts  \# Cấu trúc Envelope chuẩn hóa cho Success Responses  
├── transform.interceptor.ts         \# Đóng gói data, traceId, durationMs vào Envelope  
├── timeout.interceptor.ts           \# Chặn treo request với RxJS timeout, hỗ trợ decorator tuỳ biến  
├── timeout.decorator.ts             \# Decorator @SetRequestTimeout(ms) cho từng route  
├── audit.interceptor.ts             \# Tự động ghi vết thao tác thay đổi dữ liệu (POST, PUT, PATCH, DELETE)  
├── index.ts                         \# Barrel export  
└── interceptors.spec.ts             \# Test suite kiểm thử toàn diện cả 3 interceptors

#### **Common Pipes**

**Bảng phân tích khoảng trống kỹ thuật (Gap Analysis \- Common Pipes)**

| Pipe | Vai trò kiến trúc | Khoảng trống & Điểm cần chuẩn hóa cấp Doanh nghiệp |
| :---- | :---- | :---- |
| **1\. CustomValidationPipe** | Kiểm chuẩn toàn bộ DTO đầu vào của ứng dụng | Cần kế thừa ValidationPipe của NestJS với các thiết lập bảo mật nghiêm ngặt: whitelist: true (lọc bỏ các trường không khai báo trong DTO để chống Mass Assignment / SQL Injection qua extra fields), forbidNonWhitelisted: true, transform: true. Định dạng lại cây lỗi lồng nhau (ValidationError\[\]) thành danh sách phẳng thân thiện dạng { field, message } tương thích với SystemErrorCode.REQ\_VALIDATION\_ERROR. |
| **2\. ParseDatePipe** | Chuyển đổi và kiểm tra ngày tháng từ Query / Params | Chuẩn hóa chuỗi ngày từ URL (YYYY-MM-DD hoặc ISO 8601\) thành đối tượng Date của JavaScript. Bắt buộc ném lỗi BadRequestException kèm mã lỗi rõ ràng nếu định dạng ngày không hợp lệ hoặc không tồn tại (ví dụ: ngày 2026-02-30). Hỗ trợ cấu hình bắt buộc (required: true/false). |
| **3\. ParseUUIDStrictPipe** | Kiểm tra tham số ID dạng UUID trên Route | Thay thế ParseUUIDPipe mặc định để đồng bộ mã lỗi SystemErrorCode.REQ\_INVALID\_UUID và gắn kèm tên trường tham số bị lỗi (ví dụ: paramName: 'bookingId'). |

**Cấu trúc triển khai src/common/pipes/**

src/common/pipes/  
├── validation.pipe.ts            \# CustomValidationPipe: Mass Assignment Protection & Flattened Errors  
├── parse-date.pipe.ts            \# ParseDatePipe: ISO 8601 & YYYY-MM-DD Validator  
├── parse-uuid.pipe.ts            \# ParseUUIDStrictPipe: Chuẩn hóa bắt lỗi UUID tham số  
├── index.ts                      \# Barrel export  
└── pipes.spec.ts                 \# Test suite kiểm thử toàn diện cả 3 Pipes  