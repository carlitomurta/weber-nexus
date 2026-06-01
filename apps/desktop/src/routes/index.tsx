import { isAuthed } from "@/lib/auth";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (!isAuthed()) {
      redirect({
        to: "/dashboard",
      });
    } else {
      throw redirect({
        to: "/login",
      });
    }
  },
});
