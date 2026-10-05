import { LayoutGrid, Users, Star, Mail, Settings, LogOut } from 'lucide-react';
import type { Section } from '../types';
import { AGENCY_NAME, BRAND_NAME } from '../utils';

interface Props {
  section: Section;
  onNavigate: (section: Section) => void;
  newLeadsCount: number;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'reviews', label: 'Review History', icon: Star },
  { id: 'email', label: 'Email Builder', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ section, onNavigate, newLeadsCount, onSignOut }: Props) {
  return (
    <aside className="w-16 lg:w-60 shrink-0 bg-[#0b0f19] border-r border-[#1a2234] flex flex-col h-full">
      {/* Branding */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-[#1a2234]">
        <div className="w-7 h-7 bg-cyan-600 rounded-lg flex items-center justify-center shrink-0">
          <Star className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="hidden lg:block min-w-0">
          <p className="text-xs font-display font-bold text-white truncate">{BRAND_NAME}</p>
          <p className="text-[9px] font-mono text-slate-600">by {AGENCY_NAME}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-2 lg:px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#0d1629] text-cyan-400 border border-[#1a2234]'
                  : 'text-slate-400 hover:text-white hover:bg-[#0d1629]/60'
              }`}
              title={item.label}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="hidden lg:inline flex-1 text-left">{item.label}</span>
              {item.id === 'leads' && newLeadsCount > 0 && (
                <span className="hidden lg:inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-mono font-bold text-white bg-cyan-600 rounded-full">
                  {newLeadsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#1a2234]">
        <p className="hidden lg:block text-[9px] font-mono text-slate-600 px-2 pb-2">
          Powered by {BRAND_NAME} · {AGENCY_NAME}
        </p>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-rose-400 hover:bg-[#0d1629]/60 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4.5 h-4.5 shrink-0" />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}