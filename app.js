(() => {
  const $ = id => document.getElementById(id);
  const msg = (t, err) => { $('msg').textContent = t; $('msg').className = err ? 'err' : ''; };
  const W = PES_MAP.w / PES_MAP.ss, H = PES_MAP.h / PES_MAP.ss;   // kit 13: 1024×512
  // Espaço vazio do layout do kit 13 onde fica a fitinha (x, y, largura, altura em pixels)
  const RIBBON = { x: 605, y: 286, w: 32, h: 226 };
  let mapX = null, mapY = null;      // Uint16Array da grade 2x (supersampling 2x2)
  const MW = PES_MAP.w;
  let srcData = null, srcW = 0, srcH = 0, srcName = 'kit';
  let ribbonImg = null;
  let result = null;                 // { palette, indices, n }

  async function loadMap() {
    const bin = Uint8Array.from(atob(PES_MAP.b64), c => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    const b = new Uint8Array(await new Response(stream).arrayBuffer());
    const N = PES_MAP.w * PES_MAP.h;
    mapX = new Uint16Array(N); mapY = new Uint16Array(N);
    let vx = 0, vy = 0;
    for (let i = 0; i < N; i++) {
      vx = (vx + ((b[i] << 8) | b[N + i])) & 0xffff;
      vy = (vy + ((b[2 * N + i] << 8) | b[3 * N + i])) & 0xffff;
      mapX[i] = vx; mapY[i] = vy;
    }
  }

  function readImage(file, ok, fail) {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail();
    img.src = URL.createObjectURL(file);
  }

  function loadKit(file) {
    if (!file) return;
    srcName = file.name.replace(/\.[^.]+$/, '');
    readImage(file, img => {
      srcW = img.naturalWidth; srcH = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = srcW; c.height = srcH;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      srcData = ctx.getImageData(0, 0, srcW, srcH).data;
      const p = $('src'); p.getContext('2d').drawImage(img, 0, 0, p.width, p.height);
      URL.revokeObjectURL(img.src);
      msg(srcW === srcH ? `Kit carregado: ${srcW}×${srcH}.` :
        `Aviso: o kit do PES 21 costuma ser quadrado (2048×2048); esta imagem é ${srcW}×${srcH}.`, srcW !== srcH);
      convert();
    }, () => msg('Não foi possível abrir essa imagem. Use PNG ou JPG (converta o DDS antes).', true));
  }

  function loadRibbon(file) {
    if (!file) return;
    readImage(file, img => {
      ribbonImg = img;
      $('rm').hidden = false;
      msg('Fitinha adicionada.');
      convert();
    }, () => msg('Não foi possível abrir a imagem da fitinha.', true));
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

  // Cola a fitinha no espaço vazio do kit 13 (imagem deitada é girada 90° para ficar em pé)
  function pasteRibbon(out) {
    const { x, y, w, h } = RIBBON;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (ribbonImg.naturalWidth > ribbonImg.naturalHeight) {
      ctx.translate(0, h); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(ribbonImg, 0, 0, h, w);
    } else {
      ctx.drawImage(ribbonImg, 0, 0, w, h);
    }
    const r = ctx.getImageData(0, 0, w, h).data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const s = (j * w + i) * 4, o = ((y + j) * W + (x + i)) * 4;
      if (r[s + 3] < 128) continue;
      out[o] = r[s]; out[o + 1] = r[s + 1]; out[o + 2] = r[s + 2]; out[o + 3] = 255;
    }
  }

  let pending = 0;
  function convert() {
    if (!mapX || !srcData) return;
    const id = ++pending;
    msg('Convertendo…');
    setTimeout(() => {
      if (id !== pending) return;
      const out = new Uint8ClampedArray(W * H * 4);       // começa tudo transparente
      const tmp = new Float32Array(4), aa = $('aa').checked;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0, ux = 0, uy = 0;
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const k = (y * 2 + sy) * MW + (x * 2 + sx), mx = mapX[k];
          if (mx === 65535) continue;
          const fx = mx / 65535 * srcW - 0.5, fy = mapY[k] / 65535 * srcH - 0.5;
          n++;
          if (aa) {                      // média das 4 amostras (antialiasing 2x2)
            sample(fx, fy, tmp, 0);
            r += tmp[0]; g += tmp[1]; b += tmp[2]; a += tmp[3];
          } else { ux += fx; uy += fy; } // sem antialiasing: uma amostra no centro do pixel
        }
        if (!n) continue;
        const o = (y * W + x) * 4;
        if (aa) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n; }
        else { sample(ux / n, uy / n, tmp, 0); out[o] = tmp[0]; out[o + 1] = tmp[1]; out[o + 2] = tmp[2]; out[o + 3] = tmp[3]; }
      }
      if (ribbonImg) pasteRibbon(out);
      PESIndexed.fillTransparent(out, W, H);              // expandir bordas automático
      result = PESIndexed.quantize(out, W, H, 256);       // cores indexadas
      const rgba = new Uint8ClampedArray(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const p = result.indices[i] * 3;
        rgba[i * 4] = result.palette[p]; rgba[i * 4 + 1] = result.palette[p + 1];
        rgba[i * 4 + 2] = result.palette[p + 2]; rgba[i * 4 + 3] = 255;
      }
      $('out').getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
      $('dl').disabled = false;
      msg(`Pronto: PNG indexado com ${result.n} cores.`);
    }, 20);
  }

  $('drop').onclick = () => $('file').click();
  $('file').onchange = e => loadKit(e.target.files[0]);
  ['dragenter', 'dragover'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => $('drop').addEventListener(t, e => { e.preventDefault(); $('drop').classList.remove('over'); }));
  $('drop').addEventListener('drop', e => loadKit(e.dataTransfer.files[0]));
  $('rib').onclick = () => $('ribfile').click();
  $('ribfile').onchange = e => { loadRibbon(e.target.files[0]); e.target.value = ''; };
  $('rm').onclick = () => { ribbonImg = null; $('rm').hidden = true; msg('Fitinha removida.'); convert(); };
  $('aa').onchange = convert;
  $('dl').onclick = async () => {
    if (!result) return;
    const png = await PESIndexed.encodeIndexedPNG(W, H, result.palette, result.indices);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
    a.download = srcName + '_pes13.png'; a.click(); URL.revokeObjectURL(a.href);
  };

  msg('Carregando mapa de conversão…');
  loadMap().then(() => { msg('Pronto. Escolha o kit do PES 21.'); convert(); })
           .catch(() => msg('Erro ao carregar o mapa. Use um navegador atualizado.', true));
})();
