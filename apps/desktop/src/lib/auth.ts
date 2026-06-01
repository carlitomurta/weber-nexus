const KEY = "nexus_auth_user";

export function login(username: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, username);
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function currentUser(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function isAuthed() {
  return !!currentUser();
}
