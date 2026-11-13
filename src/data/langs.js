/*
 * Daftar bahasa yang didukung.
 *
 * Dipisah dari kamus terjemahan supaya modul yang hanya butuh daftar bahasa
 * (mis. server yang menyanitasi state) tidak ikut memuat seluruh kamus.
 */
export const LANGS = ["id", "ja", "ko"];

export const LANG_LABELS = { id: "Indonesia", ja: "日本語", ko: "한국어" };
