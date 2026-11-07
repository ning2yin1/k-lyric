import test from "node:test";
import assert from "node:assert/strict";
import { demo } from "../data.js";
import {
  validateSong,
  validateBackup,
  wordKey,
  songKey,
  parseJSON,
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
test("identity shares exact lexical meaning across songs and distinguishes homographs", () => {
  const c = demo.cards[0];
  assert.equal(wordKey(c), wordKey({ ...c, examples: [] }));
  assert.notEqual(wordKey(c), wordKey({ ...c, pos: "動詞" }));
  assert.notEqual(wordKey(c), wordKey({ ...c, meaning: "別の意味" }));
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
    weak: [wordKey(demo.cards[0])],
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
    version: 2,
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
    validateBackup({ ...backup, version: 1, weak: [key] }).mastered,
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
