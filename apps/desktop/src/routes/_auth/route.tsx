import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Shell } from "@/components/Shell";
import { isAuthed } from "@/lib/auth";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    if (!isAuthed()) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
