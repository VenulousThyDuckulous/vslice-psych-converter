/* Audio / asset path mapping between Psych and V-Slice mod layouts. */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  // ---- Psych -> V-Slice ----
  // psych rel path (under mod root) -> {out, note}
  // songKey: psych data folder name; songId: vslice id; cast: {player, opponent}
  function psychAudioToVSlice(rel, songKey, songId, cast) {
    const lower = rel.toLowerCase();
    let m = lower.match(/^songs\/(.+)\/(inst|voices(?:-(.+))?)\.(ogg|mp3|wav)$/);
    if (m) {
      const kind = m[2].toLowerCase(), postfix = m[3], ext = m[4];
      if (kind === 'inst') return { out: 'songs/' + songId + '/Inst.' + ext, note: null };
      // voices postfix -> vocalist file
      let who = postfix;
      if (!who) who = cast.opponent || 'dad';
      else if (/^player$/i.test(who)) who = cast.player || 'bf';
      else if (/^opponent$/i.test(who)) who = cast.opponent || 'dad';
      const note = !postfix ? 'Single Voices file mapped to opponent (' + who + '); V-Slice wants one Voices-<vocalist>.ogg per singer — split it if both voices are mixed in.' : null;
      return { out: 'songs/' + songId + '/Voices-' + who + '.' + ext, note };
    }
    if (/^(music|sounds|videos)\//.test(lower)) return { out: rel, note: null };
    return null;
  }
  // ---- V-Slice -> Psych ----
  // voicesForSong: [{file, vocalist}] collected per song id; single opponent-only -> Voices.ogg
  function vsliceAudioToPsych(rel, songId, songKey, cast, voicesCount) {
    const lower = rel.toLowerCase();
    let m = lower.match(/^songs\/(.+)\/(inst(?:-(.+))?|voices(?:-(.+))?)\.(ogg|mp3|wav)$/);
    if (m) {
      const base = m[2].toLowerCase(), instVar = m[3], who = m[4], ext = m[5];
      if (base.startsWith('inst')) {
        if (instVar) return { out: 'songs/' + songKey + '/Inst-' + instVar + '.' + ext, note: 'Variation instrumental Inst-' + instVar + ' has no Psych equivalent; kept for reference only.' };
        return { out: 'songs/' + songKey + '/Inst.' + ext, note: null };
      }
      // voices-<who>
      const pl = (cast.player || 'bf').toLowerCase(), op = (cast.opponent || 'dad').toLowerCase();
      const w = (who || '').toLowerCase();
      if (voicesCount === 1 && (w === op || !who)) return { out: 'songs/' + songKey + '/Voices.' + ext, note: null };
      if (w === pl) return { out: 'songs/' + songKey + '/Voices-Player.' + ext, note: null };
      if (w === op) return { out: 'songs/' + songKey + '/Voices-Opponent.' + ext, note: null };
      return { out: 'songs/' + songKey + '/Voices-' + (who || 'Opponent') + '.' + ext, note: 'Extra vocal track kept with its name; set vocals_file on the character to use it.' };
    }
    if (/^(music|sounds|videos)\//.test(lower)) return { out: rel, note: null };
    return null;
  }
  // ---- Images ----
  function psychImageToVSlice(rel) {
    // images/icons/icon-x.png -> images/icons/x.png (vslice health icon naming)
    let m = rel.match(/^images\/icons\/icon-(.+)\.png$/i);
    if (m) return { out: 'images/icons/' + m[1] + '.png', note: 'Health icon renamed to V-Slice convention; healthIcon id is the character id.' };
    return { out: rel, note: null };
  }
  function vsliceImageToPsych(rel) {
    const m = rel.match(/^images\/icons\/(.+)\.png$/i);
    if (m && !/^icon-/i.test(m[1])) return { out: 'images/icons/icon-' + m[1] + '.png', note: 'Health icon renamed to Psych convention (icon-<name>.png); set healthicon on the character.' };
    return { out: rel, note: null };
  }
  C.psychAudioToVSlice = psychAudioToVSlice;
  C.vsliceAudioToPsych = vsliceAudioToPsych;
  C.psychImageToVSlice = psychImageToVSlice;
  C.vsliceImageToPsych = vsliceImageToPsych;
})(window.FNFConv);
