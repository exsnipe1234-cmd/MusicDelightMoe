'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, AlertTriangle, CalendarClock, ChevronDown, FileUp, LayoutGrid, Repeat2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const links = [
  { href: '/admin/replacements', label: 'Replacement Queue', icon: Repeat2, tone: 'danger' },
  { href: '/admin/requests', label: 'Unable to Attend', icon: AlertCircle, tone: 'warning' },
  { href: '/admin/conflicts', label: 'Conflict Center', icon: AlertTriangle, tone: 'dangerSoft' },
  { href: '/admin/availability', label: 'Teacher Availability', icon: CalendarClock, tone: 'info' },
  { href: '/admin/teachers', label: 'Manage Teachers', icon: Users, tone: 'neutral' },
  { href: '/import', label: 'Import PDF', icon: FileUp, tone: 'purple' },
];

export default function AdminQuickLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  if (!pathname.startsWith('/admin')) return null;

  return (
    <div className={open ? 'quickActions open' : 'quickActions'}>
      {open && <button className="quickBackdrop" onClick={() => setOpen(false)} aria-label="Close quick actions" />}
      <div className="quickPanel" aria-hidden={!open}>
        <div className="quickPanelHeader">
          <strong>Quick actions</strong>
          <button onClick={() => setOpen(false)} aria-label="Close quick actions"><X size={18}/></button>
        </div>
        <div className="quickLinks">
          {links.map(({ href, label, icon: Icon, tone }) => (
            <Link key={href} href={href} className={`quickLink ${tone} ${pathname === href ? 'active' : ''}`}>
              <Icon size={17}/><span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      <button className="quickTrigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? <ChevronDown size={19}/> : <LayoutGrid size={19}/>}
        <span>{open ? 'Close' : 'Quick actions'}</span>
      </button>

      <style jsx global>{`
        .quickActions{position:fixed;right:20px;bottom:20px;z-index:4200;display:grid;justify-items:end;gap:10px;pointer-events:none}
        .quickTrigger,.quickPanel{pointer-events:auto}
        .quickTrigger{height:46px;display:flex;align-items:center;gap:9px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:linear-gradient(135deg,#7058eb,#4e3ebd);color:#fff;font-weight:800;box-shadow:0 16px 40px rgba(0,0,0,.32)}
        .quickBackdrop{display:none}
        .quickPanel{width:min(330px,calc(100vw - 32px));padding:12px;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:rgba(10,15,29,.98);box-shadow:0 26px 80px rgba(0,0,0,.5);transform:translateY(8px) scale(.98);opacity:0;visibility:hidden;transition:.18s ease;transform-origin:bottom right}
        .quickActions.open .quickPanel{transform:none;opacity:1;visibility:visible}
        .quickPanelHeader{display:flex;align-items:center;justify-content:space-between;padding:4px 5px 11px}.quickPanelHeader strong{font-size:14px}.quickPanelHeader button{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:9px;background:rgba(148,163,184,.08);color:#9aa6bb}
        .quickLinks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.quickLink{min-height:76px;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:9px;padding:12px;border:1px solid rgba(148,163,184,.12);border-radius:12px;color:#fff!important;text-decoration:none!important;font-size:12px;font-weight:800;background:#11182b}.quickLink:hover,.quickLink.active{border-color:rgba(255,255,255,.28);transform:translateY(-1px)}.quickLink.danger{background:linear-gradient(145deg,rgba(239,68,68,.28),rgba(185,28,28,.18))}.quickLink.warning{background:linear-gradient(145deg,rgba(245,158,11,.28),rgba(217,119,6,.18))}.quickLink.dangerSoft{background:linear-gradient(145deg,rgba(226,88,88,.28),rgba(183,55,55,.18))}.quickLink.info{background:linear-gradient(145deg,rgba(14,165,168,.28),rgba(79,70,229,.18))}.quickLink.purple{background:linear-gradient(145deg,rgba(124,92,255,.28),rgba(168,85,247,.18))}
        @media(max-width:900px){.quickActions{right:14px;bottom:14px}.quickTrigger{height:48px}.quickPanel{position:fixed;left:12px;right:12px;bottom:72px;width:auto;max-height:calc(100dvh - 100px);overflow:auto}.quickBackdrop{display:block;position:fixed;inset:0;border:0;background:rgba(2,6,16,.62);backdrop-filter:blur(4px);pointer-events:auto}.quickLinks{grid-template-columns:1fr 1fr}}
        @media(max-width:480px){.quickLinks{grid-template-columns:1fr}.quickLink{min-height:58px;flex-direction:row;align-items:center;justify-content:flex-start}}
      `}</style>
    </div>
  );
}
