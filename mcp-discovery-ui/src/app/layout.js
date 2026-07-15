import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MCP Discovery & Inspector Dashboard',
  description: 'A beautiful visual control room to discover, audit, and interact with Model Context Protocol (MCP) servers on the local network.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
