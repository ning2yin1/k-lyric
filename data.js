export const demo = {
  song: "小さな光 · 작은 빛",
  artist: "K-LYRIC ORIGINAL",
  lyrics: [
    {
      original: "오늘도 작은 빛이 나를 찾아와",
      translation: "今日も小さな光が私のもとへやってくる",
    },
    {
      original: "너와 함께 천천히 걸어",
      translation: "あなたと一緒にゆっくり歩く",
    },
    {
      original: "오늘도 작은 빛이 나를 찾아와",
      translation: "今日も小さな光が私のもとへやってくる",
    },
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
          original_lyric: "오늘도 작은 빛이 나를 찾아와",
          lyric_meaning: "今日も小さな光が私のもとへやってくる",
          grammar:
            "빛（光）に主格助詞 이 が付きます。빛 単独の発音は [빋]、빛이 は連音して [비치] と発音します。",
        },
      ],
    },
    {
      word: "작다",
      meaning: "小さい",
      pronunciation: "작따",
      pos: "形容詞",
      examples: [
        {
          original_form: "작은",
          original_lyric: "오늘도 작은 빛이 나를 찾아와",
          lyric_meaning: "今日も小さな光が私のもとへやってくる",
          grammar:
            "語幹 작- に連体形語尾 -은 が付き、後ろの名詞 빛 を修飾します。작은 は [자근] と発音します。",
        },
      ],
    },
    {
      word: "함께",
      meaning: "一緒に",
      pronunciation: "함께",
      pos: "副詞",
      examples: [
        {
          original_form: "함께",
          original_lyric: "너와 함께 천천히 걸어",
          lyric_meaning: "あなたと一緒にゆっくり歩く",
          grammar:
            "함께 は副詞で形は変わりません。너와 の 와 は「〜と」を表す助詞です。",
        },
      ],
    },
    {
      word: "걷다",
      meaning: "歩く",
      pronunciation: "걷따",
      pos: "動詞",
      examples: [
        {
          original_form: "걸어",
          original_lyric: "너와 함께 천천히 걸어",
          lyric_meaning: "あなたと一緒にゆっくり歩く",
          grammar:
            "걷다 は ㄷ 不規則活用です。母音で始まる -어 が付くと ㄷ が ㄹ に変わり、걸어 になります。ここでは親しい話し方の終結形です。",
        },
      ],
    },
    {
      word: "천천히",
      meaning: "ゆっくり",
      pronunciation: "천천히",
      pos: "副詞",
      examples: [
        {
          original_form: "천천히",
          original_lyric: "너와 함께 천천히 걸어",
          lyric_meaning: "あなたと一緒にゆっくり歩く",
          grammar: "動詞 걸어 を修飾する副詞です。助詞や語尾は付きません。",
        },
      ],
    },
  ],
};
export const template = `以下のK-POP歌詞を韓国語学習アプリ「K-LYRIC」に取り込めるJSONに変換してください。

【解析ルール】
1. 韓国語の名詞・代名詞・動詞・形容詞・副詞などを抽出してください。
2. 動詞・形容詞は辞書形に統一してください。
3. 助詞・語尾は単独の単語カードにせず、詳細解説に含めてください。
4. 英語単語はカード化しないでください。ただし原文と日本語訳には残してください。
5. 各単語の日本語の意味、品詞、実際の発音を記載してください。
6. 発音はハングルで記載し、カタカナ・ローマ字は使用しないでください。
7. 歌詞で登場した活用形と、その仕組みを説明してください。
8. 各単語の登場箇所の原文と自然な日本語訳を記載してください。
9. 同じ曲の同じ辞書形・同じ品詞の単語は原則1枚のカードにまとめ、登場箇所はexamplesに複数記録してください。
10. 歌詞全文を元の順番のままlyrics配列に記録し、繰り返しも省略しないでください。
11. 歌詞にない単語や表現は追加しないでください。
12. JSONのみを出力してください。コードフェンスや説明文は不要です。
13. JSONの文字列は適切にエスケープしてください。

【JSON形式】
{
  "song": "曲名",
  "artist": "アーティスト名",
  "lyrics": [{"original": "歌詞の原文1行", "translation": "自然な日本語訳"}],
  "cards": [{
    "word": "辞書形",
    "meaning": "日本語の意味",
    "pronunciation": "実際の発音をハングルで",
    "pos": "品詞",
    "examples": [{
      "original_form": "歌詞に登場した形",
      "original_lyric": "該当する歌詞の原文",
      "lyric_meaning": "自然な日本語訳",
      "grammar": "活用・助詞・語尾・文法の解説"
    }]
  }]
}

【曲名】

【アーティスト名】

【歌詞】`;
