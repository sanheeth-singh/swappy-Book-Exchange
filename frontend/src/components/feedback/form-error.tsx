export function FormError({ message }: { message?: string }) { return message ? <p role="alert" className="mt-2 text-sm text-danger">{message}</p> : null; }
