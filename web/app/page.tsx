import { Suspense } from "react";
import { connection } from "next/server";
import { HomeScreen } from "@/components/home-screen";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";

export default function Home() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const account = await currentAccount();
  return (
    <Shell signedIn={Boolean(account)}>
      <HomeScreen signedIn={Boolean(account)} name={account?.name ?? null} />
    </Shell>
  );
}
