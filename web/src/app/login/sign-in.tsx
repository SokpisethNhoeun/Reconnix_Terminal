"use client";

/* Reads the token from the link's fragment (#token=…), trades it for the session cookie,
   removes it from the address bar, and opens the overview. */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type State = "working" | "missing" | "invalid";

export function SignIn() {
  const router = useRouter();
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      queueMicrotask(() => setState("missing"));
      return;
    }
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => (res.ok ? router.replace("/") : setState("invalid")))
      .catch(() => setState("invalid"));
  }, [router]);

  if (state === "working") {
    return (
      <>
        <div className="ring" aria-hidden />
        <b className="text-[15px]">Signing you in…</b>
      </>
    );
  }
  return (
    <>
      <b className="text-[15px]">{state === "missing" ? "Open your sign-in link" : "That sign-in link has expired"}</b>
      <p className="max-w-[44ch] text-[13.5px] text-muted">
        This dashboard runs on your computer only. The sign-in link is new each time it starts: open the link that{" "}
        <code className="font-mono text-accent">npm start</code> printed in your terminal.
      </p>
    </>
  );
}
