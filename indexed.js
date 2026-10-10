// Utilidades: preencher transparência, quantizar para cores indexadas e gerar PNG indexado.
(function (root) {
  'use strict';

  // Troca cada pixel transparente (alpha < 128) pela cor do pixel opaco mais próximo.
  function fillTransparent(d, w, h) {
    const n = w * h, opaque = new Uint8Array(n), queue = new Int32Array(n);
    let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (d[i * 4 + 3] >= 128) { opaque[i] = 1; queue[qt++] = i; }
    if (qt === 0) return;
    while (qh < qt) {
      const i = queue[qh++], x = i % w, y = (i - x) / w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) {
        if (j < 0 || opaque[j]) continue;
        d[j * 4] = d[i * 4]; d[j * 4 + 1] = d[i * 4 + 1]; d[j * 4 + 2] = d[i * 4 + 2];
        opaque[j] = 1; queue[qt++] = j;
      }
    }
    for (let i = 0; i < n; i++) d[i * 4 + 3] = 255;
  }

  // Quantização por median cut (ponderada pela frequência de cada cor).
  function quantize(d, w, h, maxColors) {
    maxColors = maxColors || 256;
    const n = w * h, keys = new Int32Array(n), uid = new Map();
    const R = [], G = [], B = [], C = [];
    for (let i = 0; i < n; i++) {
      const k = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      keys[i] = k;
      let u = uid.get(k);
      if (u === undefined) { u = R.length; uid.set(k, u); R.push(d[i * 4]); G.push(d[i * 4 + 1]); B.push(d[i * 4 + 2]); C.push(0); }
      C[u]++;
    }
    const m = R.length, CH = [R, G, B];
    let pal = []; // [r,g,b]
    if (m <= maxColors) {
      for (let u = 0; u < m; u++) pal.push([R[u], G[u], B[u]]);
    } else {
      const mk = idx => {
        let tot = 0, sr = 0, sg = 0, sb = 0;
        for (const u of idx) { tot += C[u]; sr += C[u] * R[u]; sg += C[u] * G[u]; sb += C[u] * B[u]; }
        const mr = sr / tot, mg = sg / tot, mb = sb / tot;
        let sse = 0;
        for (const u of idx) sse += C[u] * ((R[u] - mr) ** 2 + (G[u] - mg) ** 2 + (B[u] - mb) ** 2);
        return { idx, tot, sse, mean: [mr, mg, mb] };
      };
      const all = new Int32Array(m); for (let u = 0; u < m; u++) all[u] = u;
      const boxes = [mk(all)];
      while (boxes.length < maxColors) {
        let bi = -1, best = 0;
        for (let i = 0; i < boxes.length; i++) if (boxes[i].idx.length > 1 && boxes[i].sse > best) { best = boxes[i].sse; bi = i; }
        if (bi < 0) break;
        const b = boxes[bi];
        let ch = 0, bestRange = -1;
        for (let c = 0; c < 3; c++) {
          let lo = 255, hi = 0;
          for (const u of b.idx) { const v = CH[c][u]; if (v < lo) lo = v; if (v > hi) hi = v; }
          if (hi - lo > bestRange) { bestRange = hi - lo; ch = c; }
        }
        const arr = CH[ch];
        const sorted = Int32Array.from(b.idx).sort((a, c) => arr[a] - arr[c]);
        let acc = 0, cut = 1;
        for (let i = 0; i < sorted.length; i++) { acc += C[sorted[i]]; if (acc >= b.tot / 2) { cut = i + 1; break; } }
        cut = Math.max(1, Math.min(sorted.length - 1, cut));
        boxes.splice(bi, 1, mk(sorted.subarray(0, cut)), mk(sorted.subarray(cut)));
      }
      pal = boxes.map(b => b.mean.map(Math.round));
    }
    const np = pal.length, palette = new Uint8Array(np * 3);
    pal.forEach((p, i) => { palette[i * 3] = p[0]; palette[i * 3 + 1] = p[1]; palette[i * 3 + 2] = p[2]; });
    // cor mais próxima da paleta para cada cor única
    const near = new Uint8Array(m);
    for (let u = 0; u < m; u++) {
      if (m <= maxColors) { near[u] = u; continue; }
      let bd = Infinity, bj = 0;
      for (let j = 0; j < np; j++) {
        const dr = R[u] - palette[j * 3], dg = G[u] - palette[j * 3 + 1], db = B[u] - palette[j * 3 + 2];
        const dd = dr * dr + dg * dg + db * db;
        if (dd < bd) { bd = dd; bj = j; if (dd === 0) break; }
      }
      near[u] = bj;
    }
    const indices = new Uint8Array(n);
    for (let i = 0; i < n; i++) indices[i] = near[uid.get(keys[i])];
    return { palette, indices, n: np };
  }

  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) {
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }
  async function zlib(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // PNG de 8 bits com paleta (color type 3), sem transparência.
  async function encodeIndexedPNG(w, h, palette, indices) {
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3;
    const raw = new Uint8Array((w + 1) * h);
    for (let y = 0; y < h; y++) raw.set(indices.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
    const parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr), chunk('PLTE', palette), chunk('IDAT', await zlib(raw)), chunk('IEND', new Uint8Array(0))
    ];
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  const api = { fillTransparent, quantize, encodeIndexedPNG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PESIndexed = api;
})(typeof window !== 'undefined' ? window : globalThis);
