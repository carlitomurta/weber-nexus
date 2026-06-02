const KEY = "nexus_auth_user";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

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
    return JSON.parse(user) as AuthUser;
  } catch {
    logout();
    return null;
  }
}

export function isAuthed() {
  return !!currentUser();
}
