-- ============================================================================
-- Default Schema — PostgreSQL schema for Operations Manager platform.
-- Run this against the Supabase PostgreSQL database to create all tables,
-- relationships, foreign keys, and indexes.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ROLES — Defines user roles and their permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name       VARCHAR(50) NOT NULL UNIQUE,
    description     VARCHAR(255),
    permissions     JSONB DEFAULT '[]'::jsonb,
    is_system_role  BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. SUBSCRIPTIONS — Subscription plans available on the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_name       VARCHAR(50) NOT NULL UNIQUE,
    description     VARCHAR(255),
    max_users       INT DEFAULT 5,
    max_modules     INT DEFAULT 2,
    price_monthly   DECIMAL(10,2) DEFAULT 0.00,
    features        JSONB DEFAULT '[]'::jsonb,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TENANTS — Organizations that subscribe to the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    status          VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'trial', 'inactive')),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(50),
    industry        VARCHAR(100),
    size            VARCHAR(50),
    max_users       INT DEFAULT 5,
    subscribed_modules JSONB DEFAULT '[]'::jsonb,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. APPLICATION_ADMINS — Platform-level administrators (system admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS application_admins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
    permissions     JSONB DEFAULT '[]'::jsonb,
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. USERS — Tenant users who access the platform through their organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    role_id         UUID REFERENCES roles(id) ON DELETE SET NULL,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metadata        JSONB DEFAULT '{}'::jsonb,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. LOGS — System and API logs for audit trails
-- ============================================================================
CREATE TABLE IF NOT EXISTS logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level           VARCHAR(10) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message         TEXT NOT NULL,
    type            VARCHAR(20) DEFAULT 'system' CHECK (type IN ('system', 'api', 'auth', 'audit')),
    source          VARCHAR(100),
    "user"          VARCHAR(255),
    data            JSONB,
    session_id      VARCHAR(100),
    result          VARCHAR(20),
    api_url         TEXT,
    api_method      VARCHAR(10),
    api_status_code INT,
    api_response_ms INT,
    api_request     JSONB,
    api_response    JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. SYSTEM_CONFIG — Platform-wide key-value configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key      VARCHAR(100) NOT NULL UNIQUE,
    config_value    JSONB NOT NULL DEFAULT '{}'::jsonb,
    description     VARCHAR(255),
    updated_by      VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES — Performance optimization
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Tenants
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_id ON tenants(subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Application Admins
CREATE INDEX IF NOT EXISTS idx_app_admins_email ON application_admins(email);
CREATE INDEX IF NOT EXISTS idx_app_admins_role_id ON application_admins(role_id);

-- Logs
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_user ON logs("user");
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- System Config
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- ============================================================================
-- TRIGGERS — Auto-update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['roles', 'subscriptions', 'tenants', 'application_admins', 'users', 'system_config'])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I; CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;
