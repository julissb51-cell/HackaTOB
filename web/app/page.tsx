import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { FusionRoot } from "@/components/fusion-root";
import { Landing } from "@/components/landing";
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
  // Con sesión activa no se vuelve a pedir el inicio de sesión: directo a las salas.
  if (account) redirect("/rooms");
  return (
    <FusionRoot>
      <Shell signedIn={false} fusionHome>
        <Landing />
      </Shell>
    </FusionRoot>
  );
}
