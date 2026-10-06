/* Sign-in: the link printed by `npm start` carries the launch token in the URL fragment. */
import type { Metadata } from "next";

import { SignIn } from "./sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-4 rounded-[28px] px-7 py-9 text-center shadow-[var(--raise)]">
        <span className="brand-mark size-[46px] text-[19px]" aria-hidden>
          ◆
        </span>
        <b className="font-mono text-[17px] font-bold tracking-[0.2em]">RECONIX</b>
        <SignIn />
      </div>
    </main>
  );
}
