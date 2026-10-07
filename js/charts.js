/* Chart conversion: Psych Engine <-> V-Slice.
   Lane conventions (verified vs moonchart + official charts):
   - V-Slice d: 0-3 = player (BF), 4-7 = opponent.
   - Psych psych_v1 absolute: 0-3 = player, 4-7 = opponent (identical numbering).
   - Psych legacy (relative): mustHit=true -> same numbers; mustHit=false -> +4 mod 8. */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  function psychDirToVSlice(dir, mustHit, isV1, flip) {
    dir = Math.round(Number(dir)); if (!Number.isFinite(dir)) return null;
    if (dir < 0) return null;
    const r = ((dir % 8) + 8) % 8;
    if (!flip) return r;
    if (isV1) return r;
    return mustHit ? r : (r + 4) % 8;
  }
  function vSliceToPsychDir(d, mustHit, targetV1, flip) {
    const r = ((Math.round(Number(d)) % 8) + 8) % 8;
    if (!flip) return r;
    if (targetV1 !== 'legacy') return r;
    return mustHit ? r : (r + 4) % 8;
  }
  const NOTEKIND_P2V = { 'Alt Animation': 'mom' };
  const NOTEKIND_V2P = { 'mom': 'Alt Animation' };
  function stepCrochet(bpm) { return 60000 / (bpm || 120) / 4; }
  function bpmAt(tc, t) {
    let b = tc[0] ? tc[0].bpm : 120;
    for (const c of tc) { if ((c.t ?? 0) <= t) b = c.bpm || b; }
    return b || 120;
  }

  // psychRecs: [{song, diff, songObj}], extraEvents: [[time, [[name,v1,v2]...]]...] from standalone events.json
  function psychFilesToVSlice(psychRecs, opts, extraEvents) {
    const songId = (opts.song || psychRecs[0].song || 'song').replace(/\s+/g, '').toLowerCase() || 'song';
    const songName = opts.song || psychRecs[0].songObj.song || songId;
    const first = psychRecs[0].songObj;
    const bpm0 = Number(first.bpm) || opts.bpm;
    let timeChanges = [];
    {
      let c = 0, b = 0, cur = Number(first.bpm) || bpm0, firstPushed = false;
      for (const sec of (first.notes || [])) {
        const steps = Number(sec.lengthInSteps) || 16;
        const sBeats = Number(sec.sectionBeats) || steps / 4;
        const sBpm = Number(sec.bpm) || cur;
        const chg = !!(sec.changeBPM || sec.changeBpm);
        if (c === 0 || (chg && sBpm !== cur)) {
          if (!(c === 0 && firstPushed)) timeChanges.push({ t: Math.round(c), b: Math.round(b * 4) / 4, bpm: sBpm, bt: [4, 4] });
          firstPushed = true;
        }
        if (chg && sBpm) cur = sBpm;
        c += sBeats * 60000 / cur; b += sBeats;
      }
    }
    if (!timeChanges.length) timeChanges = [{ t: 0, b: 0, bpm: bpm0, bt: [4, 4] }];
    const bpmAtT = (t) => bpmAt(timeChanges, t);
    const diffs = {}, speeds = {};
    let allEvents = [];
    const pushPsychEvent = (t, nm, v1, v2) => {
      if (/^hey!$/i.test(nm)) {
        allEvents.push({ t: Math.round(Number(t) || 0), e: 'PlayAnimation', v: { target: /bf/i.test(String(v1 || '')) ? 'boyfriend' : 'dad', anim: 'hey', force: true } });
      } else {
        allEvents.push({ t: Math.round(Number(t) || 0), e: String(nm || 'Event'), v: { v1: String(v1 ?? ''), v2: String(v2 ?? '') } });
      }
    };
    for (const rec of psychRecs) {
      const so = rec.songObj, diff = (rec.diff || 'hard').toLowerCase();
      const isV1 = String(so.format || '').startsWith('psych_v1');
      const arr = [];
      for (const sec of (so.notes || [])) {
        const must = !!sec.mustHitSection;
        for (const n of (sec.sectionNotes || [])) {
          if (!Array.isArray(n) || n.length < 2) continue;
          const [t, lane2, sus, kind] = n;
          if (typeof lane2 === 'string' || (Number(lane2) < 0)) {
            if (opts.events) pushPsychEvent(t, n[1], n[2], n[3]);
            continue;
          }
          const d = psychDirToVSlice(Number(lane2), must, isV1, opts.flip);
          if (d === null) continue;
          const tt = Math.round(Number(t) || 0);
          const o = { t: tt, d };
          const raw = Number(sus) || 0;
          if (raw > 0) o.l = Math.round(raw + stepCrochet(bpmAtT(tt)) * 0.5);
          let k = 'normal';
          if (typeof kind === 'string' && kind) k = NOTEKIND_P2V[kind] || kind;
          else if (typeof kind === 'number' && kind !== 0) k = 'note-' + kind;
          if (k && k !== 'normal') o.k = k;
          arr.push(o);
        }
      }
      arr.sort((a, b2) => a.t - b2.t);
      diffs[diff] = arr; speeds[diff] = Number(so.speed) || opts.speed;
      if (opts.events && Array.isArray(so.events)) {
        for (const ev of so.events) {
          if (!Array.isArray(ev)) continue;
          for (const s of (ev[1] || [])) pushPsychEvent(ev[0], s[0], s[1], s[2]);
        }
      }
    }
    if (opts.events && Array.isArray(extraEvents)) {
      for (const ev of extraEvents) {
        if (!Array.isArray(ev)) continue;
        for (const s of (ev[1] || [])) pushPsychEvent(ev[0], s[0], s[1], s[2]);
      }
    }
    if (opts.events && !allEvents.some((e) => e.e === 'FocusCamera')) {
      let c = 0, cur = bpm0, last = null;
      for (const sec of (first.notes || [])) {
        const steps = Number(sec.lengthInSteps) || 16;
        const sBeats = Number(sec.sectionBeats) || steps / 4;
        if (sec.changeBPM || sec.changeBpm) cur = Number(sec.bpm) || cur;
        const must = !!sec.mustHitSection;
        if (must !== last) { allEvents.push({ t: Math.round(c), e: 'FocusCamera', v: { char: must ? 0 : 1 } }); last = must; }
        c += sBeats * 60000 / cur;
      }
    }
    allEvents.sort((a, b2) => a.t - b2.t);
    const chart = { version: '2.0.0', scrollSpeed: speeds, notes: diffs, events: allEvents, generatedBy: "FNF Psych-VSlice Converter (browser)" };
    const meta = {
      songName, artist: first.artist || 'Unknown', charter: 'Converted from Psych Engine',
      playData: { difficulties: Object.keys(diffs), characters: { player: first.player1 || opts.p1, opponent: first.player2 || opts.p2, girlfriend: first.gfVersion || opts.gf }, stage: first.stage || opts.stage, noteStyle: 'funkin', ratings: {} },
      timeChanges, generatedBy: 'FNF Psych-VSlice Converter (browser)'
    };
    return { songId, chart, meta };
  }

  // chartRec: {json, song, name}, metaRec: {json} | null
  function vSliceToPsych(chartRec, metaRec, opts) {
    const chart = chartRec.json;
    const meta = metaRec ? metaRec.json : null;
    const tc = (meta && meta.timeChanges) || [{ t: 0, bpm: opts.bpm }];
    const songId = (opts.song || (meta && meta.songName) || chartRec.song || 'song');
    const songName = (meta && meta.songName) || songId;
    const chars = (meta && meta.playData && meta.playData.characters) || {};
    const stage = (meta && meta.playData && meta.playData.stage) || opts.stage;
    const diffs = Object.keys(chart.notes || {});
    const useDiffs = diffs.length ? diffs : ['hard'];
    const outs = [];
    for (const diff of useDiffs) {
      const notes = [...(chart.notes[diff] || [])].sort((a, b2) => a.t - b2.t);
      const sections = [];
      let sStart = 0, sBpm = bpmAt(tc, 0), sNotes = [];
      const winDur = () => 4 * 60000 / sBpm;
      const allNs = notes.map((n) => ({ n, p: ((Math.round(Number(n.d)) % 8) + 8) % 8 }));
      for (const { n, p } of allNs) {
        while (n.t >= sStart + winDur() && sNotes.length) {
          const pc = sNotes.filter((x) => x[1] < 4).length;
          const must = pc >= sNotes.length / 2;
          if (opts.psychFmt === 'legacy' && !must) sNotes.forEach((x) => x[1] = (x[1] + 4) % 8);
          sections.push({ lengthInSteps: 16, sectionBeats: 4, mustHitSection: must, bpm: sBpm, changeBPM: false, sectionNotes: sNotes.map((x) => [x[0], x[1], x[2], ...x.slice(3)]) });
          sStart += winDur(); sBpm = bpmAt(tc, sStart); sNotes = [];
        }
        const rawL = Number(n.l || 0);
        const adjL = rawL > 0 ? Math.max(0, Math.round(rawL - stepCrochet(bpmAt(tc, n.t)) * 0.5)) : 0;
        const sn = [Math.round(n.t), p, adjL];
        const kk = n.k && n.k !== 'normal' ? (NOTEKIND_V2P[n.k] || n.k) : null;
        if (kk) sn.push(kk);
        sNotes.push(sn);
      }
      if (sNotes.length || !sections.length) {
        const pc = sNotes.filter((x) => x[1] < 4).length;
        const must = sNotes.length ? pc >= sNotes.length / 2 : true;
        if (opts.psychFmt === 'legacy' && !must) sNotes.forEach((x) => x[1] = (x[1] + 4) % 8);
        sections.push({ lengthInSteps: 16, sectionBeats: 4, mustHitSection: must, bpm: sBpm, changeBPM: false, sectionNotes: sNotes });
      }
      const sectionTime = (ix) => { let t = 0; for (let k = 0; k < ix; k++) t += 4 * 60000 / (sections[k].bpm || 120); return t; };
      let seen = tc[0] ? tc[0].bpm : sBpm;
      sections.forEach((s, ix) => {
        const b = bpmAt(tc, ix === 0 ? 0 : sectionTime(ix));
        if (ix === 0) { s.bpm = b; s.changeBPM = false; seen = b; }
        else if (b !== seen) { s.bpm = b; s.changeBPM = true; seen = b; }
      });
      const song = {
        song: songName, bpm: bpmAt(tc, 0), needsVoices: true,
        speed: (chart.scrollSpeed && (chart.scrollSpeed[diff] ?? chart.scrollSpeed.normal)) || opts.speed,
        player1: chars.player || opts.p1, player2: chars.opponent || opts.p2, gfVersion: chars.girlfriend || opts.gf, stage,
        format: opts.psychFmt === 'legacy' ? undefined : 'psych_v1', notes: sections
      };
      if (opts.psychFmt === 'legacy') delete song.format;
      if (opts.events && Array.isArray(chart.events) && chart.events.length) {
        const evs = [];
        for (const e of chart.events) {
          const t = Math.round(e.t || 0);
          if (e.e === 'FocusCamera') continue;
          if (e.e === 'PlayAnimation' && e.v && typeof e.v === 'object') {
            if (String(e.v.anim || '').toLowerCase() === 'hey') evs.push([t, [['Hey!', /boyfriend|bf/i.test(String(e.v.target || '')) ? 'BF' : 'dad', '']]]);
            else evs.push([t, [['Play Animation', String(e.v.anim || ''), /boyfriend|bf/i.test(String(e.v.target || '')) ? 'bf' : String(e.v.target || 'dad')]]]);
          } else if (e.e === 'ZoomCamera') {
            evs.push([t, [['Add Camera Zoom', String(e.v?.zoom ?? ''), '']]]);
          } else {
            evs.push([t, [[e.e || 'Event', typeof e.v === 'object' ? JSON.stringify(e.v ?? {}) : String(e.v ?? ''), '']]]);
          }
        }
        if (evs.length) song.events = evs;
      }
      outs.push({ diff, song });
    }
    return { songId: String(songId).replace(/\s+/g, '').toLowerCase(), outs };
  }

  C.psychDirToVSlice = psychDirToVSlice;
  C.vSliceToPsychDir = vSliceToPsychDir;
  C.psychFilesToVSlice = psychFilesToVSlice;
  C.vSliceToPsych = vSliceToPsych;
  C.bpmAt = bpmAt;
  C.stepCrochet = stepCrochet;
})(window.FNFConv);
