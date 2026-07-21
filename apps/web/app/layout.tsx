import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";

const geistSans = { variable: "font-sans" };
const geistMono = { variable: "font-mono" };

export const metadata: Metadata = {
  title: "InfraCanvas - Visual Infrastructure Provisioning",
  description: "Design and provision infrastructure with a modern visual editor. Generate Ansible playbooks visually.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
