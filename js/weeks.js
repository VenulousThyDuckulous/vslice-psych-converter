/* Week conversion: Psych weeks/*.json <-> V-Slice data/levels/*.json */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  // Psych week -> V-Slice level. songIds: display song names already in this week.
  function psychWeekToVSlice(w, id, opts) {
    const notes = [];
    const songs = (w.songs || []).map((s) => Array.isArray(s) ? C.songId(s[0]) : C.songId(s));
    const out = {
      version: '1.0.0', name: w.weekName || w.storyName || C.prettyName(id),
      titleAsset: 'storymenu/titles/' + id,
      background: w.weekBackground || '#F9CF51',
      songs, visible: !w.hideStoryMode,
      props: []
    };
    if (w.hideFreeplay) notes.push('hideFreeplay=true has no V-Slice equivalent; all level songs appear in Freeplay.');
    if (w.difficulties) notes.push('Custom difficulties "' + w.difficulties + '" dropped; V-Slice difficulties come from each song\'s metadata.');
    if (w.weekBefore || w.startUnlocked === false || w.hiddenUntilUnlocked) notes.push('Unlock chain (weekBefore/startUnlocked) has no V-Slice equivalent; all levels are listed.');
    if ((w.weekCharacters || []).length) notes.push('weekCharacters menu dolls dropped; recreate them as story-menu props if wanted.');
    if (!/^(#|0x)/.test(out.background)) notes.push('weekBackground "' + out.background + '" kept as an image path (relative to images/); use a hex color like "#F9CF51" for a flat background.');
    notes.push('titleAsset points at storymenu/titles/' + id + ' — add that image or remove the field.');
    void opts;
    return { json: out, notes };
  }
  // V-Slice level -> Psych week. charForSong: {songId: opponentChar} for freeplay colors/capsules.
  function vsliceLevelToPsych(l, id, charForSong) {
    const notes = [];
    const songs = (l.songs || []).map((sid) => [C.prettyName(sid), (charForSong && charForSong[sid]) || 'dad', [146, 113, 253]]);
    const out = {
      songs,
      weekCharacters: ['dad', 'bf', 'gf'],
      weekBackground: /^#/.test(l.background || '') ? 'stage' : (l.background || 'stage'),
      storyName: l.name || C.prettyName(id),
      weekName: l.name || C.prettyName(id),
      startUnlocked: true, hideStoryMode: false, hideFreeplay: false
    };
    if (/^#/.test(l.background || '')) notes.push('Hex background "' + l.background + '" mapped to stage image "stage"; set weekBackground to your menu art.');
    if ((l.props || []).length) notes.push(l.props.length + ' story-menu prop(s) dropped; weekCharacters dolls use the three character ids above.');
    if (l.visible === false) notes.push('visible=false mapped to a normal unlocked week; hide it manually if it should be Freeplay-only.');
    notes.push('Freeplay colors defaulted; per-song capsule colors/characters can be edited above.');
    return { json: out, notes };
  }
  C.psychWeekToVSlice = psychWeekToVSlice;
  C.vsliceLevelToPsych = vsliceLevelToPsych;
})(window.FNFConv);
