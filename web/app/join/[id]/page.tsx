import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AutoJoin, JoinMessage } from "@/components/join-panel";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";
import { invitePath, isInviteToken, parseRoomId, readInviteToken } from "@/lib/room-fields";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function JoinPage(props: PageProps) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <JoinContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function JoinContent({ params, searchParams }: PageProps) {
  await connection();
  const id = parseRoomId((await params).id);
  const token = readInviteToken(await searchParams);
  const account = await currentAccount();
  if (!id || !isInviteToken(token)) {
    return (
      <Shell signedIn={Boolean(account)}>
        <JoinMessage code="link" />
      </Shell>
    );
  }
  if (!account) redirect(`/auth/login?next=${encodeURIComponent(invitePath(id, token))}`);
  return (
    <Shell signedIn>
      <AutoJoin roomId={id} token={token} />
    </Shell>
  );
}
