import { Button } from "@/components/ui/button";
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div role="alert" className="card p-6"><h2 className="text-xl">We couldn’t load this</h2><p className="mt-2 text-muted">{message}</p>{retry && <Button variant="secondary" className="mt-4" onClick={retry}>Try again</Button>}</div>; }
