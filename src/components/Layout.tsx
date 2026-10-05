import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import type { Section } from '../types';

interface Props {
  section: Section;
  onNavigate: (section: Section) => void;
  newLeadsCount: number;
  onSignOut: () => void;
  children: ReactNode;
}

export default function Layout({ section, onNavigate, newLeadsCount, onSignOut, children }: Props) {
  return (
    <div className="flex h-full bg-[#070b14]">
      <Sidebar
        section={section}
        onNavigate={onNavigate}
        newLeadsCount={newLeadsCount}
        onSignOut={onSignOut}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}