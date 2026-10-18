// Renderização do kit 13 a partir do kit 21 usando o mapa (grade 2x).
// mode "filtrado": cada subpixel faz a média da região do kit 21 que ele cobre (como o Blender faz em reduções fortes).
// mode "ponto": uma única amostra bilinear por pixel.
(function (root) {
  'use strict';

  function boxAverage(d, w, h, cx, cy, hx, hy, out) {
    let ax = cx - hx, bx = cx + hx, ay = cy - hy, by = cy + hy;
    let i0 = Math.floor(ax + 0.5), i1 = Math.floor(bx + 0.5), j0 = Math.floor(ay + 0.5), j1 = Math.floor(by + 0.5);
    i0 = Math.max(0, Math.min(w - 1, i0)); i1 = Math.max(0, Math.min(w - 1, i1));
    j0 = Math.max(0, Math.min(h - 1, j0)); j1 = Math.max(0, Math.min(h - 1, j1));
    let r = 0, g = 0, b = 0, a = 0, ws = 0;
    for (let j = j0; j <= j1; j++) {
      const wy = Math.min(by, j + 0.5) - Math.max(ay, j - 0.5);
      if (wy <= 0 && j1 > j0) continue;
      for (let i = i0; i <= i1; i++) {
        const wx = Math.min(bx, i + 0.5) - Math.max(ax, i - 0.5);
        if (wx <= 0 && i1 > i0) continue;
        const wgt = (wx > 0 ? wx : 1) * (wy > 0 ? wy : 1), p = (j * w + i) * 4;
        r += d[p] * wgt; g += d[p + 1] * wgt; b += d[p + 2] * wgt; a += d[p + 3] * wgt; ws += wgt;
      }
    }
    out[0] = r / ws; out[1] = g / ws; out[2] = b / ws; out[3] = a / ws;
  }

  function bilinear(d, w, h, fx, fy, out) {
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
    const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    for (let k = 0; k < 4; k++) {
      const a = d[(y0 * w + x0) * 4 + k], b = d[(y0 * w + x1) * 4 + k];
      const c = d[(y1 * w + x0) * 4 + k], e = d[(y1 * w + x1) * 4 + k];
      out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
    }
  }

  // opts: { mapX, mapY, MW, src (RGBA), sw, sh, W, H, mode, scale }
  function renderKit(o) {
    const { mapX, mapY, MW, src, sw, sh, W, H } = o;
    const filtered = o.mode !== 'ponto', scale = o.scale || 1, MAXJUMP = 16, MAXBOX = 24;
    const out = new Uint8ClampedArray(W * H * 4), tmp = new Float32Array(4);
    const MH = MW * H / W;                                // altura da grade 2x
    const ux = sw / 65535, uy = sh / 65535;
    // Variação (em pixels do kit 21) entre subpixels vizinhos. Usa o vizinho mais "calmo" de cada eixo
    // (o de menor variação), para que costuras e quinas da peça não inflem a região que entra na média.
    function step(k, kk, mx, my) {
      if (kk < 0 || mapX[kk] === 65535) return null;
      const a = Math.abs((mapX[kk] - mx) * ux), b = Math.abs((mapY[kk] - my) * uy);
      return a < MAXJUMP && b < MAXJUMP ? [a, b] : null;
    }
    function deriv(k, x, y, mx, my) {
      const pick = (p, q) => (p && q) ? (p[0] + p[1] <= q[0] + q[1] ? p : q) : (p || q || [0, 0]);
      const h = pick(step(k, x + 1 < MW ? k + 1 : -1, mx, my), step(k, x > 0 ? k - 1 : -1, mx, my));
      const v = pick(step(k, y + 1 < MH ? k + MW : -1, mx, my), step(k, y > 0 ? k - MW : -1, mx, my));
      return [h[0] + v[0], h[1] + v[1]];
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0, px = 0, py = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const gx = x * 2 + sx, gy = y * 2 + sy, k = gy * MW + gx, mx = mapX[k];
        if (mx === 65535) continue;
        const my = mapY[k], fx = mx * ux - 0.5, fy = my * uy - 0.5;
        n++;
        if (filtered) {
          const [wx, wy] = deriv(k, gx, gy, mx, my);
          boxAverage(src, sw, sh, fx, fy, Math.min(MAXBOX, Math.max(1, wx * scale)) / 2, Math.min(MAXBOX, Math.max(1, wy * scale)) / 2, tmp);
          r += tmp[0]; g += tmp[1]; b += tmp[2]; a += tmp[3];
        } else { px += fx; py += fy; }
      }
      if (!n) continue;
      const p = (y * W + x) * 4;
      if (filtered) { out[p] = r / n; out[p + 1] = g / n; out[p + 2] = b / n; out[p + 3] = a / n; }
      else { bilinear(src, sw, sh, px / n, py / n, tmp); out[p] = tmp[0]; out[p + 1] = tmp[1]; out[p + 2] = tmp[2]; out[p + 3] = tmp[3]; }
    }
    return out;
  }

  const api = { renderKit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PESRender = api;
})(typeof window !== 'undefined' ? window : globalThis);
