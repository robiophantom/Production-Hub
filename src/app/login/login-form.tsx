"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { loginAction, type LoginState } from "./actions";

export interface DemoLogin {
  role: Role;
  email: string;
  password: string;
  name: string;
}

const initialState: LoginState = {};

export function LoginForm({
  next,
  demoAccounts,
}: {
  next?: string;
  demoAccounts: DemoLogin[];
}) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full">
      <form action={formAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div>
          <Label htmlFor="email">Work email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@company-a.test"
              className="pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pl-9 pr-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <FormError>{state.error}</FormError>

        <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
          Sign in
          <ArrowRight />
        </SubmitButton>
      </form>

      {demoAccounts.length > 0 ? (
        <div className="mt-7 border-t border-line pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Development demo accounts
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            These accounts exist only in the local embedded demo database.
          </p>
          <div className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="flex items-center justify-between rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink">
                    {ROLE_LABELS[account.role]}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {account.email}
                  </span>
                </span>
                <span className="ml-3 shrink-0 text-[11px] font-medium text-brand">Use</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
