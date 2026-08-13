"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/app/stores";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, router]);

  // block render while redirect decision is pending
  if (isLoading) return null;
  if (!isAuthenticated && !isPublicRoute) return null;
  if (isAuthenticated && isPublicRoute) return null;

  return <>{children}</>;
}