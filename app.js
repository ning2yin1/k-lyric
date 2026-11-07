import { demo, template } from "./data.js";
import {
  normalize,
  toggleLearningState,
  learningStatus,
  migrateLearningState,
  wordKey,
  songKey,
  validateSong,
  validateBackup,
  parseJSON,
  openStore,
  saveStore,
} from "./store.js";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  dialog = $("#dialog");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state = {
    songs: [],
    weak: [],
    mastered: [],
    learningVersion: 3,
    initialized: true,
  },
  cardIndex = 0,
  flipped = false,
  currentMode = "lyrics",
  queue = [],
  currentSong = null,
  route = "",
  toastTimer,
  busy = false,
  wordFilter = "all",
  updateWords = null;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function showDialog(html) {
  $("#dialog-body").innerHTML = html;
  dialog.showModal();
}
$("#dialog-close").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
async function commit(next) {
  await saveStore(next);
  state = next;
}
async function safe(action) {
  if (busy) return;
  busy = true;
  try {
    await action();
  } catch (e) {
    toast(
      `保存できませんでした。${e.message} バックアップを保存し、空き容量を確認してください。`,
    );
  } finally {
    busy = false;
  }
}
const isWeak = (c) => learningStatus(state, c) === "weak";
const isMastered = (c) => learningStatus(state, c) === "mastered";
const allCards = () =>
  state.songs.flatMap((song) =>
    song.cards.map((card, index) => ({ song, card, index })),
  );
const empty = (title, description, link = true) =>
  `<div class="empty"><b>♫</b><h3>${title}</h3><p>${description}</p>${link ? '<a href="#import">曲を取り込む →</a>' : ""}</div>`;
