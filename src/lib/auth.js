import { supabase } from "./supabase";

// Вътрешен домейн — Supabase го приема, никога не се праща реален имейл.
const DOMAIN = "chat.local";

// Прави username от въведеното име: малки букви, латиница/цифри, без интервали.
export function slugify(name) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
    р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch",
    ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
  };
  return name
    .trim()
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

export function makeEmail(username) {
  return `${username}@${DOMAIN}`;
}

// Кратка лесна парола, напр. "ivan-4821"
export function makePassword(username) {
  return `${username}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Регистрация: връща { username, password } за показване на потребителя.
export async function register(displayName) {
  const username = slugify(displayName);
  if (!username) throw new Error("Въведи валидно име (поне една буква).");
  const email = makeEmail(username);
  const password = makePassword(username);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName.trim(), username } },
  });

  if (error) {
    // Ако вече съществува такъв username
    if (
      error.message?.toLowerCase().includes("already") ||
      error.status === 422
    ) {
      throw new Error(
        `Името „${displayName}" вече е заето. Влез с паролата си или избери друго име.`
      );
    }
    throw error;
  }

  // Ако проектът иска потвърждение по имейл, session може да е null.
  // За олекотен режим потвърждението трябва да е изключено (виж README).
  if (!data.session) {
    // Пробваме директно да влезем
    const { error: e2 } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (e2) {
      throw new Error(
        "Регистрацията мина, но входът изисква потвърждение по имейл. Изключи 'Confirm email' в Supabase → Authentication → Providers → Email."
      );
    }
  }

  await ensureProfile(username, displayName.trim());
  return { username, password };
}

// Вход със запазена парола
export async function login(displayName, password) {
  const username = slugify(displayName);
  const email = makeEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Грешно име или парола.");
  await ensureProfile(username, displayName.trim());
  return { username };
}

export async function logout() {
  await supabase.auth.signOut();
}

// Автоматичен вход с предварително зададени креденшъли.
// Ако акаунтът още не съществува — създава го веднъж, после влиза.
export async function autoLogin(username, password, displayName) {
  const email = makeEmail(username);
  // Опит за директен вход
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Няма такъв акаунт още — регистрирай го
    const { error: e2 } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, username } },
    });
    if (e2 && !e2.message?.toLowerCase().includes("already")) throw e2;
    // след регистрация — влез
    const { error: e3 } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (e3) throw e3;
  }
  await ensureProfile(username, displayName);
  return { username };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Записва/обновява профил в public.profiles
async function ensureProfile(username, displayName) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      display_name: displayName,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}
