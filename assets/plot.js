/* ==========================================================================
   Plot — Canvas 座標平面ライブラリ
   ワールド座標 (数学の xy) とスクリーン座標を相互変換し、
   関数・点・ベクトル・領域などを描く。ドラッグ可能なハンドルも提供する。
   ========================================================================== */
(function (global) {
  'use strict';

  const C = {
    ink: '#22759E', inkText: '#316A89', inkLine: '#93B1C3', inkSubtle: '#DDEBF4',
    sage: '#648F5F', sageSolid: '#4F794A', sageLine: '#9CB29A', sageSubtle: '#E1ECE0',
    ochre: '#9B621B', ochreDeep: '#7E4A01', ochreLine: '#C0A892', ochreSubtle: '#F3E7DC',
    clay: '#9F4A3E', claySolid: '#AB5649', clayLine: '#C7A49E', claySubtle: '#F7E5E2',
    text: '#231E16', muted: '#534C41', faint: '#736D62',
    border: '#B5B0A7', borderSubtle: '#D8D3CB', borderStrong: '#908A80',
    bg: '#F7F3ED', surface: '#FFFEFB', sunken: '#F0ECE4',
  };
  C.series = [C.ink, C.clay, C.sage, C.ochre, '#6B5B95', '#2A9D8F'];

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function niceStep(span, target) {
    const raw = span / target;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    let f;
    if (m < 1.5) f = 1; else if (m < 3.5) f = 2; else if (m < 7.5) f = 5; else f = 10;
    return f * p;
  }

  function fmtTick(v, step) {
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let s = v.toFixed(Math.min(d, 6));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }

  const FONT = '13px "Noto Sans JP", "Hiragino Sans", system-ui, sans-serif';
  const FONT_MATH = 'italic 13px "Times New Roman", "Noto Serif JP", serif';

  class Plot {
    /**
     * @param {HTMLCanvasElement|string} canvas
     * @param {object} opts
     *  xmin,xmax,ymin,ymax : 表示範囲(equal のときは y 範囲を中心を保って調整)
     *  equal   : 縦横の単位長を等しくする (default true)
     *  aspect  : height/width (default 0.62; equal でも使う)
     *  height  : px 高さを固定する場合
     *  grid, axes, ticks : 表示 (default true)
     *  xLabel, yLabel : 軸ラベル
     *  xTick, yTick : 目盛間隔を固定する場合 (未指定なら自動)
     *  xTickFormat, yTickFormat : (v)=>string
     *  padding : 端の余白 px
     *  background : 背景色
     */
    constructor(canvas, opts = {}) {
      this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
      this.ctx = this.canvas.getContext('2d');
      this.opts = Object.assign({
        xmin: -5, xmax: 5, ymin: -5, ymax: 5, equal: true, aspect: 0.62, height: null,
        grid: true, axes: true, ticks: true, xLabel: 'x', yLabel: 'y',
        xTick: null, yTick: null, xTickFormat: null, yTickFormat: null,
        padding: 0, background: C.surface, arrows: true, minorGrid: false,
      }, opts);
      this.view = { xmin: this.opts.xmin, xmax: this.opts.xmax, ymin: this.opts.ymin, ymax: this.opts.ymax };
      this.win = Object.assign({}, this.view);
      this.W = 0; this.H = 0; this.dpr = 1;
      this.handles = [];
      this.drawFn = null;
      this.onChange = null;
      this.onClick = null;
      this.onHover = null;
      this._active = null;
      this._hover = null;
      this._setupResize();
      this._setupPointer();
    }

    /* ---------- view / geometry ---------- */

    setView(xmin, xmax, ymin, ymax) {
      this.view = { xmin, xmax, ymin, ymax };
      this._computeWindow();
      return this;
    }

    _computeWindow() {
      const v = this.view, W = this.W, H = this.H;
      if (!W || !H) { this.win = Object.assign({}, v); return; }
      if (this.opts.equal) {
        const sx = W / (v.xmax - v.xmin);
        const sy = H / (v.ymax - v.ymin);
        const s = Math.min(sx, sy);
        const xc = (v.xmin + v.xmax) / 2, yc = (v.ymin + v.ymax) / 2;
        this.win = { xmin: xc - W / s / 2, xmax: xc + W / s / 2, ymin: yc - H / s / 2, ymax: yc + H / s / 2 };
      } else {
        this.win = Object.assign({}, v);
      }
      this.sx = W / (this.win.xmax - this.win.xmin);
      this.sy = H / (this.win.ymax - this.win.ymin);
    }

    X(x) { return (x - this.win.xmin) * this.sx; }
    Y(y) { return this.H - (y - this.win.ymin) * this.sy; }
    toScreen(x, y) { return [this.X(x), this.Y(y)]; }
    toWorld(px, py) { return [this.win.xmin + px / this.sx, this.win.ymin + (this.H - py) / this.sy]; }
    /** ワールド単位の長さをピクセルに (x 方向) */
    px(len) { return len * this.sx; }

    _setupResize() {
      const parent = this.canvas.parentElement;
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(parent);
      this.resize();
    }

    resize() {
      const parent = this.canvas.parentElement;
      const cssW = Math.max(120, parent.clientWidth);
      const cssH = this.opts.height || Math.round(cssW * this.opts.aspect);
      this.dpr = Math.min(3, window.devicePixelRatio || 1);
      if (this.W === cssW && this.H === cssH && this._dprSet === this.dpr) return;
      this.W = cssW; this.H = cssH; this._dprSet = this.dpr;
      this.canvas.width = Math.round(cssW * this.dpr);
      this.canvas.height = Math.round(cssH * this.dpr);
      this.canvas.style.height = cssH + 'px';
      this._computeWindow();
      this.draw();
    }

    /* ---------- pointer / handles ---------- */

    /**
     * ドラッグ可能な点を追加する。
     * h = { x, y, color, r, label, onMove(x,y)->[x,y]|void, visible()->bool, cursor }
     */
    addHandle(h) {
      h = Object.assign({ color: C.ink, r: 7, label: null, onMove: null, visible: null, fixed: false }, h);
      this.handles.push(h);
      return h;
    }
    clearHandles() { this.handles = []; }

    _setupPointer() {
      const cv = this.canvas;
      const pos = (e) => {
        const rect = cv.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
      };
      const hit = (px, py) => {
        let best = null, bd = 1e9;
        for (const h of this.handles) {
          if (h.fixed) continue;
          if (h.visible && !h.visible()) continue;
          const d = Math.hypot(this.X(h.x) - px, this.Y(h.y) - py);
          if (d < Math.max(14, h.r + 8) && d < bd) { bd = d; best = h; }
        }
        return best;
      };
      cv.addEventListener('pointerdown', (e) => {
        const [px, py] = pos(e);
        const h = hit(px, py);
        if (h) {
          this._active = h;
          this._moved = false;
          cv.setPointerCapture(e.pointerId);
          e.preventDefault();
        } else if (this.onClick) {
          const [wx, wy] = this.toWorld(px, py);
          this.onClick(wx, wy, e);
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const [px, py] = pos(e);
        if (this._active) {
          const h = this._active;
          let [wx, wy] = this.toWorld(px, py);
          if (h.onMove) {
            const r = h.onMove(wx, wy);
            if (r) { h.x = r[0]; h.y = r[1]; }
          } else { h.x = wx; h.y = wy; }
          this._moved = true;
          this.draw();
          if (this.onChange) this.onChange(h);
        } else {
          const h = hit(px, py);
          cv.style.cursor = h ? 'grab' : (this.onClick ? 'crosshair' : 'default');
          if (this.onHover) {
            const [wx, wy] = this.toWorld(px, py);
            this.onHover(wx, wy, e);
          }
          if (h !== this._hover) { this._hover = h; this.draw(); }
        }
      });
      const up = (e) => {
        if (this._active) {
          const h = this._active;
          this._active = null;
          if (h.onRelease) h.onRelease();
          this.draw();
        }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => {
        if (this._hover) { this._hover = null; this.draw(); }
        if (this.onHover) this.onHover(null, null, null);
      });
    }

    /* ---------- drawing ---------- */

    /** 描画関数を登録し、直ちに描画する。draw(plot) は毎回呼ばれる。 */
    render(fn) { this.drawFn = fn; this.draw(); return this; }

    draw() {
      const ctx = this.ctx;
      if (!this.W) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.opts.background;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (this.opts.grid) this.drawGrid();
      if (this.opts.axes) this.drawAxes();
      if (this.drawFn) {
        ctx.save();
        try { this.drawFn(this); } finally { ctx.restore(); }
      }
      this.drawHandles();
    }

    _ticks(axis) {
      const w = this.win;
      const span = axis === 'x' ? w.xmax - w.xmin : w.ymax - w.ymin;
      const len = axis === 'x' ? this.W : this.H;
      const fixed = axis === 'x' ? this.opts.xTick : this.opts.yTick;
      const step = fixed || niceStep(span, Math.max(4, len / 80));
      const lo = axis === 'x' ? w.xmin : w.ymin, hi = axis === 'x' ? w.xmax : w.ymax;
      const out = [];
      const start = Math.ceil(lo / step - 1e-9) * step;
      for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
      return { step, values: out };
    }

    drawGrid() {
      const ctx = this.ctx;
      const tx = this._ticks('x'), ty = this._ticks('y');
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.borderSubtle;
      ctx.beginPath();
      for (const v of tx.values) { const X = Math.round(this.X(v)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, this.H); }
      for (const v of ty.values) { const Y = Math.round(this.Y(v)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(this.W, Y); }
      ctx.stroke();
      if (this.opts.minorGrid) {
        ctx.strokeStyle = rgba(C.borderSubtle, 0.5);
        ctx.beginPath();
        for (const v of tx.values) { const X = Math.round(this.X(v + tx.step / 2)) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, this.H); }
        for (const v of ty.values) { const Y = Math.round(this.Y(v + ty.step / 2)) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(this.W, Y); }
        ctx.stroke();
      }
    }

    drawAxes() {
      const ctx = this.ctx, w = this.win;
      const x0 = Math.min(Math.max(this.X(0), 0), this.W);
      const y0 = Math.min(Math.max(this.Y(0), 0), this.H);
      const xVisible = w.xmin <= 0 && w.xmax >= 0;
      const yVisible = w.ymin <= 0 && w.ymax >= 0;
      ctx.strokeStyle = C.borderStrong; ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (yVisible) { ctx.moveTo(0, y0 + 0.5); ctx.lineTo(this.W, y0 + 0.5); }
      if (xVisible) { ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, this.H); }
      ctx.stroke();
      if (this.opts.arrows) {
        ctx.fillStyle = C.borderStrong;
        if (yVisible) { ctx.beginPath(); ctx.moveTo(this.W, y0 + 0.5); ctx.lineTo(this.W - 9, y0 - 3.5); ctx.lineTo(this.W - 9, y0 + 4.5); ctx.fill(); }
        if (xVisible) { ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 - 3.5, 9); ctx.lineTo(x0 + 4.5, 9); ctx.fill(); }
      }
      if (!this.opts.ticks) return;
      ctx.fillStyle = C.faint; ctx.font = FONT;
      const tx = this._ticks('x'), ty = this._ticks('y');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const ty0 = yVisible ? y0 : this.H;
      for (const v of tx.values) {
        if (v === 0) continue;
        const X = this.X(v);
        if (X < 14 || X > this.W - 14) continue;
        const s = this.opts.xTickFormat ? this.opts.xTickFormat(v) : fmtTick(v, tx.step);
        ctx.fillText(s, X, Math.min(ty0 + 5, this.H - 16));
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const tx0 = xVisible ? x0 : 0;
      for (const v of ty.values) {
        if (v === 0) continue;
        const Y = this.Y(v);
        if (Y < 10 || Y > this.H - 10) continue;
        const s = this.opts.yTickFormat ? this.opts.yTickFormat(v) : fmtTick(v, ty.step);
        if (xVisible) ctx.fillText(s, tx0 - 5, Y); else { ctx.textAlign = 'left'; ctx.fillText(s, 5, Y); ctx.textAlign = 'right'; }
      }
      if (xVisible && yVisible) { ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('O', x0 - 5, y0 + 4); }
      ctx.fillStyle = C.muted; ctx.font = FONT_MATH;
      if (this.opts.xLabel && yVisible) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(this.opts.xLabel, this.W - 6, y0 - 6); }
      if (this.opts.yLabel && xVisible) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(this.opts.yLabel, x0 + 8, 4); }
    }

    drawHandles() {
      const ctx = this.ctx;
      for (const h of this.handles) {
        if (h.visible && !h.visible()) continue;
        const X = this.X(h.x), Y = this.Y(h.y);
        const hot = h === this._active || h === this._hover;
        if (hot && !h.fixed) {
          ctx.beginPath(); ctx.arc(X, Y, h.r + 6, 0, Math.PI * 2);
          ctx.fillStyle = rgba(h.color, 0.18); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(X, Y, h.r, 0, Math.PI * 2);
        ctx.fillStyle = h.fixed ? h.color : C.surface; ctx.fill();
        ctx.lineWidth = 2.2; ctx.strokeStyle = h.color; ctx.stroke();
        if (h.label) this.label(h.x, h.y, h.label, { color: h.color, dx: h.dx == null ? 10 : h.dx, dy: h.dy == null ? -10 : h.dy });
      }
    }

    /* ---------- primitives (world coordinates) ---------- */

    _style(o) {
      const ctx = this.ctx;
      ctx.strokeStyle = o.color || C.ink;
      ctx.lineWidth = o.width || 2;
      ctx.setLineDash(o.dash || []);
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    }
    _reset() { this.ctx.setLineDash([]); this.ctx.globalAlpha = 1; }

    /** y = f(x) のグラフ */
    fn(f, o = {}) {
      const ctx = this.ctx, w = this.win;
      const a = o.domain ? Math.max(o.domain[0], w.xmin) : w.xmin;
      const b = o.domain ? Math.min(o.domain[1], w.xmax) : w.xmax;
      if (!(b > a)) return;
      const n = o.samples || Math.max(200, Math.ceil(this.px(b - a) / 1.5));
      const ymaxAbs = Math.max(Math.abs(w.ymin), Math.abs(w.ymax)) * 20 + 100;
      this._style(o);
      ctx.beginPath();
      let pen = false, prevY = null;
      for (let i = 0; i <= n; i++) {
        const x = a + (b - a) * i / n;
        let y = f(x);
        if (!isFinite(y) || isNaN(y)) { pen = false; prevY = null; continue; }
        // 極ごえ (漸近線) を検出して線を切る
        if (prevY != null && Math.abs(y - prevY) > (w.ymax - w.ymin) * 3 && Math.sign(y) !== Math.sign(prevY)) { pen = false; }
        const yc = Math.max(-ymaxAbs, Math.min(ymaxAbs, y));
        const X = this.X(x), Y = this.Y(yc);
        if (!pen) { ctx.moveTo(X, Y); pen = true; } else ctx.lineTo(X, Y);
        prevY = y;
      }
      ctx.stroke();
      this._reset();
    }

    /** 媒介変数表示 (x(t), y(t)), t in [t0,t1] */
    param(fx, fy, t0, t1, o = {}) {
      const ctx = this.ctx;
      const n = o.samples || 600;
      this._style(o);
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= n; i++) {
        const t = t0 + (t1 - t0) * i / n;
        const x = fx(t), y = fy(t);
        if (!isFinite(x) || !isFinite(y)) { pen = false; continue; }
        const X = this.X(x), Y = this.Y(y);
        if (!pen) { ctx.moveTo(X, Y); pen = true; } else ctx.lineTo(X, Y);
      }
      if (o.close) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color !== 'none') ctx.stroke();
      this._reset();
    }

    /** 極方程式 r = f(θ) */
    polar(fr, t0, t1, o = {}) {
      this.param((t) => fr(t) * Math.cos(t), (t) => fr(t) * Math.sin(t), t0, t1, o);
    }

    /** 陰関数 F(x,y)=0 の等高線 (マーチングスクエア) */
    implicit(F, o = {}) {
      const ctx = this.ctx, w = this.win;
      const n = o.res || 120;
      const m = Math.round(n * this.H / this.W);
      const dx = (w.xmax - w.xmin) / n, dy = (w.ymax - w.ymin) / m;
      const g = new Float64Array((n + 1) * (m + 1));
      for (let j = 0; j <= m; j++) for (let i = 0; i <= n; i++) g[j * (n + 1) + i] = F(w.xmin + i * dx, w.ymin + j * dy);
      this._style(o);
      ctx.beginPath();
      const lerp = (x1, y1, v1, x2, y2, v2) => { const t = v1 / (v1 - v2); return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]; };
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
        const x0 = w.xmin + i * dx, y0 = w.ymin + j * dy, x1 = x0 + dx, y1 = y0 + dy;
        const v00 = g[j * (n + 1) + i], v10 = g[j * (n + 1) + i + 1], v01 = g[(j + 1) * (n + 1) + i], v11 = g[(j + 1) * (n + 1) + i + 1];
        if (![v00, v10, v01, v11].every(isFinite)) continue;
        const pts = [];
        if ((v00 < 0) !== (v10 < 0)) pts.push(lerp(x0, y0, v00, x1, y0, v10));
        if ((v10 < 0) !== (v11 < 0)) pts.push(lerp(x1, y0, v10, x1, y1, v11));
        if ((v01 < 0) !== (v11 < 0)) pts.push(lerp(x0, y1, v01, x1, y1, v11));
        if ((v00 < 0) !== (v01 < 0)) pts.push(lerp(x0, y0, v00, x0, y1, v01));
        if (pts.length >= 2) {
          ctx.moveTo(this.X(pts[0][0]), this.Y(pts[0][1])); ctx.lineTo(this.X(pts[1][0]), this.Y(pts[1][1]));
          if (pts.length === 4) { ctx.moveTo(this.X(pts[2][0]), this.Y(pts[2][1])); ctx.lineTo(this.X(pts[3][0]), this.Y(pts[3][1])); }
        }
      }
      ctx.stroke();
      this._reset();
    }

    /** 不等式 F(x,y) > 0 の領域を塗る */
    region(F, o = {}) {
      const ctx = this.ctx, w = this.win;
      const step = o.step || 4;
      ctx.fillStyle = o.fill || rgba(C.ink, 0.18);
      for (let py = 0; py < this.H; py += step) for (let px = 0; px < this.W; px += step) {
        const [x, y] = this.toWorld(px + step / 2, py + step / 2);
        if (F(x, y)) ctx.fillRect(px, py, step, step);
      }
    }

    segment(x1, y1, x2, y2, o = {}) {
      const ctx = this.ctx;
      this._style(o);
      ctx.beginPath(); ctx.moveTo(this.X(x1), this.Y(y1)); ctx.lineTo(this.X(x2), this.Y(y2)); ctx.stroke();
      this._reset();
    }

    /** 点 (x0,y0) を通り方向 (dx,dy) の直線 (画面いっぱい) */
    line(x0, y0, dx, dy, o = {}) {
      const w = this.win;
      const L = Math.max(w.xmax - w.xmin, w.ymax - w.ymin) * 4;
      const n = Math.hypot(dx, dy) || 1;
      this.segment(x0 - dx / n * L, y0 - dy / n * L, x0 + dx / n * L, y0 + dy / n * L, o);
    }
    /** 直線 ax + by + c = 0 */
    lineABC(a, b, c, o = {}) {
      if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return;
      const x0 = -a * c / (a * a + b * b), y0 = -b * c / (a * a + b * b);
      this.line(x0, y0, -b, a, o);
    }
    vline(x, o = {}) { this.segment(x, this.win.ymin, x, this.win.ymax, o); }
    hline(y, o = {}) { this.segment(this.win.xmin, y, this.win.xmax, y, o); }

    arrow(x1, y1, x2, y2, o = {}) {
      const ctx = this.ctx;
      const X1 = this.X(x1), Y1 = this.Y(y1), X2 = this.X(x2), Y2 = this.Y(y2);
      const ang = Math.atan2(Y2 - Y1, X2 - X1);
      const head = o.head || 11;
      const len = Math.hypot(X2 - X1, Y2 - Y1);
      this._style(o);
      ctx.fillStyle = ctx.strokeStyle;
      if (len < 1) { this._reset(); return; }
      const bx = X2 - Math.cos(ang) * head * 0.8, by = Y2 - Math.sin(ang) * head * 0.8;
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(X2, Y2);
      ctx.lineTo(X2 - Math.cos(ang - 0.42) * head, Y2 - Math.sin(ang - 0.42) * head);
      ctx.lineTo(X2 - Math.cos(ang + 0.42) * head, Y2 - Math.sin(ang + 0.42) * head);
      ctx.closePath(); ctx.fill();
      this._reset();
    }

    point(x, y, o = {}) {
      const ctx = this.ctx;
      const r = o.r || 4.5;
      ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), r, 0, Math.PI * 2);
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
      if (o.hollow) { ctx.fillStyle = C.surface; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.color || C.ink; ctx.stroke(); }
      else { ctx.fillStyle = o.color || C.ink; ctx.fill(); if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; ctx.stroke(); } }
      ctx.globalAlpha = 1;
      if (o.label) this.label(x, y, o.label, { color: o.labelColor || o.color || C.ink, dx: o.dx, dy: o.dy, align: o.align });
    }

    circle(cx, cy, r, o = {}) {
      const ctx = this.ctx;
      this._style(o);
      ctx.beginPath(); ctx.arc(this.X(cx), this.Y(cy), this.px(r), 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color !== 'none') ctx.stroke();
      this._reset();
    }

    /** 中心 (cx,cy) 半径 r の弧: a0 → a1 (ラジアン、反時計回り) */
    arc(cx, cy, r, a0, a1, o = {}) {
      const ctx = this.ctx;
      this._style(o);
      ctx.beginPath();
      if (o.sector) ctx.moveTo(this.X(cx), this.Y(cy));
      ctx.arc(this.X(cx), this.Y(cy), this.px(r), -a0, -a1, true);
      if (o.sector) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color !== 'none') ctx.stroke();
      this._reset();
    }

    /** 角度マーク: 頂点 (vx,vy)、2辺の方向へ半径 r の弧 */
    angleMark(vx, vy, ax, ay, bx, by, o = {}) {
      const a0 = Math.atan2(ay - vy, ax - vx), a1 = Math.atan2(by - vy, bx - vx);
      let d = a1 - a0; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
      const r = o.r || 0.5;
      if (o.right && Math.abs(Math.abs(d) - Math.PI / 2) < 1e-6) {
        const ua = [Math.cos(a0), Math.sin(a0)], ub = [Math.cos(a1), Math.sin(a1)];
        const s = r * 0.7;
        this.polygon([[vx + ua[0] * s, vy + ua[1] * s], [vx + (ua[0] + ub[0]) * s, vy + (ua[1] + ub[1]) * s], [vx + ub[0] * s, vy + ub[1] * s]], { color: o.color || C.muted, width: o.width || 1.3, open: true });
        return;
      }
      this.arc(vx, vy, r, a0, a0 + d, { color: o.color || C.muted, width: o.width || 1.3, fill: o.fill, sector: !!o.fill });
      if (o.label) {
        const m = a0 + d / 2, rr = r * 1.45;
        this.text(vx + Math.cos(m) * rr, vy + Math.sin(m) * rr, o.label, { color: o.color || C.muted, align: 'center', baseline: 'middle', font: o.font || FONT_MATH });
      }
    }

    polygon(pts, o = {}) {
      const ctx = this.ctx;
      if (pts.length < 2) return;
      this._style(o);
      ctx.beginPath();
      pts.forEach((p, i) => { const X = this.X(p[0]), Y = this.Y(p[1]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      if (!o.open) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.color !== 'none') ctx.stroke();
      this._reset();
    }

    rect(x, y, w, h, o = {}) { this.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); }

    /** f と g (または定数) の間を塗る */
    fillBetween(f, g, a, b, o = {}) {
      const ctx = this.ctx;
      const gg = typeof g === 'function' ? g : () => g;
      const n = o.samples || 200;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; const X = this.X(x), Y = this.Y(f(x)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      for (let i = n; i >= 0; i--) { const x = a + (b - a) * i / n; ctx.lineTo(this.X(x), this.Y(gg(x))); }
      ctx.closePath();
      ctx.fillStyle = o.fill || rgba(C.ink, 0.2); ctx.fill();
      if (o.color) { this._style(o); ctx.stroke(); this._reset(); }
    }

    /** 文字 (ワールド座標)。dx, dy はピクセルのオフセット */
    text(x, y, str, o = {}) {
      const ctx = this.ctx;
      ctx.font = o.font || FONT;
      ctx.fillStyle = o.color || C.text;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'alphabetic';
      const X = this.X(x) + (o.dx || 0), Y = this.Y(y) + (o.dy || 0);
      if (o.bg) {
        const m = ctx.measureText(str);
        const w = m.width + 8, h = 18;
        let bx = X - 4; if (ctx.textAlign === 'center') bx = X - w / 2; if (ctx.textAlign === 'right') bx = X - w + 4;
        let by = Y - 13; if (ctx.textBaseline === 'middle') by = Y - h / 2; if (ctx.textBaseline === 'top') by = Y - 2;
        ctx.fillStyle = o.bg === true ? rgba(C.surface, 0.85) : o.bg;
        ctx.fillRect(bx, by, w, h);
        ctx.fillStyle = o.color || C.text;
      }
      ctx.fillText(str, X, Y);
    }

    /** 点の近くのラベル (斜体の数学フォント) */
    label(x, y, str, o = {}) {
      this.text(x, y, str, Object.assign({ font: o.bold ? 'italic bold 14px "Times New Roman", serif' : FONT_MATH, dx: o.dx == null ? 8 : o.dx, dy: o.dy == null ? -8 : o.dy, bg: true }, o));
    }

    /** 画面座標で文字 (凡例など) */
    screenText(px, py, str, o = {}) {
      const ctx = this.ctx;
      ctx.font = o.font || FONT;
      ctx.fillStyle = o.color || C.muted;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'top';
      ctx.fillText(str, px, py);
    }

    /** 右上に凡例 */
    legend(items, o = {}) {
      const ctx = this.ctx;
      ctx.font = FONT;
      let w = 0;
      for (const it of items) w = Math.max(w, ctx.measureText(it.label).width);
      const x = o.left != null ? o.left : this.W - w - 44, y = o.top != null ? o.top : 10;
      const h = items.length * 20 + 8;
      ctx.fillStyle = rgba(C.surface, 0.9); ctx.strokeStyle = C.borderSubtle; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(x - 8, y - 4, w + 40, h); ctx.fill(); ctx.stroke();
      items.forEach((it, i) => {
        const yy = y + 10 + i * 20;
        ctx.strokeStyle = it.color; ctx.lineWidth = it.width || 3; ctx.setLineDash(it.dash || []);
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 22, yy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, x + 30, yy);
      });
    }

    /** 破線で座標軸への垂線 (点の座標を示す) */
    dropLines(x, y, o = {}) {
      const c = o.color || C.faint;
      this.segment(x, 0, x, y, { color: c, width: 1, dash: [4, 4] });
      this.segment(0, y, x, y, { color: c, width: 1, dash: [4, 4] });
    }
  }

  Plot.C = C;
  Plot.rgba = rgba;
  Plot.niceStep = niceStep;
  Plot.FONT = FONT;
  Plot.FONT_MATH = FONT_MATH;
  global.Plot = Plot;
})(window);
