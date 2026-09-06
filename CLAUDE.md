# math-tools — 高校数学 インタラクティブツール

高校数学（数学I・A・II・B・III・C）の各単元について、理解を助けるインタラクティブなツールを
静的サイトとして提供する。GitHub Pages にそのまま置けるよう、ビルド工程・依存パッケージは持たない。

## 構成

```
index.html              単元一覧（ハブ）
tools/<slug>.html       ツール本体（1 単元 = 1 ページ、タブで小単元を切り替える）
assets/style.css        デザイントークンと共通 UI（紙のような地 + 意味を持つ色）
assets/plot.js          Canvas 座標平面ライブラリ (global `Plot`)
assets/ui.js            ヘッダー・スライダー・タブ・KaTeX などの部品 (global `UI`)
assets/vendor/katex/    KaTeX（同梱。CDN に依存しない）
```

## ツールページの規約

- ファイル名・ID は簡潔な英語。ページ内の文章は日本語。数式は KaTeX（`$...$` / `$$...$$`）。
- 各ページは `tools/quadratic.html` を雛形にする。`<head>` の読み込み順、`UI.header({unit, title})`、
  `UI.tabs('#tabs', [...])`、`section.tool-body[data-tab]` + `.layout` (`aside.controls` + `.stage`) の構造を踏襲する。
- スクリプトは `defer` で読み込み、ページ側のコードは `DOMContentLoaded` で始める。
- タブごとに IIFE で状態を閉じ込め、`draw()` 一つで canvas と読み取り欄 (`.readout`) を更新する。
- 数式や説明を innerHTML で更新したら `UI.texAll(el)` を呼ぶ。
- 各タブの下に「見方」(`.explain`) を置き、教科書的な要点を `note`（ink/sage/ochre/clay）と箇条書きで示す。
  「何を動かすと何が見えるか」を具体的に書く。
- 色は意味で使う：ink = 主役の関数・情報、clay = 注目点・問題（頂点、交点など）、
  sage = 結果・成立（最大値、解、成功）、ochre = ユーザーが決めるもの（区間、パラメータ点）。
- 「拡大表示」（`body.projector`）で教室投影にも耐えるよう、canvas 内の文字は 13px 以上。
- コメントは節見出し程度に留める。自己言及的なコメントやコメントアウトしたコードは残さない。

## Plot API（assets/plot.js）

```js
const plot = new Plot('#canvas', { xmin, xmax, ymin, ymax, equal: true, aspect: 0.62, height,
                                    grid, axes, ticks, xLabel, yLabel, xTick, yTick, xTickFormat });
plot.render((P) => { ... });        // 描画関数を登録して描く。以降 plot.draw() で再描画
plot.setView(xmin, xmax, ymin, ymax);
P.fn(f, {color, width, dash, alpha, domain:[a,b]})     // y = f(x)
P.param(fx, fy, t0, t1, {close, fill})                 // 媒介変数
P.polar(fr, t0, t1)                                    // 極方程式
P.implicit(F)                                          // F(x,y)=0
P.region((x,y)=>bool, {fill})                          // 不等式の領域
P.segment(x1,y1,x2,y2) / P.line(x0,y0,dx,dy) / P.lineABC(a,b,c) / P.vline(x) / P.hline(y)
P.arrow(x1,y1,x2,y2) / P.point(x,y,{color,r,hollow,label,dx,dy}) / P.circle(cx,cy,r,{fill})
P.arc(cx,cy,r,a0,a1,{sector,fill}) / P.angleMark(vx,vy,ax,ay,bx,by,{r,label,right})
P.polygon(pts,{fill,open}) / P.rect(x,y,w,h) / P.fillBetween(f,g,a,b,{fill})
P.text(x,y,str,{color,align,baseline,dx,dy,font,bg}) / P.label(x,y,str) / P.screenText(px,py,str)
P.legend([{label,color,dash}]) / P.dropLines(x,y)
P.X(x), P.Y(y), P.toWorld(px,py), P.px(len), P.win (実際の表示範囲), P.W, P.H, P.ctx
plot.addHandle({ x, y, color, r, label, onMove: (x,y) => [x,y] | undefined, visible: () => bool, fixed })
plot.onClick = (x, y) => {}; plot.onHover = (x, y) => {};
Plot.C  // 色: ink, clay, sage, ochre, text, muted, faint, border..., series[]
Plot.rgba(hex, alpha), Plot.FONT, Plot.FONT_MATH
```

## UI API（assets/ui.js）

```js
UI.header({ unit: '数学I', title: '二次関数' })
UI.tabs('#tabs', [{id, label}], onChange)
UI.slider(parent, {label, min, max, step, value, unit, digits, format, onInput}) -> {get, set(v, fire), setRange}
UI.select / UI.checkbox / UI.number / UI.button / UI.buttonRow / UI.segmented
UI.heading(parent, text) / UI.divider(parent) / UI.note(parent, {tone, title, html}) / UI.stats(parent, [{k, v, tone}])
UI.tex(el, tex, display) / UI.texAll(root)
UI.fmt(x, digits) / UI.fmtSigned / UI.texPoly([a,b,c]) / UI.texFrac(p,q) / UI.toFrac(x) / UI.gcd
UI.animator(step(dt)) -> {start, stop, toggle, running}
UI.el(tag, attrs, children) / UI.$ / UI.$$ / UI.deg / UI.rad / UI.rng(seed)
```

## 動作確認

Playwright で各ページを開き、タブを順に押してコンソールエラーと未描画の TeX を検出し、
スクリーンショットを保存するスクリプトを用意している（`node check.js tools/xxx.html`）。
新しいツールを作ったら必ず通し、スクリーンショットを目で確認する。
