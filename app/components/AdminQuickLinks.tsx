'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, FileUp, Users } from 'lucide-react';

export default function AdminQuickLinks() {
  const pathname = usePathname();
  if (pathname !== '/') return null;

  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1000, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <Link href="/admin/conflicts" style={linkStyle('#e25858', '#b73737')}><AlertTriangle size={17} /> Conflict Center</Link>
      <Link href="/admin/teachers" style={linkStyle('#33415f', '#202a40')}><Users size={17} /> Manage Teachers</Link>
      <Link href="/import" style={linkStyle('#7c5cff', '#a855f7')}><FileUp size={17} /> Import PDF</Link>
    </div>
  );
}

function linkStyle(from: string, to: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 13,
    background: `linear-gradient(135deg, ${from}, ${to})`, color: '#fff', fontWeight: 750,
    textDecoration: 'none', boxShadow: '0 14px 35px rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.14)'
  };
}
