/* ==========================================================================
   UI — ヘッダー、スライダー、タブ、数式描画などの共通部品
   ========================================================================== */
(function (global) {
  'use strict';

  const SITE = '高校数学 インタラクティブツール';

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v != null) e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /** 数値の整形。末尾の 0 を落とし、-0 を 0 にする */
  function fmt(x, d = 2) {
    if (x == null || !isFinite(x)) return x === Infinity ? '∞' : x === -Infinity ? '−∞' : '—';
    let s = Number(x).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }

  /** 符号付き (+3, −2) */
  function fmtSigned(x, d = 2) {
    const s = fmt(Math.abs(x), d);
    return (x < 0 && s !== '0' ? '−' : '+') + s;
  }

  /** TeX 用: 符号付き係数と項 ("+ 3x" / "- x" / "" など) */
  function texTerm(coef, sym, d = 2, first = false) {
    const a = fmt(Math.abs(coef), d);
    if (a === '0') return '';
    const sign = coef < 0 ? '-' : (first ? '' : '+');
    const mag = (a === '1' && sym) ? '' : a;
    return `${sign}${mag}${sym}`;
  }

  /** 多項式係数配列 (高次から) を TeX に */
  function texPoly(coefs, variable = 'x', d = 2) {
    const n = coefs.length - 1;
    let s = '';
    coefs.forEach((c, i) => {
      const p = n - i;
      const sym = p === 0 ? '' : p === 1 ? variable : `${variable}^{${p}}`;
      const t = texTerm(c, sym, d, s === '');
      if (t) s += (s ? ' ' : '') + t;
    });
    return s || '0';
  }

  /** 分数を TeX に (分母 1 なら整数) */
  function texFrac(p, q) {
    if (q < 0) { p = -p; q = -q; }
    if (q === 1) return String(p);
    return (p < 0 ? '-' : '') + `\\dfrac{${Math.abs(p)}}{${q}}`;
  }

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

  /** 有理数近似 (小さい分母で) → [p,q] または null */
  function toFrac(x, maxDen = 64, tol = 1e-9) {
    for (let q = 1; q <= maxDen; q++) { const p = Math.round(x * q); if (Math.abs(p / q - x) < tol) return [p, q]; }
    return null;
  }

  /* ---------- KaTeX ---------- */

  function tex(target, source, display = false) {
    const node = typeof target === 'string' ? $(target) : target;
    if (!node) return;
    if (global.katex) {
      try { global.katex.render(source, node, { throwOnError: false, displayMode: display }); return; } catch (e) { /* fallthrough */ }
    }
    node.textContent = source;
  }

  function texAll(root) {
    if (global.renderMathInElement) {
      global.renderMathInElement(root || document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    }
  }

  /* ---------- header ---------- */

  function header(opts = {}) {
    const root = opts.root || '..';
    const h = el('header', { class: 'site-header' }, [
      el('div', { class: 'inner' }, [
        el('a', { class: 'brand', href: root + '/index.html', text: SITE }),
        opts.unit ? el('span', { class: 'unit', text: opts.unit }) : null,
        opts.title ? el('span', { class: 'crumb', text: '／' }) : null,
        opts.title ? el('span', { class: 'crumb', text: opts.title }) : null,
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: '教室での投影用に文字を大きくする', text: '拡大表示', onclick: (e) => {
          document.body.classList.toggle('projector');
          e.currentTarget.setAttribute('aria-pressed', document.body.classList.contains('projector'));
          try { localStorage.setItem('mt-projector', document.body.classList.contains('projector') ? '1' : '0'); } catch (_) {}
        } }),
        el('a', { class: 'back', href: root + '/index.html', text: '← 一覧へ' }),
      ]),
    ]);
    document.body.prepend(h);
    try { if (localStorage.getItem('mt-projector') === '1') document.body.classList.add('projector'); } catch (_) {}
    document.title = (opts.title ? opts.title + ' — ' : '') + SITE;
    return h;
  }

  /* ---------- controls ---------- */

  /**
   * スライダー。返り値は { get, set, el, input } 。
   * opts: label, min, max, step, value, unit, format(v)->string, onInput(v)
   */
  function slider(parent, opts) {
    const id = opts.id || 'sl' + Math.random().toString(36).slice(2, 8);
    const input = el('input', { type: 'range', id, min: opts.min, max: opts.max, step: opts.step == null ? 'any' : opts.step, value: opts.value });
    const val = el('span', { class: 'value' });
    const wrap = el('div', { class: 'slider' }, [el('label', { for: id, html: opts.label }), val, input]);
    const format = opts.format || ((v) => fmt(v, opts.digits == null ? 2 : opts.digits) + (opts.unit || ''));
    const show = () => { val.textContent = format(parseFloat(input.value)); };
    input.addEventListener('input', () => { show(); if (opts.onInput) opts.onInput(parseFloat(input.value)); });
    show();
    if (parent) parent.append(wrap);
    if (global.katex && /\$/.test(opts.label)) texAll(wrap);
    return {
      el: wrap, input,
      get: () => parseFloat(input.value),
      set: (v, fire = false) => { input.value = v; show(); if (fire && opts.onInput) opts.onInput(parseFloat(input.value)); },
      setRange: (min, max, step) => { input.min = min; input.max = max; if (step != null) input.step = step; show(); },
    };
  }

  function select(parent, opts) {
    const s = el('select');
    for (const o of opts.options) s.append(el('option', { value: o.value, text: o.label }));
    if (opts.value != null) s.value = opts.value;
    s.addEventListener('change', () => opts.onChange && opts.onChange(s.value));
    const wrap = el('div', { class: 'field' }, [opts.label ? el('label', { html: opts.label }) : null, s]);
    if (parent) parent.append(wrap);
    return { el: wrap, select: s, get: () => s.value, set: (v, fire) => { s.value = v; if (fire && opts.onChange) opts.onChange(v); } };
  }

  function checkbox(parent, opts) {
    const input = el('input', { type: 'checkbox' });
    input.checked = !!opts.checked;
    input.addEventListener('change', () => opts.onChange && opts.onChange(input.checked));
    const wrap = el('label', { class: 'check' }, [input, el('span', { html: opts.label })]);
    if (parent) parent.append(wrap);
    if (global.katex && /\$/.test(opts.label)) texAll(wrap);
    return { el: wrap, input, get: () => input.checked, set: (v, fire) => { input.checked = v; if (fire && opts.onChange) opts.onChange(v); } };
  }

  function number(parent, opts) {
    const input = el('input', { type: 'number', value: opts.value, min: opts.min, max: opts.max, step: opts.step == null ? 'any' : opts.step });
    input.addEventListener('input', () => { const v = parseFloat(input.value); if (isFinite(v) && opts.onInput) opts.onInput(v); });
    input.addEventListener('change', () => { const v = parseFloat(input.value); if (isFinite(v) && opts.onChange) opts.onChange(v); });
    const wrap = el('div', { class: 'field-row' }, [opts.label ? el('label', { html: opts.label }) : null, input, opts.unit ? el('span', { class: 'small', text: opts.unit }) : null]);
    if (parent) parent.append(wrap);
    if (global.katex && /\$/.test(opts.label || '')) texAll(wrap);
    return { el: wrap, input, get: () => parseFloat(input.value), set: (v) => { input.value = v; } };
  }

  function button(parent, opts) {
    const b = el('button', { type: 'button', class: 'btn ' + (opts.primary ? 'btn-primary ' : '') + (opts.sage ? 'btn-sage ' : '') + (opts.ghost ? 'btn-ghost ' : '') + (opts.small ? 'btn-sm ' : '') + (opts.class || ''), html: opts.label, onclick: opts.onClick });
    if (parent) parent.append(b);
    return b;
  }

  function buttonRow(parent, buttons) {
    const row = el('div', { class: 'btn-row' });
    for (const b of buttons) button(row, b);
    if (parent) parent.append(row);
    return row;
  }

  /** セグメントボタン。opts: options [{value,label}], value, onChange */
  function segmented(parent, opts) {
    const wrap = el('div', { class: 'segmented', role: 'group' });
    let cur = opts.value;
    const btns = opts.options.map((o) => {
      const b = el('button', { type: 'button', html: o.label, 'aria-pressed': String(o.value === cur), onclick: () => { set(o.value, true); } });
      wrap.append(b); return [o.value, b];
    });
    function set(v, fire) { cur = v; for (const [val, b] of btns) b.setAttribute('aria-pressed', String(val === v)); if (fire && opts.onChange) opts.onChange(v); }
    const outer = el('div', { class: 'field' }, [opts.label ? el('label', { html: opts.label }) : null, wrap]);
    if (parent) parent.append(outer);
    return { el: outer, get: () => cur, set };
  }

  function heading(parent, text) { const h = el('h3', { text }); parent.append(h); return h; }
  function divider(parent) { parent.append(el('hr')); }

  /** 補足ノート。tone: ink|sage|ochre|clay */
  function note(parent, opts) {
    const n = el('div', { class: 'note ' + (opts.tone || '') }, [opts.title ? el('div', { class: 'title', text: opts.title }) : null, el('div', { html: opts.html })]);
    if (parent) parent.append(n);
    if (global.katex) texAll(n);
    return n;
  }

  /** 数値カード群。items: [{k,v,tone}] → 返り値 set(index, v) */
  function stats(parent, items) {
    const grid = el('div', { class: 'readout-grid' });
    const vs = items.map((it) => {
      const v = el('div', { class: 'v', text: it.v == null ? '' : it.v });
      grid.append(el('div', { class: 'stat ' + (it.tone || '') }, [el('div', { class: 'k', html: it.k }), v]));
      return v;
    });
    if (parent) parent.append(grid);
    if (global.katex) texAll(grid);
    return { el: grid, set: (i, val) => { vs[i].textContent = val; }, setHTML: (i, html) => { vs[i].innerHTML = html; texAll(vs[i]); } };
  }

  /* ---------- tabs ---------- */

  /**
   * タブ。tabs: [{id,label}] 。section 要素は data-tab="id" を持つ .tool-body 。
   * onChange(id) は切り替え後に呼ばれる (canvas の resize に使う)。
   * URL ハッシュに同期する。
   */
  function tabs(parent, list, onChange) {
    const nav = typeof parent === 'string' ? $(parent) : parent;
    nav.classList.add('tabs');
    nav.setAttribute('role', 'tablist');
    let current = null;
    const btns = {};
    function activate(id, push = true) {
      if (!btns[id]) id = list[0].id;
      current = id;
      for (const [k, b] of Object.entries(btns)) b.setAttribute('aria-selected', String(k === id));
      for (const s of $$('.tool-body')) s.classList.toggle('active', s.dataset.tab === id);
      if (push) { try { history.replaceState(null, '', '#' + id); } catch (_) {} }
      window.dispatchEvent(new Event('resize'));
      if (onChange) onChange(id);
    }
    for (const t of list) {
      const b = el('button', { type: 'button', role: 'tab', html: t.label, onclick: () => activate(t.id) });
      btns[t.id] = b; nav.append(b);
    }
    const initial = location.hash.slice(1);
    activate(btns[initial] ? initial : list[0].id, false);
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (btns[h] && h !== current) activate(h, false); });
    return { activate, get current() { return current; } };
  }

  /* ---------- misc ---------- */

  /** 簡単なアニメーションループ。返り値 {start, stop, running} */
  function animator(step) {
    let raf = null, last = 0;
    const api = {
      running: false,
      start() { if (api.running) return; api.running = true; last = performance.now(); const loop = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; step(dt); if (api.running) raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); },
      stop() { api.running = false; if (raf) cancelAnimationFrame(raf); raf = null; },
      toggle() { api.running ? api.stop() : api.start(); return api.running; },
    };
    return api;
  }

  /** 度数表記 */
  const deg = (rad) => rad * 180 / Math.PI;
  const rad = (d) => d * Math.PI / 180;

  /** 簡易疑似乱数 (再現可能)。seed を与えると同じ列 */
  function rng(seed) {
    let s = (seed == null ? Math.floor(Math.random() * 2 ** 31) : seed) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  global.UI = {
    SITE, el, $, $$, fmt, fmtSigned, texTerm, texPoly, texFrac, toFrac, gcd, tex, texAll,
    header, slider, select, checkbox, number, button, buttonRow, segmented, heading, divider, note, stats, tabs,
    animator, deg, rad, rng,
  };

  document.addEventListener('DOMContentLoaded', () => texAll(document.body));
})(window);
