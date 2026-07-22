'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, CalendarDays, FileUp, Home, LogOut, Menu, School, Users, UserRoundCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../utils/supabase/client';

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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const logout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      <header className="adminMobileBar">
        <div className="adminBrand compact"><div className="adminBrandMark"><School size={20}/></div><strong>MOE Calendar</strong></div>
        <button onClick={() => setMobileOpen((value) => !value)} aria-label="Open navigation">{mobileOpen ? <X/> : <Menu/>}</button>
      </header>
      {mobileOpen && <button className="adminMenuBackdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={mobileOpen ? 'adminSidebar mobileOpen' : 'adminSidebar'}>
        <div className="adminBrand">
          <div className="adminBrandMark"><School size={22} /></div>
          <div><strong>Music Delight</strong><span>MOE Scheduling</span></div>
        </div>
        <nav className="adminNav" aria-label="Admin navigation">
          {links.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={active ? 'adminNavLink active' : 'adminNavLink'}><Icon size={18}/><span>{label}</span></Link>;
          })}
        </nav>
        <div className="adminSidebarFooter">
          <div><span>ADMIN PORTAL</span><strong>MOE Calendar</strong></div>
          <button className="adminLogout" onClick={logout} disabled={signingOut}><LogOut size={16}/>{signingOut ? 'Signing out…' : 'Log out'}</button>
        </div>
      </aside>
      <style jsx global>{`
        .adminMobileBar{display:none}
        .adminSidebar{position:fixed;inset:0 auto 0 0;width:238px;padding:25px 18px;display:flex;flex-direction:column;border-right:1px solid rgba(148,163,184,.12);background:rgba(7,11,22,.98);backdrop-filter:blur(22px);z-index:3000}
        .adminBrand{display:flex;align-items:center;gap:11px;padding:0 8px 25px}.adminBrandMark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#7857ff,#2ed4c7);box-shadow:0 12px 30px rgba(83,69,230,.3)}.adminBrand>div:last-child{display:grid;gap:2px}.adminBrand strong{font-size:15px;color:#f8fafc}.adminBrand span{color:#78859d;font-size:11px}
        .adminNav{display:grid;gap:7px}.adminNavLink{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:11px;color:#8995ad!important;text-decoration:none!important;font-size:13px;font-weight:700;transition:.18s ease}.adminNavLink:hover,.adminNavLink.active{color:#fff!important;background:linear-gradient(90deg,rgba(120,87,255,.23),rgba(46,212,199,.07))}.adminNavLink.active{box-shadow:inset 3px 0 #8b7cff}
        .adminSidebarFooter{margin-top:auto;display:grid;gap:14px;padding:18px 6px 2px;border-top:1px solid rgba(148,163,184,.1)}.adminSidebarFooter>div{display:grid;gap:4px;padding:0 4px}.adminSidebarFooter span{color:#6f7c95;font-size:9px;font-weight:900;letter-spacing:.15em}.adminSidebarFooter strong{font-size:12px;color:#b7c1d5}.adminLogout{width:100%;height:42px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(251,113,133,.2);border-radius:11px;background:rgba(251,113,133,.08);color:#fb8ca0;font-weight:800}.adminLogout:hover{background:rgba(251,113,133,.14)}
        @media(max-width:900px){
          .adminMobileBar{position:sticky;top:0;z-index:3100;height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(7,11,22,.96);backdrop-filter:blur(20px)}
          .adminMobileBar .adminBrand{padding:0}.adminMobileBar .adminBrandMark{width:38px;height:38px}.adminMobileBar button{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:11px;background:#11182b;color:#fff}
          .adminSidebar{inset:62px auto 0 0;width:min(290px,86vw);transform:translateX(-105%);transition:transform .2s ease;box-shadow:20px 0 60px rgba(0,0,0,.45)}.adminSidebar.mobileOpen{transform:none}
          .adminSidebar>.adminBrand{display:none}.adminMenuBackdrop{position:fixed;inset:62px 0 0;z-index:2950;border:0;background:rgba(2,6,16,.62);backdrop-filter:blur(3px)}
        }
      `}</style>
    </>
  );
}
