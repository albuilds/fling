"use client";
import { ArrowRight } from "lucide-react";
import { signIn } from "next-auth/react";

export function GoogleButton({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  return (
    <button className="google-button" type="button"
    onClick={() => signIn("google", { redirectTo })}
    >
      <span className="google-mark" aria-hidden="true">
        G
      </span>
      <span>Continue with Google</span>
      <ArrowRight size={18} />
    </button>
  );
}
