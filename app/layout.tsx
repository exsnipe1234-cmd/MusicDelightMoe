import type { Metadata } from 'next';
import './globals.css';
import AdminQuickLinks from './components/AdminQuickLinks';

export const metadata: Metadata = {
  title: 'Music Delight MOE Calendar',
  description: 'MOE lesson scheduling and teacher management dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AdminQuickLinks />
      </body>
    </html>
  );
}
