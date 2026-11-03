import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { CreateRoomScreen } from "@/components/create-room-form";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";

export default function NewRoomPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <NewRoomContent />
    </Suspense>
  );
}

async function NewRoomContent() {
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/auth/login?next=/rooms/new");
  return (
    <Shell signedIn>
      <CreateRoomScreen />
    </Shell>
  );
}
