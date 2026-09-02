import { supabase } from "./supabase";

// ── Профили ────────────────────────────────────────────────────────────────
export async function me() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function myProfile() {
  const u = await me();
  if (!u) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", u.id)
    .single();
  return data;
}

// Търсене на хора по username или display_name
export async function searchUsers(term) {
  const u = await me();
  const q = term.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, last_seen")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", u.id)
    .limit(20);
  if (error) throw error;
  return data;
}

// Всички регистрирани потребители (без мен), онлайн най-отгоре
export async function allUsers() {
  const u = await me();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, last_seen")
    .neq("id", u.id)
    .order("last_seen", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

// Проверка дали потребител е онлайн (видян през последните 15 сек)
export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 15000;
}

// Хора, които са онлайн в момента (видени през последните 12 сек)
export async function onlineUsers() {
  const u = await me();
  const cutoff = new Date(Date.now() - 12000).toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, last_seen")
    .gt("last_seen", cutoff)
    .neq("id", u.id)
    .order("last_seen", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// ── Разговори ───────────────────────────────────────────────────────────────
// Намира съществуващ 1-на-1 разговор с даден човек или създава нов.
export async function openDirect(otherUserId) {
  const { data, error } = await supabase.rpc("get_or_create_direct", {
    other_user: otherUserId,
  });
  if (error) throw error;
  return data; // conversation_id
}

// Списък с моите разговори + другия участник + последно съобщение + unread
export async function listConversations() {
  const { data, error } = await supabase
    .from("conversation_overview")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data;
}

// Присъединяване по код
export async function joinByCode(code) {
  const { data, error } = await supabase.rpc("join_by_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  return data; // conversation_id
}

export async function getConversation(id) {
  const { data, error } = await supabase
    .from("conversation_overview")
    .select("*")
    .eq("conversation_id", id)
    .single();
  if (error) throw error;
  return data;
}

// ── Съобщения ─────────────────────────────────────────────────────────────
export async function fetchMessages(conversationId, { before, limit = 30 } = {}) {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return data.reverse(); // хронологично
}

export async function sendMessage(conversationId, { text, replyTo, imageUrl }) {
  const u = await me();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: u.id,
      body: text ?? null,
      image_url: imageUrl ?? null,
      reply_to: replyTo ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function editMessage(id, text) {
  const { error } = await supabase
    .from("messages")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// deleteFor: 'me' | 'all'
export async function deleteMessage(id, mode = "all") {
  if (mode === "all") {
    const { error } = await supabase
      .from("messages")
      .update({ deleted: true, body: null, image_url: null })
      .eq("id", id);
    if (error) throw error;
  } else {
    const u = await me();
    const { error } = await supabase
      .from("message_hidden")
      .insert({ message_id: id, user_id: u.id });
    if (error) throw error;
  }
}

// ── Reactions ───────────────────────────────────────────────────────────────
export async function toggleReaction(messageId, emoji) {
  const u = await me();
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", u.id)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("reactions")
      .insert({ message_id: messageId, user_id: u.id, emoji });
  }
}

export async function fetchReactions(conversationId) {
  const { data, error } = await supabase
    .from("reactions")
    .select("id, message_id, emoji, user_id")
    .in(
      "message_id",
      (
        await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
      ).data?.map((m) => m.id) ?? []
    );
  if (error) return [];
  return data;
}

// ── Read receipts ─────────────────────────────────────────────────────────
export async function markRead(conversationId) {
  const u = await me();
  await supabase.from("read_state").upsert(
    {
      conversation_id: conversationId,
      user_id: u.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );
}

export async function fetchReadState(conversationId) {
  const { data } = await supabase
    .from("read_state")
    .select("user_id, last_read_at")
    .eq("conversation_id", conversationId);
  return data ?? [];
}

// ── Снимки ────────────────────────────────────────────────────────────────
export async function uploadImage(conversationId, file, onProgress) {
  const u = await me();
  const ext = file.name.split(".").pop();
  const path = `${conversationId}/${u.id}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("chat-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  return data.publicUrl;
}
