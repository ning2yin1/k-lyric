const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_URL || "http://127.0.0.1:8000/k-lyric/";
  await page.goto(base);
  await page.locator(".song-card").waitFor();
  // Simulate an existing installation with songs and weak state, without a mastered field.
  await page.evaluate(async () => {
    const { demo } = await import("./data.js");
    const { saveStore, openStore, wordKey } = await import("./store.js");
    await openStore();
    await saveStore({
      songs: [
        { ...demo, id: "legacy-a" },
        { ...demo, id: "legacy-b", song: "2曲目" },
      ],
      weak: [
        JSON.stringify([
          demo.cards[0].word,
          demo.cards[0].pos,
          demo.cards[0].meaning,
        ]),
      ],
      initialized: true,
    });
  });
  await page.reload();
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator(".song-card").count(), 2);
  await page.goto(base + "#song/legacy-a");
  await page.locator("#cards-tab").click();
  await page.locator("#toggle-weak.active").waitFor();
  await page.locator("#toggle-mastered").click();
  await page.locator(".word").filter({ hasText: "작다" }).waitFor();
  assert.match(
    await page.locator("#song-stats").textContent(),
    /覚えた 1 単語/,
  );
  assert.match(
    await page.locator("#song-stats").textContent(),
    /未習得 4 単語/,
  );
  await page.goto(base + "#song/legacy-b");
  await page.locator("#cards-tab").click();
  assert.equal(await page.locator(".word").textContent(), "작다");
  await page.locator("#list-tab").click();
  assert.equal(await page.locator(".result").count(), 5);
  const first = page.locator(".result").first();
  assert.equal(
    await first
      .locator("[data-learning=mastered]")
      .getAttribute("aria-pressed"),
    "true",
  );
  // Same button clears mastered. Then weak -> mastered -> weak remains exclusive.
  await first.locator("[data-learning=mastered]").click();
  await first.locator("[data-learning=mastered][aria-pressed=false]").waitFor();
  await first.locator("[data-learning=weak]").click();
  await first.locator("[data-learning=weak][aria-pressed=true]").waitFor();
  await first.locator("[data-learning=mastered]").click();
  await first.locator("[data-learning=mastered][aria-pressed=true]").waitFor();
  assert.equal(
    await first.locator("[data-learning=weak]").getAttribute("aria-pressed"),
    "false",
  );
  await first.locator("[data-learning=weak]").click();
  await first.locator("[data-learning=weak][aria-pressed=true]").waitFor();
  assert.equal(
    await first
      .locator("[data-learning=mastered]")
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.goto(base + "#weak-study");
  await page.locator("#flip").waitFor();
  await page.locator("#toggle-mastered").click();
  await page.getByText("まだ苦手単語はありません").waitFor();
  await page.goto(base + "#search");
  await page.locator("#word-search").fill("光");
  assert.equal(await page.locator(".result").count(), 1);
  assert.equal(
    await page.locator("[data-learning=mastered][aria-pressed=true]").count(),
    1,
  );
  await page.locator(".result-link").first().click();
  await page.locator("dialog .back").first().click();
  await page.locator("#list-tab[aria-selected=true]").waitFor();
  await page.locator("#lyrics-tab").click();
  assert.equal(await page.locator(".lyric").count(), 3);
  await page.locator("#cards-tab").click();
  for (let n = 0; n < 4; n++) {
    await page.locator("#toggle-mastered").click();
    if (n < 3)
      await page.waitForFunction(
        (n) =>
          document
            .querySelector("#song-stats")
            .textContent.includes(`覚えた ${n + 2} 単語`),
        n,
      );
  }
  await page.getByText("この曲の単語はすべて覚えました！").waitFor();
  assert.equal(await page.locator("#flip").count(), 0);
  await page.reload();
  await page.locator("#cards-tab").click();
  await page.getByText("この曲の単語はすべて覚えました！").waitFor();
  await page.locator("#list-tab").click();
  assert.equal(
    await page.locator("[data-learning=mastered][aria-pressed=true]").count(),
    5,
  );
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.goto(base + "#import");
  const d = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await d;
  await download.saveAs("/tmp/k-lyric-mastered.json");
  const backup = JSON.parse(
    await fs.readFile("/tmp/k-lyric-mastered.json", "utf8"),
  );
  assert.equal(backup.version, 3);
  assert.equal(backup.mastered.length, 5);
  assert.equal(backup.weak.length, 0);
  await page
    .locator("#restore-file")
    .setInputFiles("/tmp/k-lyric-mastered.json");
  await page.locator("#confirm-restore").click();
  await page.locator(".song-card").first().waitFor();
  await page.locator(".song-card").first().click();
  await page.locator("#cards-tab").click();
  await page.getByText("この曲の単語はすべて覚えました！").waitFor();
  // Version 1 files still restore without discarding songs or weak marks.
  const old = {
    ...backup,
    version: 1,
    weak: [
      JSON.stringify([
        backup.songs[0].cards[0].word,
        backup.songs[0].cards[0].pos,
        backup.songs[0].cards[0].meaning,
      ]),
    ],
  };
  delete old.mastered;
  await page.goto(base + "#import");
  await page.locator("#restore-file").setInputFiles({
    name: "v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.locator("#confirm-restore").click();
  await page.locator(".song-card").first().waitFor();
  await page.locator(".song-card").first().click();
  await page.locator("#cards-tab").click();
  await page.locator("#toggle-weak.active").waitFor();
  assert.match(
    await page.locator("#song-stats").textContent(),
    /覚えた 0 単語/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: legacy data migration, global mastered sync, exclusive toggles, next card, all mastered, counts, list/search editing, weak study, persistence, v3 backup and v1 restore, mobile widths.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
