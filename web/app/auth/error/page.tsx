import { Suspense } from "react";
import { connection } from "next/server";
import { AuthError } from "@/components/auth-error";
import { ScreenFallback, Shell } from "@/components/shell";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AuthErrorPage(props: PageProps) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <AuthErrorContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AuthErrorContent({ searchParams }: PageProps) {
  await connection();
  const reason = (await searchParams).reason;
  const value = Array.isArray(reason) ? reason[0] : reason;
  return (
    <Shell signedIn={false}>
      <AuthError reason={value === "config" ? "config" : "oauth"} />
    </Shell>
  );
}
