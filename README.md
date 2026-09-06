# 高校数学 インタラクティブツール

高校数学（数学I・A・II・B・III・C）の全単元を対象に、係数や点を動かして理解を確かめる
インタラクティブ教材を集めた静的サイトです。授業での提示、家庭教師での説明、高校生の自習を想定しています。

- ビルド不要。`index.html` をブラウザで開くだけで動きます（`file://` でも動作）。
- 数式表示の [KaTeX](https://katex.org/) は同梱しているため、CDN が使えない環境でも表示できます。
- 各ページの「拡大表示」で教室投影向けに文字を大きくできます。タブは URL のハッシュに対応しています。

## 収録ツール

| 科目 | ページ | 内容 |
| --- | --- | --- |
| 数学I | `tools/numbers-expressions.html` | 展開・因数分解の面積モデル、絶対値、集合とベン図、命題と条件 |
| 数学I | `tools/quadratic.html` | 平方完成と頂点、区間の最大・最小、判別式、二次不等式 |
| 数学I | `tools/trig-ratio.html` | 単位円、直角三角形、正弦定理、余弦定理と面積 |
| 数学I | `tools/data-analysis.html` | ヒストグラム、箱ひげ図、分散・標準偏差、散布図と相関係数 |
| 数学A | `tools/counting.html` | 順列・組合せ、パスカルの三角形、最短経路、円順列・重複組合せ |
| 数学A | `tools/probability.html` | 大数の法則、反復試行、条件付き確率、期待値 |
| 数学A | `tools/geometry.html` | 三角形の五心、チェバ・メネラウス、円の性質、方べきの定理 |
| 数学A | `tools/integers.html` | 互除法、一次不定方程式、素因数分解、合同式・n 進法 |
| 数学II | `tools/equations.html` | 二項定理、相加相乗平均、解と係数の関係、因数定理 |
| 数学II | `tools/coordinate-geometry.html` | 直線、内分・外分、円と直線、軌跡と領域 |
| 数学II | `tools/trig-functions.html` | 単位円とグラフ、グラフの変形、加法定理・合成、三角方程式 |
| 数学II | `tools/exp-log.html` | 指数関数、対数関数、対数の性質、方程式と桁数 |
| 数学II | `tools/calculus-2.html` | 接線、導関数と増減、極値と解の個数、定積分と面積 |
| 数学B | `tools/sequences.html` | 等差・等比、Σ、階差数列、漸化式、数学的帰納法 |
| 数学B | `tools/statistics-inference.html` | 確率分布、二項分布と正規分布、標本平均、信頼区間・検定 |
| 数学C | `tools/vectors.html` | 和・差、内積、分解、位置ベクトル、空間ベクトル |
| 数学C | `tools/complex-plane.html` | 極形式、積と商、ド・モアブル・n 乗根、図形への応用 |
| 数学C | `tools/conics.html` | 放物線、楕円、双曲線、媒介変数、極座標 |
| 数学III | `tools/limits.html` | 数列の極限、関数の極限、無限級数、e |
| 数学III | `tools/calculus-3-diff.html` | 導関数、合成関数・媒介変数、平均値の定理、概形、速度・加速度 |
| 数学III | `tools/calculus-3-int.html` | 区分求積、置換積分、面積、回転体の体積、曲線の長さ |

## GitHub Pages で公開する

リポジトリの Settings → Pages で Source を **GitHub Actions** にすると、`main` への push ごとに
`.github/workflows/pages.yml` がサイトを配信します。Source を「Deploy from a branch」にして
ルートを公開しても動作します（`.nojekyll` を置いてあります）。

## 開発

構成と規約、`Plot` / `UI` の API は [`CLAUDE.md`](CLAUDE.md) を参照してください。
新しいツールは `tools/quadratic.html` を雛形にして作り、`index.html` にカードを追加します。

ローカル確認は任意の静的サーバーで行えます。

```sh
python3 -m http.server 8000
# http://localhost:8000/
```

## ライセンス

- このリポジトリのコードと文章: MIT License
- 同梱の KaTeX: MIT License（`assets/vendor/katex/LICENSE`）
