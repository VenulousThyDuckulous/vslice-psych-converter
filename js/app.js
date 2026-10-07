/* UI wiring: file intake (loose + zip), options, run, report, downloads. */
(function () {
  'use strict';
  const C = window.FNFConv;
  const S = { files: [], direction: 'auto', outputs: [], rows: [] };
  const $ = (id) => document.getElementById(id);
  const logEl = $('log'), outEl = $('outputs'), tableWrap = $('fileTableWrap'), reportWrap = $('reportWrap');
  function log(msg, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = msg; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; }

  document.querySelectorAll('#dirSeg button').forEach((b) => b.onclick = () => {
    document.querySelectorAll('#dirSeg button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); S.direction = b.dataset.dir; refresh();
  });

  const drop = $('drop'), fi = $('fileInput');
  drop.onclick = (e) => { if (e.target !== fi) fi.click(); };
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  fi.onchange = () => { handleFiles(fi.files); fi.value = ''; };

  const BIN_RE = /\.(ogg|mp3|wav|png|xml|ttf|otf|mp4|frag|vert|txt|dat)$/i;
  const TEXT_RE = /\.(lua|hx|hxs|hxc|md|txt)$/i;
  async function handleFiles(list) {
    for (const f of [...list]) {
      try {
        if (/\.zip$/i.test(f.name)) {
          log('Unzipping ' + f.name + ' …');
          const zip = await JSZip.loadAsync(f);
          let n = 0;
          const names = Object.keys(zip.files).filter((p) => !zip.files[p].dir && !/__MACOSX|DS_Store/i.test(p));
          for (const p of names) {
            const e = zip.files[p];
            if (/\.json$/i.test(p)) addJson(p.split('/').pop(), p, await e.async('string'));
            else if (TEXT_RE.test(p)) addText(p.split('/').pop(), p, await e.async('string'));
            else if (BIN_RE.test(p)) addBin(p.split('/').pop(), p, new Uint8Array(await e.async('uint8array')));
            else { try { addText(p.split('/').pop(), p, await e.async('string')); } catch (_) { /* skip unreadable */ } }
            n++;
          }
          log('  kept ' + n + ' files', 'mut');
        } else if (/\.json$/i.test(f.name)) addJson(f.name, f.name, await f.text());
        else if (TEXT_RE.test(f.name)) addText(f.name, f.name, await f.text());
        else addBin(f.name, f.name, new Uint8Array(await f.arrayBuffer()));
      } catch (err) { log('Failed to read ' + f.name + ': ' + err.message, 'err'); }
    }
    refresh();
  }
  function addJson(name, path, text) {
    let json = null, err = null;
    try { json = JSON.parse(text); } catch (e) { err = 'Invalid JSON: ' + e.message; }
    const rec = { name, path, text, json, err };
    if (!err) C.classify(rec); else rec.kind = 'error';
    S.files.push(rec);
  }
  function addText(name, path, text) {
    const rec = { name, path, text, kind: 'other' };
    C.classify(rec); S.files.push(rec);
  }
  function addBin(name, path, bin) {
    const rec = { name, path, bin, kind: 'other' };
    C.classify(rec); S.files.push(rec);
  }

  const PILL = { converted: 'p-green', passthrough: 'p-blue', stub: 'p-yellow', warning: 'p-yellow', skipped: 'p-gray', consumed: 'p-purple', error: 'p-red' };
  const KIND_LABEL = { pchart: 'PSYCH', pevents: 'EVENTS', pdiag: 'DIALOG', pchar: 'P-CHAR', pstage: 'P-STAGE', pweek: 'P-WEEK', pportrait: 'PORTRAIT', luascript: 'LUA', vchart: 'V-CHART', vmeta: 'V-META', vchar: 'V-CHAR', vstage: 'V-STAGE', vlevel: 'V-LEVEL', vconv: 'V-CONV', vspk: 'V-SPKR', vbox: 'V-BOX', hscript: 'HSCRIPT', audio: 'AUDIO', image: 'IMAGE', imagexml: 'XML', packjson: 'PACK', polymod: 'POLYMOD', weeklist: 'WEEKS', asset: 'ASSET', other: 'OTHER', error: 'ERROR' };
  function pill(txt, cls) { return '<span class="pill ' + cls + '">' + C.esc(txt) + '</span>'; }

  function refresh() {
    if (!S.files.length) { tableWrap.innerHTML = ''; $('convertBtn').disabled = true; return; }
    let h = '<table><tr><th>File</th><th>Type</th><th>Info</th></tr>';
    for (const f of S.files) {
      const info = f.err ? '<span class="err">' + C.esc(f.err) + '</span>'
        : f.kind === 'pchart' ? C.esc(f.song) + ' · ' + C.esc(f.diff) + ' · ' + f.notes + ' notes'
        : f.kind === 'vchart' ? (f.diffs || []).join('/') + ' · ' + f.notes + ' notes'
        : f.kind === 'vmeta' ? C.esc(f.song) + (f.variation ? ' · var ' + C.esc(f.variation) : '')
        : (f.notes ? f.notes + ' items' : '—');
      const cls = /^(pchart|pevents|pdiag|pchar|pstage|pweek)/.test(f.kind || '') ? 'p-purple' : /^(vchart|vmeta|vchar|vstage|vlevel|vconv)/.test(f.kind || '') ? 'p-blue' : f.kind === 'audio' ? 'p-yellow' : f.kind === 'error' ? 'p-red' : 'p-gray';
      h += '<tr><td><code class="path">' + C.esc(f.path) + '</code></td><td>' + pill(KIND_LABEL[f.kind] || f.kind || '?', cls) + '</td><td>' + info + '</td></tr>';
    }
    tableWrap.innerHTML = h + '</table>';
    $('convertBtn').disabled = false;
  }

  $('clearBtn').onclick = () => { S.files = []; S.outputs = []; S.rows = []; outEl.innerHTML = ''; reportWrap.innerHTML = '<p class="desc">Nothing converted yet.</p>'; logEl.innerHTML = 'Ready. Drop a mod zip to begin.\n'; refresh(); };

  $('demoBtn').onclick = () => {
    const chart = { song: { song: 'Demo Song', bpm: 128, speed: 1.2, needsVoices: true, player1: 'bf', player2: 'dad', gfVersion: 'gf', stage: 'demoStage', notes: [
      { lengthInSteps: 16, mustHitSection: false, sectionNotes: [[0, 0, 0], [468, 1, 0], [937, 2, 100]] },
      { lengthInSteps: 16, mustHitSection: true, sectionNotes: [[1875, 0, 0], [2343, 3, 0]] }
    ] } };
    addJson('demo-hard.json', 'mods/DemoMod/data/demo/demo-hard.json', JSON.stringify(chart));
    addJson('bf.json', 'mods/DemoMod/characters/bf.json', JSON.stringify({ image: 'characters/BOYFRIEND', scale: 1, sing_duration: 4, healthicon: 'bf', position: [0, 350], camera_position: [0, 0], flip_x: true, healthbar_colors: [49, 176, 209], animations: [{ anim: 'idle', name: 'BF idle dance', fps: 24, loop: false, indices: [], offsets: [-5, 0] }, { anim: 'singLEFT', name: 'BF NOTE LEFT0', fps: 24, loop: false, indices: [], offsets: [5, -6] }] }));
    addJson('demoStage.json', 'mods/DemoMod/stages/demoStage.json', JSON.stringify({ directory: '', defaultZoom: 0.9, boyfriend: [770, 100], girlfriend: [400, 130], opponent: [100, 100], camera_boyfriend: [0, 0], camera_opponent: [0, 0], camera_girlfriend: [0, 0] }));
    addJson('weekdemo.json', 'mods/DemoMod/weeks/weekdemo.json', JSON.stringify({ songs: [['Demo Song', 'dad', [146, 113, 253]]], weekCharacters: ['dad', 'bf', 'gf'], weekBackground: 'stage', storyName: 'Demo Week', weekName: 'Week Demo', startUnlocked: true, hideStoryMode: false, hideFreeplay: false }));
    refresh(); log('Loaded mini-mod demo (chart + character + stage + week). Hit Convert.', 'ok');
  };

  function opts() {
    return {
      direction: S.direction, modName: detectModName(S.files), libPrefix: '',
      bpm: 120, speed: 1,
      events: $('optEvents').checked, stubs: $('optStubs').checked, pretty: $('optPretty').checked, flip: $('optFlip').checked,
      psychFmt: 'psych_v1', p1: 'bf', p2: 'dad',
      gf: 'gf', stage: 'stage', song: ''
    };
  }
  // Output root folder detected from zip structure: mods/Name/... or Name/... -> "Name".
  function detectModName(files) {
    const isContent = (s) => /^(data|characters|stages|weeks|songs|music|sounds|images|scripts|custom_events|custom_notetypes|shaders|fonts|videos|pack\.json|_polymod_meta\.json)$/i.test(s);
    for (const f of files) {
      const segs = String(f.path || '').replace(/\\/g, '/').split('/');
      for (let i = 1; i < segs.length; i++) {
        if (isContent(segs[i])) {
          const cand = segs[i - 1];
          if (cand && !/^mods$/i.test(cand)) return cand.replace(/[\\/:*?"<>|]/g, '');
          if (/^mods$/i.test(cand) && segs[i] !== undefined) return '';
        }
      }
    }
    return '';
  }

  $('convertBtn').onclick = () => {
    outEl.innerHTML = ''; S.outputs = []; S.rows = [];
    const o = opts();
    if (!S.files.length) { log('Drop files first.', 'err'); return; }
    try {
      const { outputs, rows } = C.convertMod(S.files, o);
      S.outputs = outputs; S.rows = rows;
      const nOk = rows.filter((r) => r.status === 'converted').length;
      const nPass = rows.filter((r) => r.status === 'passthrough').length;
      const nStub = rows.filter((r) => r.status === 'stub').length;
      const nErr = rows.filter((r) => r.status === 'error').length;
      log('Done: ' + outputs.length + ' output file(s) — ' + nOk + ' converted, ' + nPass + ' passthrough, ' + nStub + ' stubs, ' + nErr + ' errors.', nErr ? 'warn' : 'ok');
      if (!outputs.length) log('Nothing produced. Drop Psych charts/chars or V-Slice charts/meta.', 'err');
      renderReport(); renderOutputs(o);
    } catch (e) { log('Conversion failed: ' + (e.message || e) + '\n' + (e.stack || ''), 'err'); }
    $('zipBtn').disabled = !S.outputs.length;
  };

  function renderReport() {
    if (!S.rows.length) { reportWrap.innerHTML = '<p class="desc">Nothing converted yet.</p>'; return; }
    let h = '<table><tr><th>Input</th><th>Output</th><th>Status</th><th>Notes</th></tr>';
    for (const r of S.rows) {
      h += '<tr class="report-row"><td><code class="path">' + C.esc(r.input || '—') + '</code></td><td><code class="path">' + C.esc(r.output || '—') + '</code></td><td>' + pill(r.status, PILL[r.status] || 'p-gray') + '</td><td class="notes">' + (r.notes || []).map(C.esc).join('<br/>') + '</td></tr>';
    }
    reportWrap.innerHTML = h + '</table>';
  }

  function renderOutputs(o) {
    for (const f of S.outputs.slice(0, 60)) {
      const size = f.text !== undefined ? new Blob([f.text]).size : f.bytes.length;
      const d = document.createElement('div'); d.className = 'out-item';
      const code = document.createElement('code'); code.textContent = f.path + ' (' + (size / 1024).toFixed(1) + ' KB)';
      const b = document.createElement('button'); b.className = 'btn btn-g'; b.textContent = '⬇';
      b.onclick = () => C.download(f.path.split('/').pop(), f.text !== undefined ? f.text : f.bytes);
      d.appendChild(code); d.appendChild(b); outEl.appendChild(d);
    }
    if (S.outputs.length > 60) { const p = document.createElement('p'); p.className = 'desc'; p.textContent = '…and ' + (S.outputs.length - 60) + ' more (use the .zip).'; outEl.appendChild(p); }
    void o;
  }

  $('zipBtn').onclick = async () => {
    if (!S.outputs.length) return;
    const zip = new JSZip();
    for (const f of S.outputs) zip.file(f.path, f.text !== undefined ? f.text : f.bytes);
    let rep = 'FNF FULL-MOD CONVERSION REPORT\nGenerated in-browser by vslice-psych-converter.\n\n';
    for (const r of S.rows) rep += '[' + r.status.toUpperCase() + '] ' + (r.input || '?') + '\n  -> ' + (r.output || '(none)') + '\n' + (r.notes || []).map((n) => '     - ' + n).join('\n') + '\n';
    const root = opts().modName || '';
    zip.file((root ? root + '/' : '') + 'CONVERSION-REPORT.txt', rep);
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (root || 'fnf-converted-mod') + '.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
})();
