import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetupRowLevelSecurity1710000000000 implements MigrationInterface {
  name = 'SetupRowLevelSecurity1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tạo Stored Function tái sử dụng để kích hoạt RLS tự động cho bất kỳ bảng nào
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION setup_tenant_rls(target_table TEXT)
      RETURNS VOID AS $$
      BEGIN
        -- Bật RLS trên bảng
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', target_table);
        
        -- Ép buộc RLS áp dụng cả với Table Owner (ngăn connection pool user bypass RLS)
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', target_table);

        -- Xóa policy cũ nếu đã tồn tại để tránh xung đột khi chạy lại migration
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', target_table);

        -- Chính sách cách ly PERMISSIVE: Postgres yêu cầu ít nhất một policy PERMISSIVE cấp quyền,
        -- nếu chỉ có policy RESTRICTIVE thì MỌI dòng đều bị chặn (kể cả đúng tenant).
        EXECUTE format('
          CREATE POLICY tenant_isolation_policy ON %I
          AS PERMISSIVE
          FOR ALL
          TO PUBLIC
          USING (
            -- 1. Cho phép Bypass khi chạy ngầm (System Workers, Data Migration, SuperAdmin)
            current_setting(''app.bypass_rls'', true) = ''on''
            OR
            -- 2. Cách ly triệt để theo tenant_id hiện hành
            tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
          )
          WITH CHECK (
            current_setting(''app.bypass_rls'', true) = ''on''
            OR
            tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid
          );
        ', target_table);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Kích hoạt RLS cho bảng mẫu (Ví dụ: bảng bookings và các bảng dữ liệu nghiệp vụ)
    // Lưu ý: Đảm bảo bảng đã có cột tenant_id NOT NULL UUID trước khi gọi hàm này
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
          PERFORM setup_tenant_rls('bookings');
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Gỡ bỏ Policy và RLS trên các bảng nghiệp vụ
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
          DROP POLICY IF EXISTS tenant_isolation_policy ON bookings;
          ALTER TABLE bookings NO FORCE ROW LEVEL SECURITY;
          ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
        END IF;
      END $$;
    `);

    // 2. Xóa Stored Function
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS setup_tenant_rls(TEXT);
    `);
  }
}