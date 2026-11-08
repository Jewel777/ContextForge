import AdvancedOperationsHub from "@/components/AdvancedOperationsHub";
import ConflictForecastGuardrail from "@/components/ConflictForecastGuardrail";
import CloudConflictCenter from "@/components/CloudConflictCenter";
import "./globals.css";
import type { Metadata } from "next";

import AuthStatus from "@/components/AuthStatus";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import WorkspacePersistenceBridge from "@/components/WorkspacePersistenceBridge";
export const metadata: Metadata = {
  title: "ContextForge",
  description: "Local-first AI context compiler",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning><AuthSessionProvider>
          <AuthStatus />
          <WorkspacePersistenceBridge />
          <CloudConflictCenter />
          <ConflictForecastGuardrail />
          <AdvancedOperationsHub />
        </AuthSessionProvider>
        {children}</body>
    </html>
  );
}
