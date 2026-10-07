/* Sign-in: the link printed by `npm start` carries the launch token in the URL fragment. */
import type { Metadata } from "next";

import { Wordmark } from "@/components/layout/wordmark";

import { SignIn } from "./sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-[460px] items-center gap-4 px-7 py-9 text-center">
        <Wordmark className="text-xl" />
        <SignIn />
      </div>
    </main>
  );
}
