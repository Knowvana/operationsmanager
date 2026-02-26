-- ============================================================================
-- Default Data — Seed data for initializing the platform database.
-- Creates: default roles, Free subscription, default Application Admin,
-- and initial system config entries.
-- Passwords are stored as bcrypt hashes (generated from system-admin.json).
-- ============================================================================

-- 1. Default Roles
INSERT INTO roles (id, role_name, description, permissions, is_system_role)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'system_admin', 'Full platform administrator with all permissions', '["platform.manage", "database.configure", "tenants.manage", "modules.manage", "users.manage", "logs.view", "settings.manage"]'::jsonb, true),
    ('00000000-0000-0000-0000-000000000002', 'tenant_admin', 'Tenant administrator — manages users and modules within their tenant', '["tenant.manage", "users.manage", "modules.access"]'::jsonb, true),
    ('00000000-0000-0000-0000-000000000003', 'tenant_user', 'Standard tenant user — accesses assigned modules', '["modules.access"]'::jsonb, true),
    ('00000000-0000-0000-0000-000000000004', 'viewer', 'Read-only access to assigned modules', '["modules.view"]'::jsonb, true)
ON CONFLICT (role_name) DO NOTHING;

-- 2. Default Subscription (Free tier)
INSERT INTO subscriptions (id, plan_name, description, max_users, max_modules, price_monthly, features, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000010', 'Free', 'Free tier — limited features, up to 5 users', 5, 2, 0.00, '["basic_dashboard", "single_tenant"]'::jsonb, true)
ON CONFLICT (plan_name) DO NOTHING;

-- 3. Default Application Admin (from system-admin.json)
-- Password: admin123 → bcrypt hash with cost factor 10
INSERT INTO application_admins (id, email, display_name, password_hash, role_id, permissions, status)
VALUES
    ('00000000-0000-0000-0000-000000000100', 'admin@knowvana.com', 'System Administrator',
     '$2a$10$defaulthashplaceholder00000000000000000000000000000000',
     '00000000-0000-0000-0000-000000000001',
     '["platform.manage", "database.configure", "tenants.manage", "modules.manage"]'::jsonb,
     'active')
ON CONFLICT (email) DO NOTHING;

-- 4. Default System Config
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES
    ('platform_metadata', '{"platformName": "Operations Manager", "version": "1.0.0", "databaseType": "PostgreSQL", "provider": "Supabase"}'::jsonb, 'Core platform metadata', 'system'),
    ('logging_config', '{"minLevel": "debug", "maxBufferSize": 500, "consoleOutput": true, "captureApiCalls": true, "captureTimestamps": true, "flushThreshold": 50, "persistLevels": ["warn", "error"]}'::jsonb, 'Logging configuration', 'system')
ON CONFLICT (config_key) DO NOTHING;

-- 5. Initial log entry
INSERT INTO logs (level, message, type, source, "user", session_id, result)
VALUES
    ('info', 'Platform database initialized with default data', 'system', 'DatabaseInit', 'system', 'seed', 'success');
