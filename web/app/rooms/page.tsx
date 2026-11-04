import { Suspense } from "react";
import { FusionRoot } from "@/components/fusion-root";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { RoomsDashboard, type DashboardRoom } from "@/components/rooms-dashboard";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";
import { listUserRooms } from "@/lib/user-rooms";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function RoomsPage(props: PageProps) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RoomsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function RoomsContent({ searchParams }: PageProps) {
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/auth/login?next=/rooms");
  let rooms: DashboardRoom[] = [];
  try {
    rooms = (await listUserRooms(account.id)).map(({ id, topic, token, createdAt, members, events, owner }) => ({
      id,
      topic,
      token,
      createdAt,
      members,
      events,
      owner,
    }));
  } catch {
    rooms = [];
  }
  const failed = (await searchParams).error === "create";
  return (
    <FusionRoot>
      <Shell signedIn fusionHome>
        <RoomsDashboard name={account.name} rooms={rooms} failed={failed} />
      </Shell>
    </FusionRoot>
  );
}
