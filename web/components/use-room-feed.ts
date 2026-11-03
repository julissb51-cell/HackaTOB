"use client";

import { useEffect, useRef, useState } from "react";
import { readRoomSnapshotAction } from "@/lib/room-actions";
import {
  applyRealtimeChange,
  eventFromRow,
  eventsKey,
  membersKey,
  mergeSnapshots,
  POLL_MS,
  realtimeFailed,
  realtimeFilter,
  sortEventsNewestFirst,
  type FeedMember,
  type LiveStatus,
} from "@/lib/room-feed";
import { browserSupabase } from "@/lib/supabase/browser";
import type { StoredEvent } from "@/lib/room-types";

const EVENT_COLUMNS =
  "event_id, room_id, member, ai, type, conversation_id, conversation_name, text, created_at";

const CONNECT_WAIT_MS = 8000;

export function useRoomFeed(roomId: string, initialEvents: StoredEvent[], initialMembers: FeedMember[]) {
  const [events, setEvents] = useState(() => sortEventsNewestFirst(initialEvents));
  const [members, setMembers] = useState(initialMembers);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const hadEvents = useRef(initialEvents.length > 0);

  useEffect(() => {
    let stopped = false;
    let pollId = 0;
    let live = false;
    const filter = realtimeFilter(roomId);
    const client = filter ? browserSupabase() : null;

    const applySnapshot = (
      incomingEvents: StoredEvent[],
      incomingMembers: FeedMember[],
      mode: "replace" | "merge",
    ) => {
      setEvents((current) => {
        const next = mode === "merge" ? mergeSnapshots(current, incomingEvents) : incomingEvents;
        return eventsKey(current) === eventsKey(next) ? current : next;
      });
      setMembers((current) => (membersKey(current) === membersKey(incomingMembers) ? current : incomingMembers));
    };

    const pullServer = async (mode: "replace" | "merge") => {
      try {
        const result = await readRoomSnapshotAction(roomId);
        if (stopped || !result.ok) {
          if (!stopped && !live) setStatus("offline");
          return false;
        }
        if (mode === "replace" && live) return true;
        applySnapshot(result.events, result.members, mode);
        return true;
      } catch {
        if (!stopped && !live) setStatus("offline");
        return false;
      }
    };

    const startPoll = () => {
      if (pollId || stopped) return;
      live = false;
      setStatus("polling");
      void pullServer("merge").then((ok) => {
        if (!stopped && !live) setStatus(ok ? "polling" : "offline");
      });
      pollId = window.setInterval(() => {
        void pullServer("merge").then((ok) => {
          if (!stopped && !live) setStatus(ok ? "polling" : "offline");
        });
      }, POLL_MS);
    };

    const stopPoll = () => {
      if (!pollId) return;
      window.clearInterval(pollId);
      pollId = 0;
    };

    if (!client || !filter) {
      startPoll();
      return () => {
        stopped = true;
        stopPoll();
      };
    }

    const watch = window.setTimeout(() => {
      if (!live) startPoll();
    }, CONNECT_WAIT_MS);

    let channel: ReturnType<typeof client.channel> | null = null;

    void (async () => {
      try {
        const { data } = await client.auth.getSession();
        if (stopped) return;
        if (!data.session?.access_token) {
          startPoll();
          return;
        }

        channel = client
          .channel(`enlaza-events-${roomId}-${Math.random().toString(36).slice(2, 8)}`, {
            config: { postgres_changes_options: { wait: true } },
          })
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "events", filter },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              setEvents((current) => applyRealtimeChange(current, payload, roomId));
            },
          )
          .subscribe((next: string) => {
            if (stopped) return;
            if (next === "SUBSCRIBED") {
              void confirmLive();
              return;
            }
            if (realtimeFailed(next)) startPoll();
          });
      } catch {
        if (!stopped) startPoll();
      }
    })();

    async function confirmLive() {
      const readable = await client!
        .from("events")
        .select(EVENT_COLUMNS)
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (stopped) return;
      if (readable.error || !readable.data) {
        startPoll();
        return;
      }
      const incoming: StoredEvent[] = [];
      for (const row of readable.data) {
        const event = eventFromRow(row, roomId);
        if (event) incoming.push(event);
      }
      if (incoming.length === 0 && hadEvents.current) {
        startPoll();
        return;
      }
      live = true;
      stopPoll();
      setStatus("live");
      setEvents((current) => {
        const next = mergeSnapshots(current, sortEventsNewestFirst(incoming));
        return eventsKey(current) === eventsKey(next) ? current : next;
      });
      void pullServer("merge");
    }

    return () => {
      stopped = true;
      window.clearTimeout(watch);
      stopPoll();
      if (channel) void client.removeChannel(channel);
    };
  }, [roomId]);

  return { events, members, status };
}
