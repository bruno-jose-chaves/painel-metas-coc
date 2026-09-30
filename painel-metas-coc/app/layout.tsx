import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Painel de Metas · COC Online",
  description: "Acompanhamento de metas de vendas, leads e time comercial do COC Online",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
};
export const viewport: Viewport = { themeColor: "#0A0A0A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
