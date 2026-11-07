// Run: PLAYWRIGHT_MODULE=/path/to/playwright node tests/e2e.cjs
// Serve /workspace on port 8000 before running. No production dependencies.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_URL || "http://127.0.0.1:8000/k-lyric/";
  const go = async (hash) => {
    await page.goto(base + "#" + hash);
    await page.locator("#main h1").waitFor();
  };
  await go("library");
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator(".song-card").count(), 1);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/k-lyric-library.png", fullPage: true });
  await page.locator(".song-card").click();
  assert.equal(await page.locator(".lyric").count(), 3);
  const originals = await page.locator(".lyrics .original").allTextContents();
  assert.equal(originals[0], originals[2]);
  await page.getByRole("tab", { name: "単語カード" }).click();
  await page.locator("#flip").click();
  await page.locator(".meaning").waitFor();
  assert.equal(await page.locator(".meaning").textContent(), "光");
  await page.locator("#toggle-weak").click();
  await page.locator("#toggle-weak.active").waitFor();
  await page.locator("#detail").click();
  assert.equal(await page.locator("dialog .example").count(), 1);
  await page.locator("#dialog-close").click();
  const sample = {
    song: 'Test " Song',
    artist: "テスト",
    lyrics: [
      { original: "빛이 와", translation: "光が来る" },
      { original: "Keep the light", translation: "光を保って" },
      { original: "빛이 와", translation: "光が来る" },
    ],
    cards: [
      {
        word: "빛",
        meaning: "光",
        pronunciation: "빋",
        pos: "名詞",
        examples: [
          {
            original_form: "빛이",
            original_lyric: "빛이 와",
            lyric_meaning: "光が来る",
            grammar: "빛 + 이。連音して 비치。",
          },
        ],
      },
    ],
  };
  await go("import");
  await page.locator("#json-input").fill("{");
  await page.locator("#import-song").click();
  await page.getByRole("alert").filter({ hasText: "JSONの書式" }).waitFor();
  await page
    .locator("#json-input")
    .fill(JSON.stringify({ ...sample, cards: "bad" }));
  await page.locator("#import-song").click();
  await page.locator("#import-error").filter({ hasText: "配列" }).waitFor();
  await page.locator("#json-input").fill(JSON.stringify(sample));
  await page.locator("#import-song").click();
  await page.locator(".lyric").first().waitFor();
  assert.deepEqual(
    await page.locator(".lyrics .original").allTextContents(),
    sample.lyrics.map((l) => l.original),
  );
  await page.locator("#cards-tab").click();
  assert.equal(
    await page.locator("#toggle-weak").getAttribute("aria-pressed"),
    "true",
  );
  await page.reload();
  await page.locator("#cards-tab").click();
  assert.equal(
    await page.locator("#toggle-weak").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#toggle-weak").click();
  await page.locator('#toggle-weak[aria-pressed="false"]').waitFor();
  await go("library");
  await page.locator(".song-card").first().click();
  await page.locator("#cards-tab").click();
  assert.equal(
    await page.locator("#toggle-weak").getAttribute("aria-pressed"),
    "false",
  );
  await page.locator("#toggle-weak").click();
  await page.locator("#toggle-weak.active").waitFor();
  await go("search");
  await page.locator("#word-search").fill("빛이");
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator(".result-link").last().click();
  await page.locator("dialog .back").last().click();
  assert.equal(await page.locator(".word").textContent(), "빛");
  await go("search");
  await page.locator("#word-search").fill("光");
  assert.equal(await page.locator(".result").count(), 1);
  await go("weak");
  assert.equal(await page.locator(".result").count(), 1);
  await page.locator("#study-weak").click();
  await page.locator("#flip").waitFor();
  assert.match(await page.locator("#main").textContent(), /1 \/ 1 WORDS/);
  await go("import");
  await page.locator("#json-input").fill(JSON.stringify(sample));
  await page.locator("#import-song").click();
  await page.locator("#overwrite").waitFor();
  await page.locator("#dialog-close").click();
  await page.locator("#import-song").click();
  await page.locator("#overwrite").click();
  await page.locator(".lyric").first().waitFor();
  await go("library");
  assert.equal(await page.locator(".song-card").count(), 2);
  await go("import");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  await download.saveAs("/tmp/k-lyric-test-backup.json");
  const backup = JSON.parse(
    await fs.readFile("/tmp/k-lyric-test-backup.json", "utf8"),
  );
  assert.equal(backup.songs.length, 2);
  assert.equal(backup.weak.length, 1);
  await page.locator("#restore-file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"app":"K-LYRIC","version":1,"songs":[],"weak":["invalid"]}',
    ),
  });
  await page
    .locator("#backup-error")
    .filter({ hasText: "正しくありません" })
    .waitFor();
  await page
    .locator("#restore-file")
    .setInputFiles("/tmp/k-lyric-test-backup.json");
  await page.locator("#confirm-restore").waitFor();
  await page.locator("#dialog-close").click();
  await go("library");
  assert.equal(await page.locator(".song-card").count(), 2);
  await page.locator(".song-card").first().click();
  await page.locator("#delete-song").click();
  await page.locator("#confirm-delete").click();
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator(".song-card").count(), 1);
  await go("import");
  await page
    .locator("#restore-file")
    .setInputFiles("/tmp/k-lyric-test-backup.json");
  await page.locator("#confirm-restore").click();
  await page.locator(".song-card").first().waitFor();
  assert.equal(await page.locator(".song-card").count(), 2);
  // Imported text is never interpreted as markup.
  sample.song = "<img src=x onerror=alert(1)>";
  await go("import");
  await page.locator("#json-input").fill(JSON.stringify(sample));
  await page.locator("#import-song").click();
  await page.locator(".lyric").first().waitFor();
  assert.equal(await page.locator("#main img").count(), 0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator("#main h1").waitFor();
  assert.equal(
    await page.evaluate(() => !!navigator.serviceWorker.controller),
    true,
  );
  await context.setOffline(true);
  await page.reload();
  await page.locator("#main h1").waitFor();
  await page.locator("#cards-tab").click();
  await page.locator("#flip").click();
  assert.equal(await page.locator(".meaning").textContent(), "光");
  await go("library");
  assert.equal(await page.locator(".song-card").count(), 3);
  await context.setOffline(false);
  for (const width of [320, 375, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow ${width}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile layout, import validation, duplicate overwrite, ordered lyrics, flip/details, global weak sync, search navigation, persistence, backup/restore/cancel, delete, XSS escaping, subpath, offline.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
