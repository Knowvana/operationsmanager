// ============================================================================
// HomePage — The default landing page for unauthenticated users.
//
// ARCHITECTURE NOTE:
// This is shown at the root URL when no user is logged in. It uses the
// global TopNav component (same as all other pages) with role-based items.
// All text is sourced from messages.json for centralized management.
// ============================================================================
import React from 'react';
import {
  Layers, ArrowRight, UserPlus, LogIn, Shield, BarChart3,
  Building2, Puzzle, Zap, Globe, CheckCircle2, Calendar
} from 'lucide-react';
import { Button, Card, TopNav } from '@shared';
import messages from '@config/messages.json';

const FEATURE_ICONS = [BarChart3, Calendar, Building2, Puzzle, Zap];

export default function HomePage({ appName, onLogin, onRegister }) {
  const home = messages.homePage;
  const app = messages.app;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-brand-50/20 to-teal-50/20">
      {/* Global TopNav — unauthenticated mode shows Register + Sign In */}
      <TopNav
        appName={appName || app.name}
        onLogin={onLogin}
        onRegister={onRegister}
      />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 shadow-lg shadow-brand-200/50 mb-6">
          <Layers size={36} className="text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-surface-900 mb-4 leading-tight">
          {home.heroTitle}
        </h1>
        <p className="text-lg text-surface-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          {home.heroSubtitle}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" size="lg" icon={<UserPlus size={18} />} onClick={onRegister}>
            {home.ctaRegister}
          </Button>
          <Button variant="secondary" size="lg" icon={<LogIn size={18} />} onClick={onLogin}>
            {home.ctaLogin}
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {home.features.map((feature, i) => {
            const Icon = FEATURE_ICONS[i] || Zap;
            return (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden shadow-md shadow-surface-200/40 hover:shadow-lg hover:shadow-brand-100/30 transition-shadow duration-300 group"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-400 via-teal-400 to-emerald-400" />
                <div className="bg-white border border-surface-200/60 rounded-xl p-6 pl-7 h-full flex flex-col">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 w-fit mb-4 group-hover:scale-110 transition-transform">
                    <Icon size={22} className="text-brand-600" />
                  </div>
                  <h3 className="text-sm font-bold text-surface-800 mb-2">{feature.title}</h3>
                  <p className="text-xs text-surface-500 leading-relaxed flex-grow">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-t border-surface-200/60 bg-white/50">
        <div className="max-w-6xl mx-auto px-6 py-10 text-center">
          <div className="flex items-center justify-center gap-8 flex-wrap text-surface-400">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" />
              <span className="text-xs font-semibold">Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-brand-500" />
              <span className="text-xs font-semibold">Cloud Native</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-500" />
              <span className="text-xs font-semibold">99.9% Uptime</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              <span className="text-xs font-semibold">Real-Time Data</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200/60 bg-white/30">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-surface-400">{app.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
