"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { hasPermission } from "@/lib/permissions-client";

type Resource = Parameters<typeof hasPermission>[1];
type Action = Parameters<typeof hasPermission>[2];

interface Props {
  resource: Resource;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ resource, action, children, fallback = null }: Props) {
  const { user } = useAuth();
  const role = (user?.role ?? undefined) as Parameters<typeof hasPermission>[0];

  if (!hasPermission(role, resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
