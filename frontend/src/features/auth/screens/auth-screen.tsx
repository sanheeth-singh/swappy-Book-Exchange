"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api/client";
import { useAuth } from "../auth-provider";
import { destination } from "../roles";
import { credentialsSchema } from "../schemas";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/feedback/form-error";
export function AuthScreen({
  registerAccount = false,
}: {
  registerAccount?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState(false);
  const form = useForm({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
  async function submit(data: { email: string; password: string }) {
    setError(undefined);
    try {
      if (registerAccount) {
        await api.post("/auth/register", data);
        setCreated(true);
        form.reset({ email: data.email, password: "" });
      } else {
        const user = await auth.signIn(data.email, data.password);
        router.replace(destination(user));
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Please try again.",
      );
    }
  }
  return (
    <section className="container py-10">
      <Card className="mx-auto max-w-md p-6">
        <p className="eyebrow">Your next chapter</p>
        <h1 className="mt-3 text-3xl">
          {registerAccount ? "Create your account." : "Welcome back."}
        </h1>
        {created ? (
          <div role="status" className="mt-6">
            <p>Your account is ready. Sign in to set up your campus profile.</p>
            <ButtonLink href="/login" className="mt-5">
              Sign in
            </ButtonLink>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)}>
            <div>
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!form.formState.errors.email}
                aria-describedby="email-error"
                {...form.register("email")}
              />
              <div id="email-error">
                <FormError message={form.formState.errors.email?.message} />
              </div>
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  registerAccount ? "new-password" : "current-password"
                }
                aria-invalid={!!form.formState.errors.password}
                aria-describedby="password-error"
                {...form.register("password")}
              />
              <div id="password-error">
                <FormError message={form.formState.errors.password?.message} />
              </div>
            </div>
            <FormError message={error} />
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              {form.formState.isSubmitting
                ? "Please wait…"
                : registerAccount
                  ? "Create account"
                  : "Sign in"}
            </Button>
            <ButtonLink
              variant="ghost"
              href={registerAccount ? "/login" : "/register"}
            >
              {registerAccount
                ? "Already registered? Sign in"
                : "New here? Create an account"}
            </ButtonLink>
          </form>
        )}
      </Card>
    </section>
  );
}
