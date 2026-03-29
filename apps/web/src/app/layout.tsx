import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DirectCash Studio',
  description:
    'Painel operacional de campanhas com autenticação, gestão de usuários e visão consolidada da operação.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-theme="dark" lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
