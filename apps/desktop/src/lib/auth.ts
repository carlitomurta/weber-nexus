import { authUserSchema, type AuthUser } from "../../types/auth.type";

const KEY = "nexus_auth_user";

export function login(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function currentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;

  const user = localStorage.getItem(KEY);

  if (!user) {
    return null;
  }

  try {
    return authUserSchema.parse(JSON.parse(user));
  } catch {
    logout();
    return null;
  }
}

export function isAuthed() {
  return !!currentUser();
}
