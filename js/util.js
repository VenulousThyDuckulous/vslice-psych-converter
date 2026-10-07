/* Shared helpers. Plain script (no modules) so it works from file:// too. */
window.FNFConv = window.FNFConv || {};
(function (C) {
  'use strict';
  C.clone = (o) => JSON.parse(JSON.stringify(o));
  C.esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // "Dad Battle" -> "dadbattle" (Psych formatToSongPath-ish: lowercase, strip separators)
  C.songId = (s) => String(s || 'song').toLowerCase().replace(/[\s~&;:<>#.,'"%?!_\-]+/g, '');
  C.prettyName = (id) => String(id || 'song').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  C.cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  // strip "lib:" prefix from vslice asset paths -> "shared:characters/bf" => "characters/bf"
  C.stripLib = (p) => { const s = String(p || ''); const i = s.indexOf(':'); return i >= 0 ? s.slice(i + 1) : s; };
  C.withLib = (p, prefix) => (prefix ? prefix + ':' + p : p);
  C.download = (name, content) => {
    const blob = content instanceof Uint8Array ? new Blob([content]) : new Blob([content], { type: 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  C.note = (arr, msg) => { if (msg) arr.push(msg); };
})(window.FNFConv);
