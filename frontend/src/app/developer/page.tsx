import type { Metadata } from "next";
import Developer from "@/features/developer/components/Developer";

export const metadata: Metadata = {
  title: "Meet the Developer | Swappy",
  description: "Meet Sanheeth, the developer behind Swappy.",
};

export default function DeveloperPage() {
  return <Developer />;
}