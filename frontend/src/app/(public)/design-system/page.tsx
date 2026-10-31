import type { Metadata } from "next";
import { DesignSystemScreen } from "@/features/design-system/screens/design-system-screen";
export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };
export default function Page() { return <DesignSystemScreen />; }
