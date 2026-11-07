export const normalize = (s) =>
  s.normalize("NFKC").trim().toLocaleLowerCase("ja");
const posAliases = {
  verb: "動詞",
  v: "動詞",
  동사: "動詞",
  adjective: "形容詞",
  adj: "形容詞",
  형용사: "形容詞",
  noun: "名詞",
  n: "名詞",
  명사: "名詞",
  pronoun: "代名詞",
  대명사: "代名詞",
  adverb: "副詞",
  adv: "副詞",
  부사: "副詞",
  numeral: "数詞",
  수사: "数詞",
  determiner: "連体詞",
  관형사: "連体詞",
  interjection: "感動詞",
  감탄사: "感動詞",
};
export const normalizePos = (p) => {
  const key = normalize(p);
  return Object.hasOwn(posAliases, key) ? posAliases[key] : key;
};
// Meanings are context-dependent glosses, not identity. Explicit sense_id separates homonyms.
export const wordKey = (c) =>
  JSON.stringify([
    normalize(c.word),
    normalizePos(c.pos),
    ...(c.sense_id ? [normalize(c.sense_id)] : []),
  ]);
export function learningStatus(state, card) {
  const key = wordKey(card);
  return (state.weak || []).includes(key)
    ? "weak"
    : (state.mastered || []).includes(key)
      ? "mastered"
      : "unset";
}
export function migrateLearningState(state) {
  if (state.learningVersion === 3) return state;
  const convert = (key) => {
    try {
      const parts = JSON.parse(key);
      if (
        !Array.isArray(parts) ||
        parts.length !== 3 ||
        !parts.every((x) => typeof x === "string")
      )
        return key;
      return wordKey({ word: parts[0], pos: parts[1] });
    } catch {
      return key;
    }
  };
  const weak = [...new Set((state.weak || []).map(convert))];
  const mastered = [...new Set((state.mastered || []).map(convert))].filter(
    (k) => !weak.includes(k),
  );
  return {
    ...state,
    learningVersion: 3,
    weak,
    mastered,
    learningMigration: {
      weak: [...(state.weak || [])],
      mastered: [...(state.mastered || [])],
      previous: state.learningMigration || null,
      rule: "conflict-prefers-weak",
    },
  };
}
// A single state transition is shared by every screen.
export function toggleLearningState(state, card, kind) {
  const key = wordKey(card);
  const active = (state[kind] || []).includes(key);
  const next = {
    ...state,
    weak: [...state.weak],
    mastered: [...(state.mastered || [])],
  };
  next[kind] = active
    ? next[kind].filter((k) => k !== key)
    : [...next[kind], key];
  if (!active) {
    const other = kind === "weak" ? "mastered" : "weak";
    next[other] = next[other].filter((k) => k !== key);
  }
  return next;
}
export const songKey = (s) =>
  JSON.stringify([normalize(s.song), normalize(s.artist)]);
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
function text(o, k, path, { empty = false } = {}) {
  if (typeof o[k] !== "string" || (!empty && !o[k].trim()))
    throw Error(
      `${path}.${k} は${empty ? "" : "空でない"}文字列にしてください。`,
    );
  if (o[k].length > 100000) throw Error(`${path}.${k} が長すぎます。`);
  return o[k];
}
export function validateSong(s, path = "曲") {
  if (!object(s)) throw Error(`${path} はオブジェクトにしてください。`);
  const clean = {
    song: text(s, "song", path),
    artist: text(s, "artist", path),
  };
  if (!Array.isArray(s.lyrics) || !s.lyrics.length || s.lyrics.length > 10000)
    throw Error(`${path}.lyrics は1〜10,000行の配列にしてください。`);
  clean.lyrics = s.lyrics.map((l, i) => {
    if (!object(l))
      throw Error(`${path}.lyrics[${i + 1}] の形式が正しくありません。`);
    return {
      original: text(l, "original", `${path}.lyrics[${i + 1}]`, {
        empty: true,
      }),
      translation: text(l, "translation", `${path}.lyrics[${i + 1}]`, {
        empty: true,
      }),
    };
  });
  if (!Array.isArray(s.cards) || s.cards.length > 10000)
    throw Error(`${path}.cards は10,000枚以下の配列にしてください。`);
  clean.cards = s.cards.map((c, i) => {
    const p = `${path}.cards[${i + 1}]`;
    if (!object(c)) throw Error(`${p} の形式が正しくありません。`);
    const out = {};
    for (const k of ["word", "meaning", "pronunciation", "pos"])
      out[k] = text(c, k, p);
    if (c.sense_id !== undefined) out.sense_id = text(c, "sense_id", p);
    if (!/[가-힣]/u.test(normalize(c.word)))
      throw Error(`${p}.word は韓国語を含む辞書形にしてください。`);
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ\s\[\](),·-]+$/u.test(normalize(c.pronunciation)))
      throw Error(`${p}.pronunciation はハングル表記にしてください。`);
    if (
      !Array.isArray(c.examples) ||
      !c.examples.length ||
      c.examples.length > 10000
    )
      throw Error(`${p}.examples は1〜10,000件の配列にしてください。`);
    out.examples = c.examples.map((e, j) => {
      if (!object(e))
        throw Error(`${p}.examples[${j + 1}] の形式が正しくありません。`);
      const ex = {};
      for (const k of [
        "original_form",
        "original_lyric",
        "lyric_meaning",
        "grammar",
      ])
        ex[k] = text(e, k, `${p}.examples[${j + 1}]`);
      return ex;
    });
    return out;
  });
  return clean;
}
export function validateBackup(b) {
  if (!object(b) || b.app !== "K-LYRIC" || ![1, 2, 3].includes(b.version))
    throw Error("K-LYRIC バージョン1〜3のバックアップを選択してください。");
  if (!Array.isArray(b.songs) || b.songs.length > 1000)
    throw Error("songs は1,000曲以下の配列にしてください。");
  const songs = b.songs.map((s, i) => ({
    ...validateSong(s, `曲[${i + 1}]`),
    id: crypto.randomUUID(),
  }));
  if (new Set(songs.map(songKey)).size !== songs.length)
    throw Error("同じ曲名・アーティストの曲が重複しています。");
  const keys = new Set(
    songs.flatMap((s) =>
      s.cards.map((c) =>
        b.version < 3
          ? JSON.stringify([
              normalize(c.word),
              normalize(c.pos),
              normalize(c.meaning),
            ])
          : wordKey(c),
      ),
    ),
  );
  if (
    !Array.isArray(b.weak) ||
    !b.weak.every((k) => typeof k === "string" && keys.has(k))
  )
    throw Error("苦手マークのデータが正しくありません。");
  const mastered = b.version === 1 ? [] : b.mastered;
  if (
    !Array.isArray(mastered) ||
    !mastered.every((k) => typeof k === "string" && keys.has(k))
  )
    throw Error("覚えたマークのデータが正しくありません。");
  if (b.version === 3 && mastered.some((k) => b.weak.includes(k)))
    throw Error("同じ単語に苦手と覚えたを同時に設定することはできません。");
  const restored = {
    songs,
    weak: [...new Set(b.weak)],
    mastered: [...new Set(mastered)],
    initialized: true,
  };
  if (b.version === 3) {
    if (
      b.learningMigration !== undefined &&
      (!object(b.learningMigration) ||
        !Array.isArray(b.learningMigration.weak) ||
        !Array.isArray(b.learningMigration.mastered) ||
        ![...b.learningMigration.weak, ...b.learningMigration.mastered].every(
          (k) => typeof k === "string",
        ))
    )
      throw Error("移行履歴の形式が正しくありません。");
    return {
      ...restored,
      learningVersion: 3,
      ...(b.learningMigration
        ? { learningMigration: b.learningMigration }
        : {}),
    };
  }
  return migrateLearningState(restored);
}
export function parseJSON(source) {
  if (source.length > 20 * 1024 * 1024)
    throw Error("データは20MB以下にしてください。");
  try {
    return JSON.parse(source);
  } catch {
    throw Error(
      "JSONの書式が正しくありません。コードフェンスや説明文を除き、引用符・カンマ・括弧を確認してください。",
    );
  }
}
let db;
export async function openStore() {
  db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("k-lyric", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error("別のタブを閉じて、再読み込みしてください。"));
  });
  db.onversionchange = () => db.close();
  return new Promise((resolve, reject) => {
    const r = db.transaction("state").objectStore("state").get("library");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveStore(state) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(state, "library");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("保存を中断しました。"));
  });
}
