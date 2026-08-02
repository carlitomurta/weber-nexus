import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthed } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: isAuthed() ? "/dashboard" : "/login",
    });
  },
});
