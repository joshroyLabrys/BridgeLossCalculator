import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { printStyles } from './print-styles';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bridge Loss Calculator',
  description: 'Independent bridge hydraulic loss calculations for HEC-RAS QA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