function intro(eyebrow, title, description, action = "") {
  return `<div class="intro"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function songTile(s, i) {
  return `<a class="song-card" href="#song/${encodeURIComponent(s.id)}"><div class="album" aria-hidden="true">${["♫", "♬", "♪"][i % 3]}</div><div class="song-info"><h3>${esc(s.song)}</h3><p>${esc(s.artist)}</p><div class="pills"><span class="pill">${s.cards.length} 単語</span><span class="pill pink">♡ ${s.cards.filter(isWeak).length} 苦手</span></div></div></a>`;
}
function library() {
  main.innerHTML =
    intro(
      "YOUR MUSIC, YOUR WORDS",
      "マイライブラリ",
      "好きな歌詞から、韓国語を少しずつ。",
      '<button class="pink-button" id="add-song">＋ 曲を追加</button>',
    ) +
    `<section class="hero"><div class="music-art" aria-hidden="true">♫</div><h2>好きな曲が、<br>わたしの教科書に。</h2><p>歌詞を読んで、ことばを集めて。<br>あなたのペースで、もっと近くへ。</p><small>LISTEN · READ · LEARN</small></section><div class="search-wrap"><input id="library-search" type="search" placeholder="曲名・アーティストで検索" aria-label="曲名・アーティストで検索"></div><div class="section-title"><h2>すべての曲</h2><span class="count" id="song-count"></span></div><div class="song-grid" id="songs"></div><p class="footer-note">あなただけのライブラリ。データはこの端末の中に。</p>`;
  $("#add-song").onclick = () => (location.hash = "import");
  const update = () => {
    const q = normalize($("#library-search").value),
      songs = state.songs.filter((s) =>
        normalize(s.song + " " + s.artist).includes(q),
      );
    $("#song-count").textContent = `${songs.length} SONGS`;
    $("#songs").innerHTML =
      songs.map(songTile).join("") ||
      empty(
        "まだ曲がありません",
        q
          ? "検索することばを変えてみてください。"
          : "お気に入りの一曲から、はじめましょう。",
        !q,
      );
  };
  $("#library-search").oninput = update;
  update();
}
function renderSong(id, target) {
  currentSong = state.songs.find((s) => s.id === id);
  if (!currentSong) {
    main.innerHTML = empty(
      "曲が見つかりません",
      "ライブラリから曲を選び直してください。",
      false,
    );
    return;
  }
  if (target !== undefined) {
    currentMode =
      currentSong.cards[Number(target)] &&
      isMastered(currentSong.cards[Number(target)])
        ? "list"
        : "cards";
  }
  queue = currentSong.cards
    .map((card, index) => ({ card, song: currentSong, index }))
    .filter((x) => !isMastered(x.card));
  if (target !== undefined)
    cardIndex = Math.max(
      0,
      queue.findIndex((x) => x.index === Number(target)),
    );
  main.innerHTML =
    `<a href="#library" class="back">← ライブラリ</a>` +
    intro(
      "IN YOUR LYRICS",
      esc(currentSong.song),
      `${esc(currentSong.artist)}`,
    ) +
    `<div id="song-stats" class="pills" aria-live="polite"></div><div class="tabs" role="tablist" aria-label="表示モード"><button id="lyrics-tab" role="tab" class="${currentMode === "lyrics" ? "selected" : ""}" aria-selected="${currentMode === "lyrics"}">歌詞</button><button id="cards-tab" role="tab" class="${currentMode === "cards" ? "selected" : ""}" aria-selected="${currentMode === "cards"}">単語カード</button><button id="list-tab" role="tab" class="${currentMode === "list" ? "selected" : ""}" aria-selected="${currentMode === "list"}">単語一覧</button></div><div id="song-content"></div><div class="row between"><p class="notice">歌詞・使用例は、この曲だけに保存されます。</p><button id="delete-song" class="text-button">曲を削除</button></div>`;
  $("#lyrics-tab").onclick = () => {
    currentMode = "lyrics";
    renderSong(id);
  };
  $("#cards-tab").onclick = () => {
    currentMode = "cards";
    renderSong(id);
  };
  updateSongStats();
  $("#list-tab").onclick = () => {
    currentMode = "list";
    renderSong(id);
  };
  if (currentMode === "list") {
    $("#song-content").innerHTML =
      currentSong.cards
        .map((card, index) => resultTile({ card, song: currentSong, index }))
        .join("") ||
      empty(
        "単語がありません",
        "この曲にはカードが登録されていません。",
        false,
      );
  } else if (currentMode === "lyrics")
    $("#song-content").innerHTML =
      `<div class="lyrics">${currentSong.lyrics.map((l) => `<div class="lyric"><p class="original" lang="ko">${esc(l.original)}</p><p class="translation">${esc(l.translation)}</p></div>`).join("")}</div>`;
  else renderCard($("#song-content"));
  $("#delete-song").onclick = () => {
    showDialog(
      `<h2>この曲を削除しますか？</h2><p>${esc(currentSong.song)} の歌詞とカードを削除します。必要なら先にバックアップしてください。共通の苦手マークは保持されます。</p><button id="confirm-delete" class="danger">この曲を削除</button>`,
    );
    $("#confirm-delete").onclick = () =>
      safe(async () => {
        await commit({
          ...state,
          songs: state.songs.filter((s) => s.id !== id),
        });
        dialog.close();
        location.hash = "library";
        toast("曲を削除しました");
      });
  };
}
function updateSongStats() {
  if (!$("#song-stats")) return;
  const learned = currentSong.cards.filter(isMastered).length;
  $("#song-stats").innerHTML =
    `<span class="pill">登録 ${currentSong.cards.length} 単語</span><span class="pill learned">✓ 覚えた ${learned} 単語</span><span class="pill">未習得 ${currentSong.cards.length - learned} 単語</span>`;
}
function renderCard(container) {
  if (!queue.length) {
    if (route === "song" && currentSong.cards.length) {
      container.innerHTML = empty(
        "この曲の単語はすべて覚えました！",
        "単語一覧からいつでも見直せます。",
        false,
      );
      return;
    }
    container.innerHTML = empty(
      "カードがありません",
      "カードが含まれた曲を取り込んでください。",
    );
    return;
  }
  cardIndex = Math.max(0, Math.min(cardIndex, queue.length - 1));
  const { card, song } = queue[cardIndex];
  container.innerHTML = `<div class="row between"><span class="count">${cardIndex + 1} / ${queue.length} WORDS</span><div class="state-buttons"><button class="weak-toggle ${isWeak(card) ? "active" : ""}" id="toggle-weak" aria-pressed="${isWeak(card)}">${isWeak(card) ? "♥ 苦手に登録済み" : "♡ 苦手に登録"}</button><button class="mastered-toggle" id="toggle-mastered" aria-pressed="false">✓ 覚えた</button></div></div><button class="flashcard ${flipped ? "flipped" : ""}" id="flip" aria-label="${flipped ? "カードの表面を表示" : "カードの裏面を表示"}">${flipped ? `<small>MEANING</small><span class="meaning">${esc(card.meaning)}</span><span class="pron" lang="ko">[ ${esc(card.pronunciation)} ]</span><span class="pill">${esc(card.pos)}</span>` : `<small>KOREAN WORD</small><span class="word" lang="ko">${esc(card.word)}</span>`}<small>タップして${flipped ? "表" : "裏"}を見る ↻</small></button><p class="count" style="text-align:center">${esc(song.song)} · ${esc(song.artist)}</p><div class="card-controls"><button id="prev" class="secondary" ${cardIndex === 0 ? "disabled" : ""} aria-label="前のカード">← 前へ</button><button id="detail" class="text-button">詳しい解説 ↗</button><button id="next" class="secondary" ${cardIndex === queue.length - 1 ? "disabled" : ""} aria-label="次のカード">次へ →</button></div>`;
  $("#flip").onclick = () => {
    flipped = !flipped;
    renderCard(container);
  };
  $("#prev").onclick = () => {
    cardIndex--;
    flipped = false;
    renderCard(container);
  };
  $("#next").onclick = () => {
    cardIndex++;
    flipped = false;
    renderCard(container);
  };
  const setCardState = (kind) =>
    safe(async () => {
      const previous = queue[cardIndex];
      await commit(toggleLearningState(state, card, kind));
      flipped = false;
      if (route === "weak-study") weakPage();
      else {
        queue = currentSong.cards
          .map((card, index) => ({ card, song: currentSong, index }))
          .filter((x) => !isMastered(x.card));
        // Prefer the next original position; wrap to earlier remaining cards at the end.
        if (kind === "mastered") {
          const next = queue.findIndex((x) => x.index > previous.index);
          cardIndex = next >= 0 ? next : 0;
        }
        updateSongStats();
        renderCard(container);
      }
      toast(
        kind === "mastered"
          ? "全曲共通で覚えたに変更しました"
          : "苦手マークを更新しました",
      );
    });
  $("#toggle-weak").onclick = () => setCardState("weak");
  $("#toggle-mastered").onclick = () => setCardState("mastered");
  $("#detail").onclick = () =>
    showDialog(
      `<span class="eyebrow">WORD NOTES</span><h2 lang="ko">${esc(card.word)}</h2><p>${esc(card.meaning)} · ${esc(card.pos)}</p>${card.examples.map((e, i) => `<section class="example"><small>使用例 ${i + 1}</small><p lang="ko"><strong>${esc(e.original_form)}</strong></p><p class="original" lang="ko">${esc(e.original_lyric)}</p><p class="translation">${esc(e.lyric_meaning)}</p><p class="grammar">${esc(e.grammar)}</p></section>`).join("")}`,
    );
}
function resultTile({ card, song, index }, entries = null) {
  const meanings = entries
    ? [...new Set(entries.map((x) => x.card.meaning))].join(" ／ ")
    : card.meaning;
  const sources = entries
    ? [...new Set(entries.map((x) => x.song.song + " / " + x.song.artist))]
    : [song.song + " / " + song.artist];
  return `<article class="result" data-song="${esc(song.id)}" data-index="${index}"><a class="result-link" ${entries ? 'data-word-detail="true"' : ""} href="#song/${encodeURIComponent(song.id)}/${index}"><strong lang="ko">${esc(card.word)}</strong><span class="meaning">　${esc(meanings)}</span><small>${esc(card.pos)} · ${sources.map(esc).join("<br>")}</small><span class="learning-status">${isMastered(card) ? "✓ 覚えた" : isWeak(card) ? "♡ 苦手" : "未設定"}</span></a><div class="state-buttons"><button data-learning="weak" class="weak-toggle ${isWeak(card) ? "active" : ""}" aria-pressed="${isWeak(card)}" aria-label="${esc(card.word)}の苦手状態を切り替え">♡ 苦手</button><button data-learning="mastered" class="mastered-toggle ${isMastered(card) ? "active" : ""}" aria-pressed="${isMastered(card)}" aria-label="${esc(card.word)}の覚えた状態を切り替え">✓ 覚えた</button></div></article>`;
}
main.addEventListener("click", (e) => {
  const button = e.target.closest("[data-learning]");
  if (!button) return;
  const tile = button.closest(".result");
  const song = state.songs.find((s) => s.id === tile.dataset.song);
  const card = song?.cards[Number(tile.dataset.index)];
  if (!card) return;
  safe(async () => {
    await commit(toggleLearningState(state, card, button.dataset.learning));
    if (["words", "weak", "search"].includes(route)) updateWords();
    else {
      // Update all matching results without losing the search input or scroll position.
      main.querySelectorAll(".result").forEach((row) => {
        const song = state.songs.find((s) => s.id === row.dataset.song),
          index = Number(row.dataset.index);
        row.outerHTML = resultTile({ card: song.cards[index], song, index });
      });
      updateSongStats();
    }
    toast("全曲共通の学習状態を更新しました");
  });
});
function weakPage() {
  const entries = allCards().filter((x) => isWeak(x.card));
  main.innerHTML = intro(
    "A LITTLE MORE PRACTICE",
    "苦手単語の学習",
    "全曲の苦手単語を、もう一度。",
    '<button class="pink-button" id="weak-mode">単語一覧へ</button>',
  );
  const seen = new Set();
  queue = entries.filter((x) => {
    const key = wordKey(x.card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  main.innerHTML += queue.length
    ? '<div id="weak-cards"></div><p class="notice">同じ単語は1枚にまとめています。全曲の使用例は単語一覧から確認できます。</p>'
    : empty(
        "まだ苦手単語はありません",
        "単語一覧から苦手を登録できます。",
        false,
      );
  if (queue.length) renderCard($("#weak-cards"));
  $("#weak-mode").onclick = () => (location.hash = "words");
}
function wordGroups() {
  const groups = new Map();
  for (const entry of allCards()) {
    const key = wordKey(entry.card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()];
}
function wordsPage() {
  main.innerHTML =
    intro(
      "ALL YOUR WORDS",
      "単語一覧",
      "すべての曲のことばを、ひとつの場所で。",
    ) +
    `<div class="search-wrap"><input id="word-search" type="search" placeholder="辞書形・活用形・日本語の意味" aria-label="単語を検索"></div>
    <div class="tabs word-filters" aria-label="単語の絞り込み"><button data-filter="all">すべて</button><button data-filter="weak">♡ 苦手</button><button data-filter="mastered">✓ 覚えた</button></div>
    <div class="row between"><span id="word-count" class="count" aria-live="polite"></span><button id="study-weak" class="pink-button">♡ 苦手だけ学習</button></div><div id="results"></div>`;
  updateWords = () => {
    const q = normalize($("#word-search").value);
    const groups = wordGroups().filter(
      (entries) =>
        (wordFilter === "all" ||
          learningStatus(state, entries[0].card) === wordFilter) &&
        (!q ||
          entries.some(({ card: c }) =>
            [c.word, c.meaning, ...c.examples.map((e) => e.original_form)].some(
              (v) => normalize(v).includes(q),
            ),
          )),
    );
    $("#word-count").textContent = `${groups.length} 単語`;
    main.querySelectorAll("[data-filter]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.filter === wordFilter);
      b.setAttribute("aria-pressed", b.dataset.filter === wordFilter);
    });
    $("#results").innerHTML =
      groups.map((entries) => resultTile(entries[0], entries)).join("") ||
      empty(
        "該当する単語はありません",
        "検索や絞り込みを変更してください。",
        false,
      );
    $("#study-weak").disabled = !allCards().some((x) => isWeak(x.card));
  };
  $("#word-search").oninput = updateWords;
  main.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        wordFilter = b.dataset.filter;
        updateWords();
      }),
  );
  $("#study-weak").onclick = () => (location.hash = "weak-study");
  updateWords();
}
main.addEventListener("click", (e) => {
  const link = e.target.closest("[data-word-detail]");
  if (!link) return;
  e.preventDefault();
  const tile = link.closest(".result"),
    song = state.songs.find((s) => s.id === tile.dataset.song),
    card = song.cards[Number(tile.dataset.index)];
  const entries = allCards().filter((x) => wordKey(x.card) === wordKey(card));
  showDialog(
    `<span class="eyebrow">ALL SONG EXAMPLES</span><h2 lang="ko">${esc(card.word)}</h2>${entries.map(({ card: c, song, index }) => `<section class="example"><h3>${esc(song.song)}</h3><small>${esc(song.artist)} · ${esc(c.pos)}</small><p>${esc(c.meaning)}</p>${c.examples.map((ex) => `<p lang="ko"><strong>${esc(ex.original_form)}</strong> · ${esc(ex.original_lyric)}</p><p class="translation">${esc(ex.lyric_meaning)}</p><p class="grammar">${esc(ex.grammar)}</p>`).join("")}<a class="back" href="#song/${encodeURIComponent(song.id)}/${index}">この曲で確認 →</a></section>`).join("")}`,
  );
});
function importPage() {
  main.innerHTML =
    intro(
      "ADD A NEW FAVORITE",
      "曲を取り込む",
      "ChatGPTで解析して、あなただけのライブラリへ。",
    ) +
    `<section class="panel"><span class="step">STEP 1</span><h2>歌詞を、学びのかたちに。</h2><p>テンプレートをChatGPTに貼り付け、末尾に曲名・アーティスト名・歌詞を入力してください。</p><button class="pink-button" id="copy-template">解析テンプレートをコピー</button><p class="notice">解析結果には誤りが含まれる場合があります。内容を確認してご利用ください。</p></section><section class="panel"><span class="step">STEP 2</span><h2>JSONを貼り付け</h2><p>ChatGPTが出力したJSONを、そのまま貼り付けてください。</p><label for="json-input" class="count">解析結果のJSON</label><textarea id="json-input" spellcheck="false" autocapitalize="off" placeholder='{"song": "曲名", "artist": "アーティスト名", …}'></textarea><p id="import-error" class="error" role="alert"></p><button id="import-song">ライブラリに取り込む →</button></section><section class="panel"><span class="step">KEEP YOUR LIBRARY SAFE</span><h2>バックアップと復元</h2><p>全曲と苦手マークをJSONファイルで保存できます。Safariのデータ消去や機種変更に備え、定期的に保存しましょう。</p><div class="row"><button id="export" class="secondary">↓ バックアップを保存</button><label class="file-label" for="restore-file">↑ ファイルから復元</label><input id="restore-file" type="file" accept="application/json,.json" hidden></div><p id="backup-error" class="error" role="alert"></p></section><section class="panel"><h2>いつも、ホーム画面に。</h2><p>iPhoneのSafariで「共有」→「ホーム画面に追加」。一度読み込めば、基本機能はオフラインでも使えます。</p></section><p class="notice">歌詞データはこのブラウザ内にのみ保存されます。アプリから外部への送信はありません。ChatGPTへの歌詞入力は、ご自身の操作で行ってください。</p>`;
  $("#copy-template").onclick = async () => {
    try {
      await navigator.clipboard.writeText(template);
      toast("テンプレートをコピーしました");
    } catch {
      showDialog(
        '<h2>テンプレートをコピー</h2><p>下の文章を選択してコピーしてください。</p><textarea id="template-fallback" readonly aria-label="解析テンプレート"></textarea>',
      );
      $("#template-fallback").value = template;
      $("#template-fallback").select();
    }
  };
  $("#import-song").onclick = () => {
    try {
      const song = validateSong(parseJSON($("#json-input").value));
      const existing = state.songs.find((s) => songKey(s) === songKey(song));
      if (existing) {
        showDialog(
          `<h2>この曲を上書きしますか？</h2><p>${esc(song.song)} / ${esc(song.artist)} は登録済みです。歌詞とカードを置き換えます。共通の苦手マークは保持されます。</p><button id="overwrite" class="pink-button">上書きする</button>`,
        );
        $("#overwrite").onclick = () =>
          safe(async () => {
            await saveSong(song, existing.id);
            dialog.close();
          });
      } else safe(() => saveSong(song));
    } catch (e) {
      $("#import-error").textContent = e.message;
    }
  };
  $("#export").onclick = exportBackup;
  $("#restore-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("ファイルは20MB以下にしてください。");
      const next = validateBackup(parseJSON(await file.text()));
      showDialog(
        `<h2>バックアップを復元しますか？</h2><p>${next.songs.length} 曲・${next.weak.length} 個の苦手マーク・${next.mastered.length} 個の覚えたマークを復元します。</p><p class="notice">現在の ${state.songs.length} 曲をすべて置き換えます。必要なデータは先にバックアップしてください。</p><button id="confirm-restore" class="pink-button">この内容で復元する</button>`,
      );
      $("#confirm-restore").onclick = () =>
        safe(async () => {
          await commit(next);
          dialog.close();
          location.hash = "library";
          toast("バックアップを復元しました");
        });
    } catch (err) {
      $("#backup-error").textContent = err.message;
    } finally {
      e.target.value = "";
    }
  };
}
async function saveSong(song, id = crypto.randomUUID()) {
  const next = { ...song, id };
  await commit({
    ...state,
    songs: [...state.songs.filter((s) => s.id !== id), next],
  });
  location.hash = `song/${id}`;
  currentMode = "lyrics";
  toast("曲をライブラリに追加しました");
}
function exportBackup() {
  const keys = new Set(allCards().map((x) => wordKey(x.card)));
  const backup = {
    app: "K-LYRIC",
    version: 3,
    exportedAt: new Date().toISOString(),
    songs: state.songs.map(({ id, ...song }) => song),
    weak: state.weak.filter((k) => keys.has(k)),
    mastered: state.mastered.filter((k) => keys.has(k)),
    ...(state.learningMigration
      ? { learningMigration: state.learningMigration }
      : {}),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `k-lyric-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast("保存を開始しました。「ファイル」で確認してください");
}
function render() {
  if (dialog.open) dialog.close();
  const parts = location.hash.slice(1).split("/");
  route = parts[0] || "library";
  cardIndex = 0;
  flipped = false;
  currentMode = "lyrics";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active =
      a.dataset.nav ===
      (route === "song"
        ? "library"
        : ["weak-study", "weak", "search"].includes(route)
          ? "words"
          : route);
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (route === "song")
    renderSong(decodeURIComponent(parts[1] || ""), parts[2]);
  else if (route === "weak-study") weakPage();
  else if (["words", "weak", "search"].includes(route)) {
    wordFilter = route === "weak" ? "weak" : "all";
    wordsPage();
  } else if (route === "import") importPage();
  else library();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}
window.addEventListener("hashchange", render);
try {
  const saved = await openStore();
  if (saved) {
    state = migrateLearningState(saved);
    if (state !== saved) await saveStore(state);
  } else {
    state.songs = [{ ...validateSong(demo), id: crypto.randomUUID() }];
    await saveStore(state);
  }
  render();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
} catch (e) {
  main.innerHTML =
    '<section class="panel"><h1>保存領域を開けませんでした</h1><p>Safariのプライベートブラウズや空き容量を確認し、再読み込みしてください。既存データは消去していません。</p><button id="retry">再読み込み</button></section>';
  $("#retry").onclick = () => location.reload();
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .catch(() =>
      toast(
        "オフラインの準備ができませんでした。オンラインで再読み込みしてください。",
      ),
    );
// iOS Safari: suppress accidental gesture zoom while preserving regular scrolling.
document.addEventListener("gesturestart", (e) => e.preventDefault(), {
  passive: false,
});
