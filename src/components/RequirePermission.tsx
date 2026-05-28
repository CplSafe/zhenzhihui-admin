import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import { ForbiddenPage } from "@/pages/ForbiddenPage";

export function RequirePermission({
  permission,
  children,
}: {
  permission?: string;
  children: ReactNode;
}) {
  const { has } = usePermission();
  return permission && !has(permission) ? <ForbiddenPage /> : children;
}
