import test from "node:test";
import assert from "node:assert/strict";
import { demo } from "../data.js";
import {
  validateSong,
  validateBackup,
  wordKey,
  songKey,
  parseJSON,
  migrateLearningState,
  learningStatus,
} from "../store.js";
test("valid import preserves repeated lyric lines and separate examples", () => {
  const result = validateSong(demo);
  assert.equal(result.lyrics.length, 3);
  assert.deepEqual(result.lyrics[0], result.lyrics[2]);
  assert.equal(result.cards.length, 5);
});
test("reject malformed import and wrong field types", () => {
  for (const value of [
    null,
    [],
    {},
    { ...demo, lyrics: "text" },
    { ...demo, cards: [{ ...demo.cards[0], examples: [] }] },
    { ...demo, cards: [{ ...demo.cards[0], pronunciation: "bit" }] },
  ])
    assert.throws(() => validateSong(value));
  assert.throws(() => parseJSON("```json\n{}\n```"));
  assert.throws(() => parseJSON("{"));
});
test("identity normalizes POS and Unicode while explicit senses distinguish homonyms", () => {
  const c = demo.cards[0];
  assert.equal(wordKey(c), wordKey({ ...c, examples: [] }));
  assert.notEqual(wordKey(c), wordKey({ ...c, pos: "動詞" }));
  assert.equal(wordKey(c), wordKey({ ...c, meaning: "別の訳語" }));
  assert.notEqual(wordKey(c), wordKey({ ...c, sense_id: "別の語義" }));
  assert.equal(
    wordKey({ ...c, pos: " Noun ", word: c.word.normalize("NFD") }),
    wordKey(c),
  );
  assert.equal(
    songKey(demo),
    songKey({ ...demo, song: " " + demo.song + " " }),
  );
});
test("backup validates all data before replacement, ignores foreign fields", () => {
  const backup = {
    app: "K-LYRIC",
    version: 1,
    songs: [demo],
    weak: [
      JSON.stringify([
        demo.cards[0].word,
        demo.cards[0].pos,
        demo.cards[0].meaning,
      ]),
    ],
  };
  const result = validateBackup(backup);
  assert.equal(result.songs.length, 1);
  assert.equal(result.weak.length, 1);
  assert.ok(result.songs[0].id);
  for (const invalid of [
    { ...backup, version: 2 },
    { ...backup, songs: [demo, demo] },
    { ...backup, weak: ["invalid"] },
    { ...backup, songs: [demo, { song: "invalid" }] },
  ])
    assert.throws(() => validateBackup(invalid));
  assert.equal(
    validateBackup({ ...backup, songs: [], weak: [] }).songs.length,
    0,
  );
});

test("mastered backup validates identities and rejects conflicting states", () => {
  const key = wordKey(demo.cards[0]);
  const backup = {
    app: "K-LYRIC",
    version: 3,
    songs: [demo],
    weak: [],
    mastered: [key],
  };
  assert.deepEqual(validateBackup(backup).mastered, [key]);
  for (const invalid of [
    { ...backup, mastered: ["invalid"] },
    { ...backup, mastered: null },
    { ...backup, weak: [key] },
  ])
    assert.throws(() => validateBackup(invalid));
  assert.deepEqual(
    validateBackup({
      ...backup,
      version: 1,
      weak: [
        JSON.stringify([
          demo.cards[0].word,
          demo.cards[0].pos,
          demo.cards[0].meaning,
        ]),
      ],
    }).mastered,
    [],
  );
});
test("learning states toggle exclusively without changing songs or other words", async () => {
  const { toggleLearningState } = await import("../store.js");
  const card = demo.cards[0],
    key = wordKey(card),
    other = wordKey(demo.cards[1]);
  const old = { songs: [demo], weak: [key, other] };
  const learned = toggleLearningState(old, card, "mastered");
  assert.deepEqual(old.weak, [key, other]);
  assert.equal(learned.songs, old.songs);
  assert.deepEqual(learned.mastered, [key]);
  assert.deepEqual(learned.weak, [other]);
  const unset = toggleLearningState(learned, card, "mastered");
  assert.deepEqual(unset.mastered, []);
  const weak = toggleLearningState(learned, card, "weak");
  assert.deepEqual(weak.mastered, []);
  assert.ok(weak.weak.includes(key));
  assert.ok(!toggleLearningState(weak, card, "weak").weak.includes(key));
});

test("legacy gloss and POS variants migrate atomically and retain conflicting original records", () => {
  const a = JSON.stringify([" 사랑하다 ", "Verb", "愛する"]),
    b = JSON.stringify(["사랑하다", "動詞", "愛している"]);
  const old = { songs: [demo], weak: [a], mastered: [b] };
  const next = migrateLearningState(old);
  assert.equal(next.songs, old.songs);
  assert.equal(next.weak.length, 1);
  assert.equal(next.mastered.length, 0);
  assert.deepEqual(next.learningMigration.weak, [a]);
  assert.deepEqual(next.learningMigration.mastered, [b]);
  assert.equal(learningStatus(next, { word: "사랑하다", pos: "verb" }), "weak");
  assert.equal(migrateLearningState(next), next);
  assert.deepEqual(old.mastered, [b]);
  const restored = validateBackup({
    app: "K-LYRIC",
    version: 2,
    songs: [
      {
        ...demo,
        cards: [
          {
            ...demo.cards[0],
            word: "사랑하다",
            pos: "Verb",
            meaning: "愛する",
          },
        ],
      },
    ],
    weak: [],
    mastered: [JSON.stringify(["사랑하다", "verb", "愛する"])],
  });
  assert.equal(
    learningStatus(restored, { word: "사랑하다", pos: "動詞" }),
    "mastered",
  );
});

test("decomposed Hangul remains importable and explicit homonym IDs survive backup", () => {
  const song = {
    ...demo,
    cards: [
      {
        ...demo.cards[0],
        word: demo.cards[0].word.normalize("NFD"),
        pronunciation: demo.cards[0].pronunciation.normalize("NFD"),
        sense_id: "light",
      },
    ],
  };
  const clean = validateSong(song);
  assert.equal(clean.cards[0].sense_id, "light");
  const b = validateBackup({
    app: "K-LYRIC",
    version: 3,
    songs: [song],
    weak: [],
    mastered: [wordKey(song.cards[0])],
  });
  assert.equal(b.songs[0].cards[0].word, song.cards[0].word);
  assert.equal(b.mastered.length, 1);
});
