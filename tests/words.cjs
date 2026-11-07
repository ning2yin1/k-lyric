const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_URL || "http://127.0.0.1:8000/k-lyric/";
  await page.goto(base);
  await page.locator(".song-card").waitFor();
  await page.evaluate(async () => {
    const { demo } = await import("./data.js");
    const { openStore, saveStore } = await import("./store.js");
    await openStore();
    const love = {
      ...demo.cards[0],
      word: "사랑하다",
      pos: "動詞",
      meaning: "愛する",
      pronunciation: "사랑하다",
      examples: [
        {
          original_form: "사랑해",
          original_lyric: "오늘도 사랑해",
          lyric_meaning: "今日も愛してる",
          grammar: "해体です。",
        },
      ],
    };
    const a = {
      ...demo,
      id: "a",
      song: "曲A",
      cards: [
        love,
        { ...love, word: "배", pos: "名詞", meaning: "船", sense_id: "boat" },
        {
          ...love,
          word: "배",
          pos: "名詞",
          meaning: "お腹",
          sense_id: "stomach",
        },
      ],
    };
    const b = {
      ...demo,
      id: "b",
      song: "曲B",
      cards: [
        {
          ...love,
          word: " 사랑하다 ".normalize("NFD"),
          pos: "Verb",
          meaning: "愛している",
        },
      ],
    };
    await saveStore({
      songs: [a, b],
      weak: [JSON.stringify(["사랑하다", "verb", "愛している"])],
      mastered: [JSON.stringify(["사랑하다", "動詞", "愛する"])],
      initialized: true,
    });
  });
  await page.reload();
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator("nav a").count(), 3);
  await page.goto(base + "#song/a");
  await page.locator("#list-tab").click();
  await page
    .locator(".result")
    .first()
    .locator("[data-learning=weak][aria-pressed=true]")
    .waitFor();
  await page
    .locator(".result")
    .first()
    .locator("[data-learning=mastered]")
    .click();
  await page
    .locator(".result")
    .first()
    .locator("[data-learning=mastered][aria-pressed=true]")
    .waitFor();
  await page.goto(base + "#song/b");
  await page.locator("#list-tab").click();
  await page.locator("[data-learning=mastered][aria-pressed=true]").waitFor();
  await page.locator("#cards-tab").click();
  await page.getByText("この曲の単語はすべて覚えました！").waitFor();
  await page.locator("#list-tab").click();
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator("[data-learning=mastered]").click();
  await page.locator("[data-learning=mastered][aria-pressed=false]").waitFor();
  await page.goto(base + "#song/a");
  await page.locator("#cards-tab").click();
  assert.equal(await page.locator(".word").textContent(), "사랑하다");
  await page.locator("#toggle-mastered").click();
  await page.locator(".word").filter({ hasText: "배" }).waitFor();
  // New song inherits the global state even with a new gloss and English POS.
  const c = await page.evaluate(async () => {
    const { demo } = await import("./data.js");
    return {
      ...demo,
      song: "曲C",
      cards: [
        {
          ...demo.cards[0],
          word: "사랑하다",
          pos: " verb ",
          meaning: "大切に愛する",
        },
      ],
    };
  });
  await page.goto(base + "#import");
  await page.locator("#json-input").fill(JSON.stringify(c));
  await page.locator("#import-song").click();
  await page.locator("#cards-tab").click();
  await page.getByText("この曲の単語はすべて覚えました！").waitFor();
  await page.goto(base + "#words");
  assert.equal(await page.locator(".result").count(), 3);
  assert.equal(
    await page.locator("[data-learning=mastered][aria-pressed=true]").count(),
    1,
  );
  await page.locator("[data-filter=mastered]").click();
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator("#word-search").fill("愛している");
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator(".result-link").click();
  assert.equal(await page.locator("dialog h3").count(), 3);
  assert.match(await page.locator("dialog").textContent(), /曲A/);
  assert.match(await page.locator("dialog").textContent(), /曲B/);
  assert.match(await page.locator("dialog").textContent(), /曲C/);
  await page.locator("#dialog-close").click();
  await page.locator("[data-learning=weak]").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".result").length === 0,
  );
  assert.equal(await page.locator(".result").count(), 0);
  assert.equal(await page.locator("#word-search").inputValue(), "愛している");
  await page.locator("[data-filter=weak]").click();
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator("#word-search").fill("사랑해");
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator("#study-weak").click();
  await page.locator("#flip").waitFor();
  assert.equal(await page.locator(".word").textContent(), "사랑하다");
  await page.close();
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "#words");
  await page.locator(".result").first().waitFor();
  assert.equal(
    await page.locator("[data-learning=weak][aria-pressed=true]").count(),
    1,
  );
  await page.goto(base + "#import");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const dl = await downloadPromise;
  await dl.saveAs("/tmp/k-lyric-words-backup.json");
  const backup = JSON.parse(
    await require("node:fs/promises").readFile(
      "/tmp/k-lyric-words-backup.json",
      "utf8",
    ),
  );
  assert.equal(backup.songs.length, 3);
  assert.equal(backup.learningMigration.mastered.length, 1);
  await page
    .locator("#restore-file")
    .setInputFiles("/tmp/k-lyric-words-backup.json");
  await page.locator("#confirm-restore").click();
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator(".song-card").count(), 3);
  await page.locator(".song-card").first().click();
  await page.locator(".lyric").first().waitFor();
  assert.equal(await page.locator(".lyric").count(), 3);
  await page.goto(base + "#words");
  await page.locator(".result").first().waitFor();
  assert.equal(await page.locator(".result").count(), 3);
  assert.equal(
    await page.locator("[data-learning=weak][aria-pressed=true]").count(),
    1,
  );
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.screenshot({ path: "/tmp/k-lyric-words.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: gloss/POS/Unicode A-B-C sync, reversible states, import inheritance, homonym senses, migration conflicts/history, merged examples, combined filters/search, weak study, tab restart, backup/restore, lyric retention, three-item mobile navigation.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
