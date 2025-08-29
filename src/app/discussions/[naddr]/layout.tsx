import React from "react";
import { AuthProvider } from "@/lib/auth/auth-context";

export default function DiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}