-- ============================================================================
-- Demo Data — Sample data for testing and demonstration purposes.
-- Creates: Demo Tenant, Demo TenantAdmin User, Demo Log entries.
-- Run AFTER default-data.sql (requires Free subscription and tenant_admin role).
-- ============================================================================

-- 1. Demo Tenant (linked to Free subscription)
INSERT INTO tenants (id, name, status, subscription_id, contact_email, industry, size, max_users, subscribed_modules, metadata)
VALUES
    ('00000000-0000-0000-0000-000000000200', 'Demo Organization', 'trial',
     '00000000-0000-0000-0000-000000000010',
     'demo@knowvana.com', 'Technology', '1-50', 5,
     '["ops_monitor", "shift_roster"]'::jsonb,
     '{"source": "demo_seed", "contactPhone": "+1 (555) 000-0001"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Demo TenantAdmin User (linked to Demo Tenant and tenant_admin role)
-- Password: demo123 → bcrypt hash with cost factor 10
INSERT INTO users (id, email, display_name, password_hash, phone, status, role_id, tenant_id, metadata)
VALUES
    ('00000000-0000-0000-0000-000000000201', 'demo@knowvana.com', 'Demo Admin',
     '$2a$10$demohashplaceholder0000000000000000000000000000000000',
     '+1 (555) 000-0001', 'active',
     '00000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000200',
     '{"registrationSource": "demo_seed", "agreedToTerms": true}'::jsonb)
ON CONFLICT (email) DO NOTHING;

-- 3. Demo Log entries
INSERT INTO logs (level, message, type, source, "user", session_id, result, data)
VALUES
    ('info', 'Demo tenant created: Demo Organization', 'system', 'DemoSeed', 'system', 'demo_seed', 'success', '{"tenantName": "Demo Organization"}'::jsonb),
    ('info', 'Demo admin user created: demo@knowvana.com', 'system', 'DemoSeed', 'system', 'demo_seed', 'success', '{"email": "demo@knowvana.com", "role": "tenant_admin"}'::jsonb),
    ('info', 'Demo data initialization completed', 'system', 'DemoSeed', 'system', 'demo_seed', 'success', '{"objectsCreated": 3}'::jsonb);
