-- Chạy MỘT lần khi volume PostgreSQL của Docker được khởi tạo lần đầu.

-- Database riêng cho bộ kiểm thử e2e (không đụng dữ liệu dev)
CREATE DATABASE ticket_booking_test;

-- Role ứng dụng tối thiểu quyền: Row-Level Security đa tenant chỉ có hiệu lực với role
-- KHÔNG phải superuser và KHÔNG có BYPASSRLS. Migration chạy bằng 'postgres' (owner),
-- ứng dụng có thể chạy bằng 'app_user' (DB_MASTER_USER=app_user) để kiểm chứng RLS.
CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE ticket_booking TO app_user;
GRANT CONNECT ON DATABASE ticket_booking_test TO app_user;

\connect ticket_booking
GRANT USAGE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

\connect ticket_booking_test
GRANT USAGE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
