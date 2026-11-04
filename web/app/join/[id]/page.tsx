import { Suspense } from "react";
import { FusionRoot } from "@/components/fusion-root";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AutoJoin, JoinMessage } from "@/components/join-panel";
import { ScreenFallback, Shell } from "@/components/shell";
import { currentAccount } from "@/lib/current-account";
import {
  invitePath,
  isInviteToken,
  parseRoomId,
  readInviteToken,
} from "@/lib/room-fields";
import { readRoomToken } from "@/lib/room-token-cookie";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function JoinPage(props: PageProps) {
  return (
    <FusionRoot>
      <Suspense fallback={<ScreenFallback />}>
        <JoinContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </FusionRoot>
  );
}

async function JoinContent({ params, searchParams }: PageProps) {
  await connection();
  const id = parseRoomId((await params).id);
  const token =
    readInviteToken(await searchParams) || (id ? await readRoomToken(id) : "");
  const account = await currentAccount();
  if (!id || !isInviteToken(token)) {
    return (
      <Shell signedIn={Boolean(account)} fusionHome>
        <JoinMessage code="link" />
      </Shell>
    );
  }
  if (!account)
    redirect(`/auth/login?next=${encodeURIComponent(invitePath(id, token))}`);
  return (
    <Shell signedIn fusionHome>
      <AutoJoin roomId={id} token={token} />
    </Shell>
  );
}
