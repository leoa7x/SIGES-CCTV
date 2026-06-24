import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../components/auth-provider";

export const metadata: Metadata = {
  title: "SIGES-CCTV | Sistema Integral de Gestión Operacional",
  description: "Plataforma de gestión y monitoreo de redes CCTV",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
