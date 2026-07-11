import { auth } from "@/auth";

export async function requireAdminSession() {
  const session = await auth();
  if (!session) return null;
  return session;
}
