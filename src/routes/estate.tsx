import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/estate")({
  beforeLoad: () => {
    throw redirect({ to: "/registry" });
  },
  component: () => null,
});
