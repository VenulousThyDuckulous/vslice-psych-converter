/* File classification for Psych Engine and V-Slice mod files. */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  // rec: {name, path, json?/text?, bin?}
  function classify(r) {
    const p = (r.path || r.name || '').replace(/\\/g, '/');
    const lower = p.toLowerCase();
    const base = lower.split('/').pop();
    const j = r.json;
    if (j && typeof j === 'object') {
      const inDataChars = /(^|\/)data\/characters\//.test(lower);
      const inChars = /(^|\/)characters\//.test(lower) && !inDataChars;
      const inDataStages = /(^|\/)data\/stages\//.test(lower);
      const inStages = /(^|\/)stages\//.test(lower) && !inDataStages;
      const inWeeks = /(^|\/)weeks\//.test(lower);
      const inLevels = /(^|\/)data\/levels\//.test(lower);
      const inConv = /(^|\/)data\/dialogue\/conversations\//.test(lower);
      const inSpk = /(^|\/)data\/dialogue\/speakers\//.test(lower);
      const inBox = /(^|\/)data\/dialogue\/boxes\//.test(lower);
      // V-Slice chart: notes object keyed by difficulty
      if (j.notes && typeof j.notes === 'object' && !Array.isArray(j.notes) && (j.version !== undefined || j.scrollSpeed !== undefined)) {
        const m = base.match(/(.+?)-chart(\-.+?)?\.json$/);
        r.kind = 'vchart'; r.song = m ? m[1] : ''; r.diffs = Object.keys(j.notes);
        r.notes = Object.values(j.notes).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
        return r;
      }
      // V-Slice metadata
      if (j.playData || (j.songName && j.timeChanges)) {
        const m = base.match(/(.+?)-metadata(\-.+?)?\.json$/);
        r.kind = 'vmeta'; r.song = j.songName || (m ? m[1] : '');
        r.variation = m && m[2] ? m[2].replace(/^\-/, '') : '';
        return r;
      }
      // Psych dialogue
      if (Array.isArray(j.dialogue)) { r.kind = 'pdiag'; r.notes = j.dialogue.length; return r; }
      // V-Slice dialogue pieces by folder
      if (inConv) { r.kind = 'vconv'; return r; }
      if (inSpk) { r.kind = 'vspk'; return r; }
      if (inBox) { r.kind = 'vbox'; return r; }
      // Psych character (loose or characters/ folder, has animations+image)
      const looksChar = Array.isArray(j.animations) && (typeof j.image === 'string' || typeof j.assetPath === 'string');
      if (looksChar) {
        if (typeof j.assetPath === 'string' || inDataChars) { r.kind = 'vchar'; return r; }
        r.kind = 'pchar'; return r;
      }
      // Weeks/levels BEFORE stages: an empty props[] must not misroute a level.
      // V-Slice level: songs is a string array (ids).
      if (inLevels || j.titleAsset !== undefined || (Array.isArray(j.songs) && typeof j.songs[0] === 'string')) { r.kind = 'vlevel'; return r; }
      // Psych week: songs is an array of [name, char, color] tuples.
      if (inWeeks || j.weekName !== undefined || j.weekCharacters !== undefined || (Array.isArray(j.songs) && Array.isArray(j.songs[0]))) { r.kind = 'pweek'; return r; }
      // Stages: psych has boyfriend/opponent slots or objects[]; vslice has props[]+cameraZoom/characters.
      if (inDataStages || (Array.isArray(j.props) && (j.cameraZoom !== undefined || j.characters !== undefined))) { r.kind = 'vstage'; return r; }
      if (inStages || Array.isArray(j.objects) || j.boyfriend || j.opponent) { r.kind = 'pstage'; return r; }
      if (Array.isArray(j.props)) { r.kind = 'vstage'; return r; }
      // Psych chart: song branch with sectionNotes
      const inner = j.song && j.song.song && j.song.notes ? j.song : (j.song && j.song.song && j.song.song.notes ? j.song.song : null);
      const songObj = inner || (j.song && Array.isArray(j.notes) ? j : null);
      if (songObj && Array.isArray(songObj.notes) && songObj.notes.length && songObj.notes[0].sectionNotes !== undefined) {
        // standalone events.json is SwagSong-shaped but came from events.json filename + non-empty events + empty notes
        const evOnly = /events\.json$/.test(lower) && Array.isArray(songObj.events) && songObj.events.length &&
          songObj.notes.every((s) => !(s.sectionNotes && s.sectionNotes.length));
        if (evOnly) { r.kind = 'pevents'; r.notes = songObj.events.length; r.songObj = songObj; return r; }
        r.kind = 'pchart'; r.songObj = songObj;
        r.song = String(songObj.song || base.replace(/-(easy|normal|hard|erect|nightmare)[^.]*\.json$/i, '').replace(/\.json$/i, ''));
        r.diff = guessDiff(base);
        r.notes = songObj.notes.reduce((a, s) => a + (s.sectionNotes ? s.sectionNotes.length : 0), 0);
        return r;
      }
      if (j.song && Array.isArray(j.song.events) && !j.song.notes) { r.kind = 'pevents'; r.notes = j.song.events.length; r.songObj = j.song; return r; }
      if (/events\.json$/.test(lower) && Array.isArray(j.events)) { r.kind = 'pevents'; r.notes = j.events.length; return r; }
      if (/pack\.json$/.test(lower) && (j.name !== undefined || j.title !== undefined)) { r.kind = 'packjson'; return r; }
      if (/_polymod_meta\.json$/.test(lower)) { r.kind = 'polymod'; return r; }
      if (/weeklist\.txt$/.test(lower)) { r.kind = 'weeklist'; return r; }
      // Psych dialogue portrait (images/dialogue/*.json with loop_name anims)
      if (/(^|\/)images\/dialogue\//.test(lower) && Array.isArray(j.animations) && j.animations[0] && j.animations[0].loop_name !== undefined) {
        r.kind = 'pportrait'; return r;
      }
    } else if (r.bin !== undefined || r.text !== undefined) {
      if (/\.ogg$|\.mp3$|\.wav$/i.test(base)) r.kind = 'audio';
      else if (/\.png$|\.xml$|\.txt$|\.frag$|\.vert$|\.ttf$|\.otf$|\.mp4$|\.json$/i.test(base)) {
        if (/\.lua$/i.test(base)) r.kind = 'luascript';
        else if (/\.hx$|\.hxs$|\.hxc$/i.test(base)) r.kind = 'hscript';
        else if (/\.png$/i.test(base)) r.kind = 'image';
        else if (/\.xml$/i.test(base)) r.kind = 'imagexml';
        else r.kind = 'asset';
      } else r.kind = 'asset';
      if (/\.lua$/i.test(base)) r.kind = 'luascript';
      if (/\.hx$|\.hxs$|\.hxc$/i.test(base)) r.kind = 'hscript';
      return r;
    }
    r.kind = r.kind || 'other';
    return r;
  }
  function guessDiff(name) {
    const m = name.match(/-(easy|normal|hard|erect|nightmare|hard-erect|easy-erect)(?=\.json)/i);
    return m ? m[1].toLowerCase() : 'hard';
  }
  C.classify = classify;
  C.guessDiff = guessDiff;
})(window.FNFConv);
