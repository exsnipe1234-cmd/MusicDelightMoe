import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="adminAppShell">
      <AdminSidebar />
      <div className="adminPageContent">{children}</div>
      <style>{`
        .adminAppShell{min-height:100vh}.adminPageContent{min-height:100vh;margin-left:238px}
        .adminPageContent>main{max-width:none!important;margin:0!important}
        @media(max-width:900px){.adminPageContent{margin-left:0}.adminAppShell{display:block}}
      `}</style>
    </div>
  );
}
