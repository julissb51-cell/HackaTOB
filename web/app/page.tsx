import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
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
  // Con sesión activa no se vuelve a pedir el inicio de sesión: directo a las salas.
  if (account) redirect("/rooms");
  return (
    <Shell signedIn={false}>
      <HomeScreen signedIn={false} name={null} />
    </Shell>
  );
}
