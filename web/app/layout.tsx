import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { LanguageProvider } from "@/components/language";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enlaza",
  description: "Sala compartida para el trabajo de un equipo con sus IAs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sourceSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LanguageProvider initialLang="es">{children}</LanguageProvider>
      </body>
    </html>
  );
}
