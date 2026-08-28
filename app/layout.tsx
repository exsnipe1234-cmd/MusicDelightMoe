import type { Metadata } from 'next';
import './globals.css';
import './dashboard-fix.css';
import './fullcalendar-overrides.css';
import AdminQuickLinks from './components/AdminQuickLinks';
import CalendarAiAssistant from './components/CalendarAiAssistant';
import NativeAppViewport from './components/NativeAppViewport';
import ThemeToggle from './components/ThemeToggle';
import { AppDataProvider } from './providers/AppDataProvider';

export const metadata: Metadata = {
  title: 'Music Delight MOE Calendar',
  description: 'MOE lesson scheduling and teacher management dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppDataProvider>
          <ThemeToggle />
          <NativeAppViewport />
          {children}
          <AdminQuickLinks />
          <CalendarAiAssistant />
        </AppDataProvider>
      </body>
    </html>
  );
}
