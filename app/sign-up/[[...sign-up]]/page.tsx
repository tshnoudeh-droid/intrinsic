import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/nav/AuthShell";

export const metadata: Metadata = {
  title: "Create account | Intrinsic",
};

export default function SignUpPage() {
  return (
    <AuthShell note="A free account lets you star stocks and keep them on a watchlist.">
      <SignUp
        fallbackRedirectUrl="/explore"
        signInUrl="/sign-in"
      />
    </AuthShell>
  );
}
