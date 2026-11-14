import id from "./id.js";
import ja from "./ja.js";
import ko from "./ko.js";
import en from "./en.js";

export { LANG_LABELS, LANGS } from "../langs.js";

export const I18N = { id, ja, ko, en };

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
