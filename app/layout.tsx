import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Music Delight MOE Calendar',
  description: 'MOE lesson scheduling and teacher management dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Link
          href="/import"
          aria-label="Import MOE calendar PDF"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 1000,
            padding: '13px 18px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #7c5cff, #a855f7)',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 14px 35px rgba(124, 92, 255, 0.35)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          Import PDF
        </Link>
      </body>
    </html>
  );
}
