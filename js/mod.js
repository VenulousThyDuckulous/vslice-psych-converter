/* Full-mod router: lists of classified files -> converted mod file lists + report.
   convertMod(files, opts) -> {outputs:[{path,text?,bytes?}], rows:[{input,output,status,notes}]} */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  const CONTENT_STARTS = ['data/', 'characters/', 'stages/', 'weeks/', 'songs/', 'music/', 'sounds/', 'images/', 'scripts/', 'custom_events/', 'custom_notetypes/', 'shaders/', 'fonts/', 'videos/', 'pack.json', '_polymod_meta.json'];
  // strip zip nesting (mods/Name/, Name/) -> path relative to mod root
  function modRel(path) {
    const p = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const low = p.toLowerCase();
    for (const c of CONTENT_STARTS) {
      const i = low.indexOf(c);
      if (i >= 0) return p.slice(i);
    }
    return p.split('/').pop();
  }
  function dirOf(rel) { const i = rel.lastIndexOf('/'); return i >= 0 ? rel.slice(0, i) : ''; }
  function baseOf(rel) { return rel.split('/').pop(); }
  function idOf(rel) { return baseOf(rel).replace(/\.json$/i, ''); }
  function join(root, rel) { return root ? root + '/' + rel : rel; }
  function enc(obj, pretty) { return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj); }

  function psychSongFolder(rec) {
    const rel = modRel(rec.path);
    const d = dirOf(rel); // data/<folder>
    const parts = d.split('/');
    if (parts.length >= 2 && parts[0].toLowerCase() === 'data') return parts.slice(1).join('/');
    return null;
  }
  function castOf(songObj, opts) {
    return { player: songObj.player1 || opts.p1, opponent: songObj.player2 || opts.p2, girlfriend: songObj.gfVersion || opts.gf };
  }

  function convertMod(files, opts) {
    const o = Object.assign({ direction: 'auto', modName: '', libPrefix: '', bpm: 120, speed: 1, events: true, pretty: true, stubs: true, p1: 'bf', p2: 'dad', gf: 'gf', stage: 'stage', psychFmt: 'psych_v1', song: '' }, opts);
    const P = files.filter((f) => /^(pchart|pevents|pdiag|pchar|pstage|pweek|pportrait|packjson|weeklist|luascript)$/.test(f.kind || ''));
    const V = files.filter((f) => /^(vchart|vmeta|vchar|vstage|vlevel|vconv|vspk|vbox|hscript|polymod)$/.test(f.kind || ''));
    let dir = o.direction;
    if (dir === 'auto') {
      if (P.length && !V.length) dir = 'p2v';
      else if (V.length && !P.length) dir = 'v2p';
      else if (P.length && V.length) dir = P.length >= V.length ? 'p2v' : 'v2p';
      else dir = 'p2v';
    }
    const root = (o.modName || '').trim().replace(/[\\/:*?"<>|]/g, '');
    return dir === 'p2v' ? convertPsychToVSlice(files, o, root) : convertVSliceToPsych(files, o, root);
  }

  /* ================= PSYCH -> V-SLICE ================= */
  function convertPsychToVSlice(files, o, root) {
    const outputs = [], rows = [];
    const out = (rel, content, row) => {
      const path = join(root, rel);
      if (content instanceof Uint8Array) outputs.push({ path, bytes: content });
      else outputs.push({ path, text: content });
      if (row) rows.push(Object.assign({ output: path }, row));
    };
    const charts = files.filter((f) => f.kind === 'pchart' && !f.err && f.songObj);
    const evRecs = files.filter((f) => f.kind === 'pevents' && !f.err);
    // group charts by song folder
    const groups = {};
    for (const r of charts) {
      const folder = psychSongFolder(r) || C.songId(r.songObj.song || r.song);
      (groups[folder] = groups[folder] || []).push(r);
    }
    const songIdOf = (folder, recs) => o.song && charts.length === 1 ? C.songId(o.song) : C.songId(folder.split('/').pop());
    for (const [folder, recs] of Object.entries(groups)) {
      const id = songIdOf(folder, recs);
      const extra = [];
      for (const e of evRecs) {
        const ef = psychSongFolder(e);
        if (ef === folder || (!ef && evRecs.length === 1)) {
          const so = e.songObj || (e.json.song && e.json.song.events ? e.json.song : null) || (Array.isArray(e.json.events) ? { events: e.json.events } : null);
          if (so && Array.isArray(so.events)) extra.push(...so.events);
        }
      }
      try {
        const primary = [...recs].sort((a, b) => (a.diff === 'hard' ? -1 : 1))[0];
        const cast = castOf(primary.songObj, o);
        const { chart, meta } = C.psychFilesToVSlice(recs, o, extra);
        out('data/songs/' + id + '/' + id + '-chart.json', enc(chart, o.pretty), { input: folder + ' (' + recs.length + ' chart(s))', status: 'converted', notes: [recs.map((r) => baseOf(r.path) + ': ' + r.notes + ' notes').join('; ')] });
        out('data/songs/' + id + '/' + id + '-metadata.json', enc(meta, o.pretty), { input: '(generated)', status: 'converted', notes: ['difficulties: ' + Object.keys(chart.notes).join(', '), 'BPM changes: ' + meta.timeChanges.length] });
        recs[0]._cast = cast; recs[0]._songId = id; recs[0]._folder = folder;
      } catch (e) { rows.push({ input: folder, output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    const castByFolder = {};
    for (const r of charts) if (r._cast) castByFolder[r._folder] = { cast: r._cast, id: r._songId };
    // dialogue
    const portraits = files.filter((f) => f.kind === 'pportrait');
    for (const r of files.filter((f) => f.kind === 'pdiag' && f.json)) {
      const folder = psychSongFolder(r) || '';
      const id = C.songId(folder.split('/').pop() || 'song');
      try {
        const { conv, speakers, box, notes } = C.psychDialogueToVSlice(r.json, id, portraits, o);
        out('data/dialogue/conversations/' + id + '.json', enc(conv, o.pretty), { input: modRel(r.path), status: 'converted', notes: [conv.dialogue.length + ' line(s)', ...notes] });
        for (const [sp, sj] of Object.entries(speakers))
          out('data/dialogue/speakers/' + sp + '.json', enc(sj, o.pretty), { input: '(generated speaker)', status: 'converted', notes: [] });
        if (!outputs.some((x) => x.path.endsWith('boxes/default.json')))
          out('data/dialogue/boxes/default.json', enc(box, o.pretty), { input: '(generated box)', status: 'converted', notes: ['Placeholder box; replace with real dialogue-box art.'] });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    // characters / stages / weeks
    for (const r of files.filter((f) => f.kind === 'pchar' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.psychCharToVSlice(r.json, id, o);
        out('data/characters/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    for (const r of files.filter((f) => f.kind === 'pstage' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.psychStageToVSlice(r.json, id, o);
        out('data/stages/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    for (const r of files.filter((f) => f.kind === 'pweek' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.psychWeekToVSlice(r.json, id, o);
        out('data/levels/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    // audio + images + misc passthrough
    for (const f of files) {
      const rel = modRel(f.path);
      if (/^(pchart|pevents|pdiag|pchar|pstage|pweek|pportrait)$/.test(f.kind || '')) {
        if (f.kind === 'pportrait') rows.push({ input: rel, output: '', status: 'consumed', notes: ['Portrait data folded into generated speakers.'] });
        continue;
      }
      if (f.kind === 'packjson') {
        const pj = f.json || {};
        out('_polymod_meta.json', enc({ title: pj.name || root || 'Converted Mod', description: pj.description || 'Converted from Psych Engine.', contributors: [], api_version: '0.8.0', mod_version: '1.0.0', license: 'Apache-2.0' }, o.pretty),
          { input: rel, status: 'converted', notes: ['Fill in contributors/license.'] });
        continue;
      }
      if (f.kind === 'weeklist') { rows.push({ input: rel, output: '', status: 'skipped', notes: ['V-Slice auto-scans data/levels/.'] }); continue; }
      if (f.bin !== undefined && /^(audio|image|imagexml|asset|hscript|other)$/.test(f.kind || '')) {
        // audio remap needs song context
        const m = rel.match(/^songs\/(.+?)\//i);
        if (f.kind === 'audio' && m) {
          const folder = Object.keys(castByFolder).find((k) => C.songId(k.split('/').pop()) === C.songId(m[1])) || m[1];
          const ctx = castByFolder[folder] || { cast: { player: o.p1, opponent: o.p2 }, id: C.songId(m[1]) };
          const r2 = C.psychAudioToVSlice(rel, m[1], ctx.id, ctx.cast);
          if (r2) { out(r2.out, f.bin, { input: rel, status: 'passthrough', notes: r2.note ? [r2.note] : [] }); continue; }
        }
        if (f.kind === 'image' || f.kind === 'imagexml') {
          const r2 = C.psychImageToVSlice(rel);
          out(r2.out, f.bin, { input: rel, status: 'passthrough', notes: r2.note ? [r2.note] : [] }); continue;
        }
        out(rel, f.bin, { input: rel, status: 'passthrough', notes: f.kind === 'hscript' ? ['HScript file copied; verify imports.'] : [] }); continue;
      }
      if (f.kind === 'luascript' && typeof f.text === 'string') {
        if (!o.stubs) { rows.push({ input: rel, output: '', status: 'skipped', notes: ['Script stubs disabled.'] }); continue; }
        const stub = hxsStub(rel, f.text);
        out(rel.replace(/\.lua$/i, '.hxs'), stub, { input: rel, status: 'stub', notes: ['Lua logic cannot auto-convert to HScript; original embedded as comments — rewrite needed.'] });
        continue;
      }
      if (f.text !== undefined && /other|asset/.test(f.kind || '') && /\.json$/i.test(rel)) {
        // unknown json under images/ (atlas data) etc: copy through
        out(rel, f.text, { input: rel, status: 'passthrough', notes: ['Unrecognized JSON copied as-is; verify in-game.'] }); continue;
      }
    }
    // portraits consumed note already added; meta if no pack.json
    if (!outputs.some((x) => /_polymod_meta\.json$/.test(x.path))) {
      out('_polymod_meta.json', enc({ title: root || 'Converted Mod', description: 'Converted from Psych Engine.', contributors: [], api_version: '0.8.0', mod_version: '1.0.0', license: 'Apache-2.0' }, o.pretty),
        { input: '(generated)', status: 'converted', notes: ['No pack.json found; fill in title/contributors.'] });
    }
    return { outputs, rows };
  }

  function hxsStub(srcPath, lua) {
    const commented = String(lua).split('\n').map((l) => '// ' + l).join('\n');
    return '// Converted from ' + srcPath + ' — STUB. Rewrite in HScript.\n// See https://funkincrew.github.io/funkin-modding-docs/ for the script API.\nfunction create() {\n  // TODO: port logic from the original Lua below\n}\n\n/* ORIGINAL LUA (reference, commented out):\n' + commented + '\n*/\n';
  }
  function luaStub(srcPath, hxs) {
    const commented = String(hxs).split('\n').map((l) => '-- ' + l).join('\n');
    return '-- Converted from ' + srcPath + ' -- STUB. Rewrite in Lua for Psych Engine.\n-- Original HScript kept below as reference.\nfunction onCreate()\n  -- TODO: port logic\nend\n\n--[[ ORIGINAL HSCRIPT (reference):\n' + commented + '\n]]\n';
  }

  /* ================= V-SLICE -> PSYCH ================= */
  function convertVSliceToPsych(files, o, root) {
    const outputs = [], rows = [];
    const out = (rel, content, row) => {
      const path = join(root, rel);
      if (content instanceof Uint8Array) outputs.push({ path, bytes: content });
      else outputs.push({ path, text: content });
      if (row) rows.push(Object.assign({ output: path }, row));
    };
    const charts = files.filter((f) => f.kind === 'vchart' && f.json);
    const metas = files.filter((f) => f.kind === 'vmeta' && f.json);
    const songDir = (r) => { const d = dirOf(modRel(r.path)); const p = d.split('/'); return p.length ? p[p.length - 1] : ''; };
    const metaFor = (id, variation) => metas.find((m) => songDir(m).toLowerCase() === String(id).toLowerCase() && (m.variation || '') === (variation || '')) || null;
    const groups = {};
    for (const r of charts) { const id = songDir(r) || r.song || 'song'; (groups[id] = groups[id] || []).push(r); }
    const charForSong = {};
    for (const [id, recs] of Object.entries(groups)) {
      // pair each chart file with its variation metadata (chart filename suffix)
      const byVar = {};
      for (const r of recs) {
        const m = baseOf(r.path).match(/-chart(\-.+?)?\.json$/i);
        const v = m && m[1] ? m[1].replace(/^\-/, '').toLowerCase() : '';
        (byVar[v] = byVar[v] || []).push(r);
      }
      for (const [variation, vrecs] of Object.entries(byVar)) {
        const m = metaFor(id, variation) || metaFor(id, '') || metas.find((x) => songDir(x).toLowerCase() === String(id).toLowerCase()) || null;
        const songKey = C.prettyName(variation ? id + ' ' + variation : id);
        try {
          const { outs } = C.vSliceToPsych({ json: vrecs[0].json, song: id, name: baseOf(vrecs[0].path) }, m, o);
          const opp = (m && m.json.playData && m.json.playData.characters && m.json.playData.characters.opponent) || o.p2;
          charForSong[C.songId(songKey)] = opp;
          for (const { diff, song } of outs) {
            const fname = outs.length > 1 ? songKey + '-' + diff + '.json' : songKey + '.json';
            out('data/' + songKey + '/' + fname, enc({ song }, o.pretty),
              { input: vrecs.map((r) => baseOf(r.path)).join(', '), status: 'converted', notes: [song.notes.reduce((a, s) => a + s.sectionNotes.length, 0) + ' notes in ' + song.notes.length + ' sections', variation ? 'variation "' + variation + '" exported as its own Psych song (Psych has no variations)' : 'diff: ' + diff] });
          }
          if (!m) rows.push({ input: baseOf(vrecs[0].path), output: '', status: 'warning', notes: ['No metadata found; used defaults (BPM/characters may need edits).'] });
        } catch (e) { rows.push({ input: baseOf(vrecs[0].path), output: '', status: 'error', notes: [String(e.message || e)] }); }
      }
    }
    // dialogue: conversations + speakers lookup
    const speakers = files.filter((f) => f.kind === 'vspk' && f.json);
    for (const r of files.filter((f) => f.kind === 'vconv' && f.json)) {
      const id = C.prettyName(songDir(r) || idOf(modRel(r.path)));
      try {
        const { dialogue, portraits, notes } = C.vsliceDialogueToPsych(r.json, id, speakers);
        out('data/' + id + '/dialogue.json', enc(dialogue, o.pretty), { input: modRel(r.path), status: 'converted', notes: [dialogue.dialogue.length + ' line(s)', ...notes] });
        for (const [p, pj] of Object.entries(portraits))
          out('images/dialogue/' + p + '.json', enc(pj, o.pretty), { input: '(generated portrait)', status: 'converted', notes: ['Point image at your portrait spritesheet.'] });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    for (const r of files.filter((f) => f.kind === 'vchar' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.vsliceCharToPsych(r.json, id, o);
        out('characters/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    for (const r of files.filter((f) => f.kind === 'vstage' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.vsliceStageToPsych(r.json, id);
        out('stages/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    for (const r of files.filter((f) => f.kind === 'vlevel' && f.json)) {
      const id = idOf(modRel(r.path));
      try {
        const { json, notes } = C.vsliceLevelToPsych(r.json, id, charForSong);
        out('weeks/' + id + '.json', enc(json, o.pretty), { input: modRel(r.path), status: 'converted', notes });
      } catch (e) { rows.push({ input: modRel(r.path), output: '', status: 'error', notes: [String(e.message || e)] }); }
    }
    // voices count per song dir for audio mapping
    const voicesByDir = {};
    for (const f of files) {
      if (f.kind !== 'audio') continue;
      const m = modRel(f.path).match(/^songs\/(.+?)\/voices-(.+)\.(ogg|mp3|wav)$/i);
      if (m) { const k = m[1].toLowerCase(); (voicesByDir[k] = voicesByDir[k] || []).push(m[2]); }
    }
    for (const f of files) {
      const rel = modRel(f.path);
      if (/^(vchart|vmeta|vchar|vstage|vlevel|vconv)$/.test(f.kind || '')) continue;
      if (f.kind === 'vspk' || f.kind === 'vbox') { rows.push({ input: rel, output: '', status: 'consumed', notes: ['Folded into generated Psych portraits/dialogue.'] }); continue; }
      if (f.kind === 'polymod') {
        const pm = f.json || {};
        const author = (pm.contributors && pm.contributors[0] && pm.contributors[0].name) || pm.author || '';
        out('pack.json', enc({ name: pm.title || root || 'Converted Mod', description: pm.description || 'Converted from V-Slice.' }, o.pretty),
          { input: rel, status: 'converted', notes: author ? ['Author was: ' + author] : [] });
        continue;
      }
      if (f.kind === 'hscript' && typeof f.text === 'string') {
        if (!o.stubs) { rows.push({ input: rel, output: '', status: 'skipped', notes: ['Script stubs disabled.'] }); continue; }
        out(rel.replace(/\.hxs?$/i, '.lua').replace(/\.hxc$/i, '.lua'), luaStub(rel, f.text),
          { input: rel, status: 'stub', notes: ['HScript logic cannot auto-convert to Lua; original embedded as comments — rewrite needed.'] });
        continue;
      }
      if (f.bin !== undefined && /^(audio|image|imagexml|asset|luascript|other)$/.test(f.kind || '')) {
        if (f.kind === 'audio') {
          const m = rel.match(/^songs\/(.+?)\/(.+)$/i);
          if (m) {
            const dirId = m[1];
            const meta = metas.find((x) => songDir(x).toLowerCase() === dirId.toLowerCase());
            const ch = (meta && meta.json.playData && meta.json.playData.characters) || {};
            const cast = { player: ch.player || o.p1, opponent: ch.opponent || o.p2 };
            const vc = (voicesByDir[dirId.toLowerCase()] || []).length;
            const r2 = C.vsliceAudioToPsych(rel, dirId, C.prettyName(dirId), cast, vc);
            if (r2) { out(r2.out, f.bin, { input: rel, status: 'passthrough', notes: r2.note ? [r2.note] : [] }); continue; }
          }
        }
        if (f.kind === 'image' || f.kind === 'imagexml') {
          const r2 = C.vsliceImageToPsych(rel);
          const extra = /Animation\.json$/i.test(rel) || /spritemap/i.test(rel) ? ['Animate-atlas data copied; Psych needs Sparrow XML (.png+.xml) — re-export if it fails to load.'] : [];
          out(r2.out, f.bin, { input: rel, status: 'passthrough', notes: (r2.note ? [r2.note] : []).concat(extra) }); continue;
        }
        if (/_merge\//i.test(rel)) { rows.push({ input: rel, output: '', status: 'skipped', notes: ['_merge JSON patches have no Psych equivalent.'] }); continue; }
        out(rel, f.bin, { input: rel, status: 'passthrough', notes: [] }); continue;
      }
      if (f.text !== undefined && /\.json$/i.test(rel)) {
        out(rel, f.text, { input: rel, status: 'passthrough', notes: ['Unrecognized JSON copied as-is; verify in-game.'] }); continue;
      }
    }
    if (!outputs.some((x) => /(^|\/)pack\.json$/.test(x.path))) {
      out('pack.json', enc({ name: root || 'Converted Mod', description: 'Converted from V-Slice.' }, o.pretty),
        { input: '(generated)', status: 'converted', notes: ['No _polymod_meta.json found.'] });
    }
    return { outputs, rows };
  }

  C.convertMod = convertMod;
  C.modRel = modRel;
})(window.FNFConv);
