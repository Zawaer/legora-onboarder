import type { Metadata } from "next";
import ManagerView from "@/components/manager-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blockers · Onboarder",
  description:
    "What each new hire is stuck on, who can unblock them, and how many minutes it costs. No productivity metrics, by design.",
};

export default function ManagerPage() {
  return <ManagerView />;
}
