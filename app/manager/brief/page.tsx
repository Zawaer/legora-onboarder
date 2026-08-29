import type { Metadata } from "next";
import ManagerBriefView from "@/components/manager-brief-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manager brief · Onboarder",
  description:
    "Sent to the hiring manager 48 hours before a start date: who the buddy should be and why, five people to meet with a specific reason each, the first real task with the worked example beside it, and what the company still has not decided. Every line quoted from the company's own corpus.",
};

export default function ManagerBriefPage() {
  return <ManagerBriefView />;
}
