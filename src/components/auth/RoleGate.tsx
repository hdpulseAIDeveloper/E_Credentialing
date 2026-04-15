import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

interface RoleGateProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallbackUrl?: string;
}

export async function RoleGate({ allowedRoles, children, fallbackUrl = "/dashboard" }: RoleGateProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!allowedRoles.includes(session.user.role as UserRole)) {
    redirect(fallbackUrl);
  }

  return <>{children}</>;
}
