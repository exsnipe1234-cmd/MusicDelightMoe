import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="adminAppShell" style={{ minHeight: '100vh' }}>
      <AdminSidebar />
      <div
        className="adminPageContent"
        style={{ minHeight: '100vh', marginLeft: 238 }}
      >
        {children}
      </div>
    </div>
  );
}
