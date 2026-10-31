import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <Card className="p-8 text-center"><h2 className="text-xl">{title}</h2><p className="mx-auto mt-3 max-w-md text-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</Card>; }
