import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="adminAppShell">
      <AdminSidebar />
      <div className="adminPageContent">{children}</div>
    </div>
  );
}
