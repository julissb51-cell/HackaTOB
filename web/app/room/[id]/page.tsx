import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ScreenFallback } from "@/components/shell";
import { invitePath, readInviteToken } from "@/lib/room-fields";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ContractRoomPage(props: PageProps) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <ContractJoin params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ContractJoin({ params, searchParams }: PageProps) {
  await connection();
  const { id } = await params;
  const token = readInviteToken(await searchParams);
  if (!token) redirect(`/join/${encodeURIComponent(id)}`);
  redirect(invitePath(id, token));
  return null;
}
