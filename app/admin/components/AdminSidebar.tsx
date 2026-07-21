'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CalendarDays, FileUp, Home, School, Users, UserRoundCheck } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard', icon: Home, exact: true },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/conflicts', label: 'Conflict Center', icon: AlertTriangle },
  { href: '/admin/availability', label: 'Availability', icon: UserRoundCheck },
  { href: '/admin/teachers', label: 'Teachers', icon: Users },
  { href: '/import', label: 'Import PDF', icon: FileUp, exact: true },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="adminSidebar">
      <div className="adminBrand">
        <div className="adminBrandMark"><School size={22} /></div>
        <div><strong>Music Delight</strong><span>MOE Scheduling</span></div>
      </div>

      <nav className="adminNav" aria-label="Admin navigation">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={active ? 'adminNavLink active' : 'adminNavLink'}>
              <Icon size={18}/><span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="adminSidebarFooter">
        <span>ADMIN PORTAL</span>
        <strong>MOE Calendar</strong>
      </div>

      <style jsx global>{`
        .adminSidebar{position:fixed;inset:0 auto 0 0;width:238px;padding:25px 18px;display:flex;flex-direction:column;border-right:1px solid rgba(148,163,184,.12);background:rgba(7,11,22,.96);backdrop-filter:blur(22px);z-index:3000}
        .adminBrand{display:flex;align-items:center;gap:11px;padding:0 8px 25px}.adminBrandMark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#7857ff,#2ed4c7);box-shadow:0 12px 30px rgba(83,69,230,.3)}.adminBrand>div:last-child{display:grid;gap:2px}.adminBrand strong{font-size:15px;color:#f8fafc}.adminBrand span{color:#78859d;font-size:11px}
        .adminNav{display:grid;gap:7px}.adminNavLink{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:11px;color:#8995ad!important;text-decoration:none!important;font-size:13px;font-weight:700;transition:.18s ease}.adminNavLink:visited{color:#8995ad}.adminNavLink:hover,.adminNavLink.active{color:#fff!important;background:linear-gradient(90deg,rgba(120,87,255,.23),rgba(46,212,199,.07))}.adminNavLink.active{box-shadow:inset 3px 0 #8b7cff}
        .adminSidebarFooter{margin-top:auto;display:grid;gap:4px;padding:18px 10px 2px;border-top:1px solid rgba(148,163,184,.1)}.adminSidebarFooter span{color:#6f7c95;font-size:9px;font-weight:900;letter-spacing:.15em}.adminSidebarFooter strong{font-size:12px;color:#b7c1d5}
        @media(max-width:900px){.adminSidebar{position:sticky;top:0;width:100%;height:auto;padding:11px 14px;display:grid;grid-template-columns:auto 1fr;align-items:center}.adminBrand{padding:0}.adminBrand>div:last-child,.adminSidebarFooter{display:none}.adminBrandMark{width:38px;height:38px}.adminNav{display:flex;justify-content:flex-end;overflow:auto}.adminNavLink{padding:9px}.adminNavLink span{display:none}}
      `}</style>
    </aside>
  );
}
