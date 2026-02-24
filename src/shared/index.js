// ============================================================================
// Shared Module — Barrel Export
//
// ARCHITECTURE NOTE:
// This is the SINGLE entry point for all shared components, layouts, hooks,
// and services. Every module imports from '@shared' — never from deep paths.
//
// WHY: If you move a component file, you update ONE line here instead of
//      updating every import across the entire codebase.
// ============================================================================

// --- Components (Design System) ---
export { default as Button } from './components/Button';
export { default as Input } from './components/Input';
export { default as Card } from './components/Card';
export { default as Modal } from './components/Modal';
export { default as ActionModal } from './components/ActionModal';
export { default as Spinner } from './components/Spinner';
export { default as StatusBadge } from './components/StatusBadge';
export { default as EmptyState } from './components/EmptyState';
export { default as LoginForm } from './components/LoginForm';
export { default as SettingsConfig } from './components/SettingsConfig';

// --- Layouts ---
export { default as AppShell } from './layouts/AppShell';
export { default as TopNav } from './layouts/TopNav';
export { default as SideNav } from './layouts/SideNav';
export { default as PageHeader } from './layouts/PageHeader';
export { default as RightPanel } from './layouts/RightPanel';

// --- Services ---
export { default as Logger } from './services/logger';
export { default as AuthService } from './services/authService';

// --- Hooks (added as we build them) ---
// export { default as useConfirmAction } from './hooks/useConfirmAction';
