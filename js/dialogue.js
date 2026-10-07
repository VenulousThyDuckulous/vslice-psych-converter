/* Dialogue conversion:
   Psych data/<song>/dialogue.json <-> V-Slice data/dialogue/{conversations,speakers,boxes}/*.json */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  // Find a psych portrait file for a portrait id among input files (images/dialogue/<x>.json)
  function findPortrait(files, portrait) {
    const key = String(portrait || '').toLowerCase();
    return files.find((f) => f.kind === 'pportrait' && (f.path || '').toLowerCase().endsWith('/' + key + '.json')) || null;
  }
  // Psych -> V-Slice. Emits conversation + auto speakers/box. portraitFiles: classified pportrait recs.
  function psychDialogueToVSlice(d, id, portraitFiles, opts) {
    const notes = [];
    const speakers = {}; // speakerId -> speaker json
    const ensureSpeaker = (portrait) => {
      if (speakers[portrait]) return;
      const pf = findPortrait(portraitFiles || [], portrait);
      const pj = pf && pf.json;
      const img = pj && pj.image ? C.stripLib(pj.image) : ('dialogue/' + portrait);
      const talkAnim = pj && pj.animations && pj.animations.find((a) => /talk|idle/i.test(a.anim || ''));
      speakers[portrait] = {
        version: '1.0.0', name: C.prettyName(portrait),
        assetPath: C.withLib(img, opts.libPrefix || ''),
        flipX: false, isPixel: false, scale: (pj && pj.scale) || 1.0,
        offsets: (pj && pj.position) || [0, 0],
        animations: [
          { name: 'talk', prefix: (talkAnim && (talkAnim.loop_name || talkAnim.idle_name)) || 'talk' },
          { name: 'talkEnter', prefix: (talkAnim && (talkAnim.loop_name || talkAnim.idle_name)) || 'talk' }
        ]
      };
      if (!pf) notes.push('No portrait file found for "' + portrait + '"; speaker uses images/dialogue/' + portrait + ' art by guess — fix assetPath if wrong.');
    };
    const lines = (d.dialogue || []).map((ln) => {
      const sp = ln.portrait || 'bf';
      ensureSpeaker(sp);
      const expr = ln.expression || 'talk';
      return {
        speaker: sp,
        speakerAnimation: /talk|idle|enter/i.test(expr) ? expr : 'talk',
        box: 'default', boxAnimation: 'idle', text: [ln.text || '']
      };
    });
    const conv = {
      version: '1.0.0',
      backdrop: { type: 'solid', fadeTime: 0.5, color: '#00000000' },
      music: { asset: '', fadeTime: 0, looped: true },
      outro: { type: 'fade', fadeTime: 0.5 },
      dialogue: lines
    };
    const box = {
      version: '1.1.0', name: 'Default', assetPath: 'dialogue/box',
      flipX: false, flipY: false, offsets: [0, 0], scale: 1.0,
      text: { offsets: [100, 100], width: 800, color: '#FFFFFF', fontFamily: 'Arial', shadowColor: '#000000', shadowWidth: 2 },
      animations: [{ name: 'idle', prefix: 'idle', looped: true }]
    };
    notes.push('Typing speed/sound per line dropped (V-Slice boxes own text settings).');
    notes.push('Auto-generated speakers + a placeholder "default" box; point box.assetPath at real dialogue-box art.');
    return { conv, speakers, box, notes };
  }
  // V-Slice conversation (+ its speakers) -> Psych dialogue.json + portrait files.
  function vsliceDialogueToPsych(conv, id, speakerRecs) {
    const notes = [];
    const byName = {};
    for (const s of (speakerRecs || [])) {
      const sid = (s.path || s.name || '').split('/').pop().replace(/\.json$/i, '');
      byName[sid.toLowerCase()] = s.json;
    }
    const lines = (conv.dialogue || []).map((ln) => {
      const sp = ln.speaker || 'bf';
      return {
        portrait: sp, expression: ln.speakerAnimation || 'talk',
        text: Array.isArray(ln.text) ? ln.text.join(' ') : String(ln.text || ''),
        boxState: /angry/i.test(ln.box || '') || /angry/i.test(sp) ? 'angry' : 'normal',
        speed: 0.05
      };
    });
    // portrait files: one per speaker, talk/idle anims from speaker prefixes
    const portraits = {};
    for (const ln of lines) {
      if (portraits[ln.portrait]) continue;
      const sj = byName[String(ln.portrait).toLowerCase()];
      const talk = sj && sj.animations && sj.animations.find((a) => a.name === 'talk');
      const idle = sj && sj.animations && sj.animations.find((a) => a.name === 'idle');
      portraits[ln.portrait] = {
        image: sj ? C.stripLib(sj.assetPath || ('dialogue/' + ln.portrait)) : ('dialogue/' + ln.portrait),
        dialogue_pos: 'left', no_antialiasing: !(sj && sj.isPixel),
        position: (sj && sj.offsets) || [0, 0], scale: (sj && sj.scale) || 1.0,
        animations: [{
          anim: 'talk', loop_name: (talk && talk.prefix) || 'talk', loop_offsets: (talk && talk.offsets) || [0, 0],
          idle_name: (idle && idle.prefix) || 'idle', idle_offsets: (idle && idle.offsets) || [0, 0]
        }]
      };
    }
    if (conv.music && conv.music.asset) notes.push('Conversation music "' + conv.music.asset + '" must be triggered via startDialogue(name, music) in a song script.');
    notes.push('Multi-page lines joined with spaces; re-split in the Psych dialogue editor if needed.');
    return { dialogue: { dialogue: lines }, portraits, notes };
  }
  C.psychDialogueToVSlice = psychDialogueToVSlice;
  C.vsliceDialogueToPsych = vsliceDialogueToPsych;
})(window.FNFConv);
