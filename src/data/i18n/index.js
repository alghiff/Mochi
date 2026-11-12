import id from "./id.js";
import ja from "./ja.js";
import ko from "./ko.js";

export const LANGS = ["id", "ja", "ko"];
export const LANG_LABELS = { id: "Indonesia", ja: "日本語", ko: "한국어" };

export const I18N = { id, ja, ko };

export function translate(lang, key, params) {
  const dict = I18N[lang] || I18N.id;
  let value = dict[key];

  if (value == null) value = I18N.id[key];
  if (value == null) return key;

  if (params) {
    for (const name of Object.keys(params)) {
      value = value.split("{" + name + "}").join(String(params[name]));
    }
  }

  return value;
}
