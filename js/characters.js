/* Character conversion: Psych characters/*.json <-> V-Slice data/characters/*.json */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  // Psych -> V-Slice. id: character id (filename). Returns {json, notes[]}.
  function psychCharToVSlice(p, id, opts) {
    const notes = [];
    const anims = [];
    for (const a of (p.animations || [])) {
      const o = { name: a.anim, prefix: a.name };
      if (a.fps !== undefined && a.fps !== 24) o.frameRate = a.fps;
      if (Array.isArray(a.indices) && a.indices.length) o.frameIndices = a.indices;
      if (Array.isArray(a.offsets) && (a.offsets[0] || a.offsets[1])) o.offsets = a.offsets;
      if (a.loop) o.looped = true;
      anims.push(o);
    }
    if (typeof p.image === 'string' && p.image.includes(',')) {
      notes.push('Multi-atlas image ("a, b") flattened to first sheet; split into per-animation assetPath shards manually (multisparrow).');
    }
    const image = String(p.image || ('characters/' + id)).split(',')[0].trim();
    const hasDance = (p.animations || []).some((a) => /dance/i.test(a.anim || ''));
    const out = {
      version: '1.0.0', name: C.prettyName(id), renderType: 'sparrow',
      assetPath: C.withLib(image, opts.libPrefix || ''),
      scale: p.scale ?? 1.0,
      flipX: !!p.flip_x,
      isPixel: !!p.no_antialiasing,
      offsets: Array.isArray(p.position) ? p.position : [0, 0],
      cameraOffsets: Array.isArray(p.camera_position) ? p.camera_position : [0, 0],
      singTime: (p.sing_duration ?? 4) * 2,
      danceEvery: hasDance ? 1.0 : undefined,
      healthIcon: { id: p.healthicon || id },
      animations: anims
    };
    if (out.danceEvery === undefined) delete out.danceEvery;
    if (!anims.length) notes.push('No animations found; add them in the V-Slice chart editor.');
    C.note(notes, null);
    if (p.healthbar_colors) notes.push('healthbar_colors has no V-Slice equivalent (health color comes from the icon graphic); dropped.');
    if (p.vocals_file) notes.push('vocals_file "' + p.vocals_file + '" has no V-Slice equivalent; map it to a Voices-<name>.ogg file instead (see audio report).');
    if (p._editor_isPlayer !== undefined) notes.push('Editor-only _editor_isPlayer dropped.');
    return { json: out, notes };
  }
  // V-Slice -> Psych. Returns {json, notes[]}.
  function vsliceCharToPsych(v, id, opts) {
    const notes = [];
    const anims = [];
    for (const a of (v.animations || [])) {
      const o = { anim: a.name, name: a.prefix || a.name, fps: a.frameRate ?? 24, loop: !!a.looped, indices: Array.isArray(a.frameIndices) ? a.frameIndices : [], offsets: Array.isArray(a.offsets) ? a.offsets : [0, 0] };
      anims.push(o);
      if (a.assetPath && a.assetPath !== v.assetPath) notes.push('Per-animation assetPath shard "' + a.assetPath + '" merged into main image; multi-atlas needs manual split (comma image list).');
      if (a.animType === 'symbol') notes.push('Animation "' + a.name + '" uses animType symbol (Animate atlas); Psych needs Sparrow XML prefixes — re-export art or verify in-game.');
    }
    const img = C.stripLib(v.assetPath || ('characters/' + id));
    const out = {
      animations: anims,
      no_antialiasing: !!v.isPixel,
      image: img,
      position: Array.isArray(v.offsets) ? v.offsets : [0, 0],
      healthicon: (v.healthIcon && v.healthIcon.id) || id,
      flip_x: !!v.flipX,
      healthbar_colors: [161, 161, 161],
      camera_position: Array.isArray(v.cameraOffsets) ? v.cameraOffsets : [0, 0],
      sing_duration: (v.singTime ?? 8) / 2,
      scale: v.scale ?? 1.0
    };
    notes.push('healthbar_colors reset to gray; set your RGB in the Psych character editor.');
    if (/animateatlas|custom/.test(v.renderType || '')) notes.push('renderType "' + v.renderType + '" (Animate atlas) has no direct Psych equivalent; keeping assetPath — re-export as Sparrow XML (.png+.xml) if it fails to load.');
    if (v.death) notes.push('death camera data has no Psych equivalent; dropped.');
    if (v.danceEvery !== undefined && v.danceEvery !== 1) notes.push('danceEvery ' + v.danceEvery + ' has no Psych equivalent; default dance timing used.');
    void opts;
    return { json: out, notes };
  }
  C.psychCharToVSlice = psychCharToVSlice;
  C.vsliceCharToPsych = vsliceCharToPsych;
})(window.FNFConv);
