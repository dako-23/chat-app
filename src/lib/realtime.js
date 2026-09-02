import { supabase } from "./supabase";

// Абонира се за нови/променени съобщения в даден разговор.
export function subscribeMessages(conversationId, handlers) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") handlers.onInsert?.(payload.new);
        if (payload.eventType === "UPDATE") handlers.onUpdate?.(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reactions" },
      () => handlers.onReactionChange?.()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "read_state",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => handlers.onReadChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// Presence + typing през Realtime broadcast/presence канал.
// state: { onOnline(list), onTyping(userId, isTyping) }
export function joinPresence(conversationId, user, state) {
  const channel = supabase.channel(`presence:${conversationId}`, {
    config: { presence: { key: user.id } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const raw = channel.presenceState();
      const online = Object.values(raw)
        .flat()
        .map((p) => p.user_id);
      state.onOnline?.([...new Set(online)]);
    })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.user_id !== user.id) {
        state.onTyping?.(payload.user_id, payload.typing);
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: user.id,
          display_name: user.display_name,
        });
      }
    });

  const sendTyping = (typing) =>
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, typing },
    });

  const leave = () => supabase.removeChannel(channel);
  return { sendTyping, leave };
}

// Обновяване на last_seen периодично
export function startHeartbeat(userId) {
  const beat = () =>
    supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", userId);
  beat();
  const t = setInterval(beat, 20000);
  return () => clearInterval(t);
}
