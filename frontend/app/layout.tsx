import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Canton Vault",
  description: "Canton Vault dApp"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {children}
        </div>
      </body>
    </html>
  );
}
