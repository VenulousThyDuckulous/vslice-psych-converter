/* Stage conversion: Psych stages/*.json <-> V-Slice data/stages/*.json */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  function animP2V(a) {
    const o = { name: a.anim, prefix: a.name };
    if (a.fps !== undefined && a.fps !== 24) o.frameRate = a.fps;
    if (Array.isArray(a.indices) && a.indices.length) o.frameIndices = a.indices;
    if (Array.isArray(a.offsets) && (a.offsets[0] || a.offsets[1])) o.offsets = a.offsets;
    if (a.loop) o.looped = true;
    return o;
  }
  function animV2P(a) {
    return { anim: a.name, name: a.prefix || a.name, fps: a.frameRate ?? 24, loop: !!a.looped, indices: Array.isArray(a.frameIndices) ? a.frameIndices : [], offsets: Array.isArray(a.offsets) ? a.offsets : [0, 0] };
  }
  function psychStageToVSlice(p, id, opts) {
    const notes = [];
    const isPixel = /pixel/i.test(p.stageUI || '') || !!p.isPixelStage;
    if (isPixel) notes.push('Pixel stage: isPixel applied to props; set character isPixel flags too if needed.');
    const chars = {};
    const slot = (pos, cam, z) => ({ zIndex: z, position: Array.isArray(pos) ? pos : [0, 0], cameraOffsets: Array.isArray(cam) ? cam : [0, 0] });
    chars.bf = slot(p.boyfriend, p.camera_boyfriend, 300);
    chars.dad = slot(p.opponent, p.camera_opponent, 200);
    chars.gf = slot(p.girlfriend, p.camera_girlfriend, 100);
    const props = [];
    let z = 10;
    for (const ob of (p.objects || [])) {
      const t = String(ob.type || 'sprite');
      if (t === 'gf' || t === 'dad' || t === 'dadGroup' || t === 'boyfriend' || t === 'boyfriendGroup') { notes.push('Reserved slot object "' + ob.name + '" (' + t + ') skipped: character slots are set above.'); continue; }
      if (t !== 'sprite' && t !== 'animatedSprite' && t !== 'square') { notes.push('Object "' + ob.name + '" type "' + t + '" mapped to a static prop; verify in-game.'); }
      const pr = {
        name: ob.name || ('prop' + z),
        assetPath: t === 'square' ? (ob.color && /^#/.test(ob.color) ? ob.color : '#FFFFFF') : C.withLib(String(ob.image || ''), opts.libPrefix || ''),
        position: [ob.x ?? 0, ob.y ?? 0],
        zIndex: z, scroll: Array.isArray(ob.scroll) ? ob.scroll : [1, 1],
        scale: Array.isArray(ob.scale) ? ob.scale : [ob.scale ?? 1, ob.scale ?? 1],
        alpha: ob.alpha ?? 1, angle: ob.angle ?? 0,
        flipX: !!ob.flipX, flipY: !!ob.flipY, isPixel,
        color: ob.color || '#FFFFFF', danceEvery: 0, animType: 'sparrow',
        animations: (ob.animations || []).map(animP2V)
      };
      if (ob.firstAnimation) pr.startingAnimation = ob.firstAnimation;
      props.push(pr); z += 10;
    }
    const out = {
      version: '1.0.0', name: C.prettyName(id),
      cameraZoom: p.defaultZoom ?? 1.05,
      directory: p.directory === '' ? 'shared' : (p.directory || 'shared'),
      characters: chars, props
    };
    if (p.hide_girlfriend) notes.push('hide_girlfriend=true has no direct V-Slice equivalent; hide the GF slot manually (or remove it).');
    if (p.preload) notes.push('preload hints dropped (V-Slice precaches automatically).');
    if (!props.length && !(p.objects || []).length) notes.push('No custom objects: positions/zoom converted; stage art itself is hardcoded in Psych — add props pointing at your images.');
    return { json: out, notes };
  }
  function vsliceStageToPsych(v, id) {
    const notes = [];
    const c = v.characters || {};
    const out = {
      directory: v.directory === 'shared' ? '' : (v.directory || ''),
      defaultZoom: v.cameraZoom ?? 1.05, stageUI: 'normal',
      boyfriend: (c.bf && c.bf.position) || [770, 100],
      girlfriend: (c.gf && c.gf.position) || [400, 130],
      opponent: (c.dad && c.dad.position) || [100, 100],
      hide_girlfriend: false,
      camera_boyfriend: (c.bf && c.bf.cameraOffsets) || [0, 0],
      camera_opponent: (c.dad && c.dad.cameraOffsets) || [0, 0],
      camera_girlfriend: (c.gf && c.gf.cameraOffsets) || [0, 0],
      camera_speed: 1, objects: []
    };
    for (const pr of (v.props || [])) {
      const isColor = /^#/.test(pr.assetPath || '');
      const sc = Array.isArray(pr.scale) ? pr.scale : [pr.scale ?? 1, pr.scale ?? 1];
      const ob = {
        type: (pr.animations && pr.animations.length) ? 'animatedSprite' : (isColor ? 'square' : 'sprite'),
        name: pr.name || 'prop',
        image: isColor ? undefined : C.stripLib(pr.assetPath || ''),
        x: (pr.position || [0, 0])[0], y: (pr.position || [0, 0])[1],
        scale: sc, scroll: pr.scroll || [1, 1], color: pr.color || '#FFFFFF',
        alpha: pr.alpha ?? 1, angle: pr.angle ?? 0,
        flipX: !!pr.flipX, flipY: !!pr.flipY, antialiasing: !pr.isPixel,
        animations: (pr.animations || []).map(animV2P)
      };
      if (isColor) delete ob.image;
      if (pr.startingAnimation) ob.firstAnimation = pr.startingAnimation;
      if (pr.danceEvery) notes.push('Prop "' + pr.name + '" danceEvery bop dropped; animate it with a stage script instead.');
      if (pr.blend) notes.push('Prop "' + pr.name + '" blend mode dropped.');
      out.objects.push(ob);
    }
    if (!out.objects.length) notes.push('No props: positions/zoom converted. Psych base stages are hardcoded — add objects[] pointing at your images.');
    void id;
    return { json: out, notes };
  }
  C.psychStageToVSlice = psychStageToVSlice;
  C.vsliceStageToPsych = vsliceStageToPsych;
})(window.FNFConv);
