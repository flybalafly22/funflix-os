/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/assets.js
   GLTF asset-loading + batching pipeline (Sprint 0 of the craft overhaul).

   The town is currently 100% code-composed primitives. This module lets the
   Environment/Character agents introduce authored CC0 low-poly GLTF assets
   WITHOUT losing the four-system look (cel banding + ink outline + tiny-planet
   curvature + paper grade) or the static-batching perf budget.

   Contract (see ART_BIBLE.md §7):
     1. load(url)          → Promise<THREE.Group>   (r128 THREE.GLTFLoader)
     2. reskin(obj, opts)  → replace every material with a lib.std() cel material
                             so curvature + ink + banding apply. MANDATORY before
                             an asset enters the world.
     3. prep(obj, {static}) → tag for the world.js batchStatic() merge, so a
                             placed authored prop costs the same as a code prop.
     4. manifest           → source/license table → mirror into ASSETS_CREDITS.md

   GLOBALS: THREE (r128 classic build), THREE.GLTFLoader (examples/js addon),
   window.FLY.lib. Attaches window.FLY.assets. Fully guarded — if GLTFLoader is
   missing the module degrades to no-ops and never throws into the boot path.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const T = THREE;
const LIB = (window.FLY && window.FLY.lib) || null;

const _loaderOK = !!(T && T.GLTFLoader);
let _loader = null;
function loader() {
  if (!_loaderOK) return null;
  if (!_loader) _loader = new T.GLTFLoader();
  return _loader;
}

/* ── ASSET MANIFEST ────────────────────────────────────────────────────────
   Every authored/imported GLTF is registered here with its source + license so
   ASSETS_CREDITS.md stays honest. `base` is resolved against the static/town
   asset folder at load time. Sprint 0 ships one probe asset (a generated crate)
   to prove the loader end-to-end; real CC0 packs land in Sprint 1+. */
const manifest = {
  // key           : { file, source, license, author }
  crate: {
    file: 'assets/crate.glb',
    source: 'tools/gen_gltf_box.py (procedurally generated in-repo)',
    license: 'CC0-1.0',
    author: 'THE FLY overhaul — pipeline probe (not a shipped art asset)',
  },
};

let _baseURL = 'assets/';               // overridden by init() with the Flask static URL
function init(baseURL) { if (baseURL) _baseURL = baseURL.replace(/\/?$/, '/'); }
function _resolve(file) {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('/')) return file;
  // manifest files already include the "assets/" prefix; _baseURL points at static/town/
  return _baseURL.replace(/assets\/$/, '') + file;
}

/* ── LOAD ──────────────────────────────────────────────────────────────────
   Resolves to the gltf.scene (a THREE.Group). Rejects (soft) if the loader
   addon isn't present so callers can fall back to code-built geometry. */
const _cache = new Map();
function load(fileOrKey) {
  const entry = manifest[fileOrKey];
  const file = entry ? entry.file : fileOrKey;
  const url = _resolve(file);
  if (_cache.has(url)) return _cache.get(url);
  const p = new Promise((resolve, reject) => {
    const ld = loader();
    if (!ld) { reject(new Error('THREE.GLTFLoader unavailable')); return; }
    ld.load(url,
      (gltf) => resolve(gltf.scene || (gltf.scenes && gltf.scenes[0])),
      undefined,
      (err) => reject(err));
  });
  _cache.set(url, p);
  return p;
}

/* ── RESKIN ────────────────────────────────────────────────────────────────
   Replace every material on a loaded GLTF with a lib.std() cel material that
   preserves the source base color (and map, if any). This is what makes an
   imported asset obey the four-system look: std() attaches the toon ramp +
   tiny-planet curvature, and because the geometry keeps real normals/depth the
   ink outline pass picks up its silhouette for free.

   opts: { color:hex override, flat:bool (use flat color, ignore map),
           shadow:bool (default true) } */
function reskin(obj, opts = {}) {
  if (!obj || !LIB) return obj;
  const shadow = opts.shadow !== false;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (shadow) { o.castShadow = true; o.receiveShadow = true; }
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const spec = {};
    // preserve base color
    if (opts.color != null) {
      spec.color = (typeof opts.color === 'string') ? parseInt(opts.color.replace('#', '0x')) : opts.color;
    } else if (src && src.color) {
      spec.color = src.color.getHex();
    } else {
      spec.color = 0xd8a877;                    // fall back to a warm wall tone
    }
    // preserve base-color texture unless flat requested
    if (!opts.flat && src && src.map) spec.map = src.map;
    if (src && src.transparent) { spec.transparent = true; spec.opacity = src.opacity; }
    if (src && src.side != null) spec.side = src.side;
    o.material = LIB.std(spec);               // cel + curvature + (implicit) outline-ready
  });
  return obj;
}

/* ── PREP FOR BATCHING ─────────────────────────────────────────────────────
   Tag a placed asset so world.js batchStatic() folds it into the merged town
   geometry. batchStatic() already merges any static mesh under `root` that
   shares a cached material by uuid — reskin() gives us that shared material, so
   `prep` mainly enforces the static contract and can flatten transforms.

   opts: { static:true (default) }  — set static:false for animated/dynamic GLTF
   (future rigged NPCs) which must NOT be batched. */
function prep(obj, opts = {}) {
  if (!obj) return obj;
  const isStatic = opts.static !== false;
  obj.userData.flyStatic = isStatic;          // advisory tag for tooling/inspection
  obj.traverse((o) => { if (o.isMesh) o.userData.flyStatic = isStatic; });
  return obj;
}

/* ── ONE-CALL HELPER ───────────────────────────────────────────────────────
   load → reskin → prep, ready to add under ctx.root. */
function place(fileOrKey, opts = {}) {
  return load(fileOrKey).then((scene) => {
    const obj = scene.clone(true);
    reskin(obj, opts);
    prep(obj, opts);
    return obj;
  });
}

/* ── EXPORT ── */
window.FLY = window.FLY || {};
window.FLY.assets = {
  ready: _loaderOK,
  init, load, reskin, prep, place, manifest,
  loaded: {},                                 // key → THREE.Group, populated by callers/QA
};
})();
