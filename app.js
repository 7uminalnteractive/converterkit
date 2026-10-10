(() => {
  const $ = id => document.getElementById(id);
  const msg = (t, err) => { $('msg').textContent = t; $('msg').className = err ? 'err' : ''; };
  const W = PES_MAP.w, H = PES_MAP.h;
  let map = null;            // Uint16Array [x0,y0,x1,y1,...]
  let srcData = null, srcW = 0, srcH = 0, srcName = 'kit';

  async function loadMap() {
    const bin = Uint8Array.from(atob(PES_MAP.b64), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    map = new Uint16Array(buf);
  }

  function loadImage(file) {
    if (!file) return;
    srcName = file.name.replace(/\.[^.]+$/, '');
    const img = new Image();
    img.onload = () => {
      srcW = img.naturalWidth; srcH = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = srcW; c.height = srcH;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      srcData = ctx.getImageData(0, 0, srcW, srcH).data;
      const p = $('src'); p.getContext('2d').drawImage(img, 0, 0, p.width, p.height);
      URL.revokeObjectURL(img.src);
      msg(srcW === srcH ? `Imagem carregada: ${srcW}×${srcH}.` :
        `Aviso: o kit do PES 21 costuma ser quadrado (2048×2048); esta imagem é ${srcW}×${srcH}.`, srcW !== srcH);
      $('go').disabled = !map;
      convert();
    };
    img.onerror = () => msg('Não foi possível abrir essa imagem. Use PNG ou JPG (converta o DDS antes).', true);
    img.src = URL.createObjectURL(file);
  }

  function sample(fx, fy, out, o) {
    const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(srcH - 1, Math.floor(fy)));
    const x1 = Math.min(srcW - 1, x0 + 1), y1 = Math.min(srcH - 1, y0 + 1);
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    const d = srcData;
    for (let k = 0; k < 4; k++) {
      const a = d[(y0 * srcW + x0) * 4 + k], b = d[(y0 * srcW + x1) * 4 + k];
      const c = d[(y1 * srcW + x0) * 4 + k], e = d[(y1 * srcW + x1) * 4 + k];
      out[o + k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
    }
  }

  function convert() {
    if (!map || !srcData) return;
    const out = new Uint8ClampedArray(W * H * 4);
    const covered = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const mx = map[i * 2], my = map[i * 2 + 1];
      if (mx === 65535) continue;
      sample(mx / 65535 * srcW - 0.5, my / 65535 * srcH - 0.5, out, i * 4);
      covered[i] = 1;
    }
    // expandir bordas (dilatação) para evitar costuras
    const pad = Math.max(0, Math.min(16, parseInt($('pad').value) || 0));
    let cur = covered;
    for (let it = 0; it < pad; it++) {
      const next = cur.slice(), snap = out.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (cur[i]) continue;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (cur[j]) { for (let k = 0; k < 4; k++) out[i*4+k] = snap[j*4+k]; next[i] = 1; break; }
        }
      }
      cur = next;
    }
    // fundo
    const bg = $('bg').value;
    if (bg !== 'transparent') {
      const v = bg === '#ffffff' ? 255 : 0;
      for (let i = 0; i < W * H; i++) if (!cur[i]) { out[i*4] = out[i*4+1] = out[i*4+2] = v; out[i*4+3] = 255; }
    }
    $('out').getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
    $('dl').disabled = false;
  }

  $('drop').onclick = () => $('file').click();
  $('file').onchange = e => loadImage(e.target.files[0]);
  ['dragenter', 'dragover'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
  $('drop').addEventListener('drop', e => loadImage(e.dataTransfer.files[0]));
  $('go').onclick = convert;
  $('pad').onchange = $('bg').onchange = convert;
  $('dl').onclick = () => $('out').toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = srcName + '_pes13.png'; a.click(); URL.revokeObjectURL(a.href);
  });

  msg('Carregando mapa de conversão…');
  loadMap().then(() => { msg('Pronto. Escolha o kit do PES 21.'); if (srcData) $('go').disabled = false; })
           .catch(() => msg('Erro ao carregar o mapa. Use um navegador atualizado.', true));
})();
