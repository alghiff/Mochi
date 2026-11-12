/*
 * Lagu latar diambil dari folder assets.
 *
 * Nama file sengaja ditulis lengkap supaya tidak ada tebakan. encodeURIComponent
 * membuat spasi, tanda baca, dan karakter unicode aman dipakai di URL.
 */
export const MUSIC_FILE =
  "bgm.mp3";

export const MUSIC_SRC = "/assets/" + encodeURIComponent(MUSIC_FILE);
