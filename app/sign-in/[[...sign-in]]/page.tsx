import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/nav/AuthShell";

export const metadata: Metadata = {
  title: "Sign in | Intrinsic",
};

export default function SignInPage() {
  return (
    <AuthShell note="Sign in to see your watchlist and save new stocks to it.">
      {/* fallback (not force) so a ?redirect_url from the watchlist is honored */}
      <SignIn
        fallbackRedirectUrl="/explore"
        signUpUrl="/sign-up"
      />
    </AuthShell>
  );
}
