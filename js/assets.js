/* ============================================================
 * js/assets.js
 * 全局配置、图集装载、精灵绘制、帧动画播放器
 * ============================================================ */
window.PW = window.PW || {};

PW.CONFIG = {
  W: 240,          // 世界宽（逻辑像素 = 图集逻辑尺寸）
  H: 428,          // 世界高
  SCALE: 2,        // 1 世界单位 = 2 画布像素（画布固定 480×856）
  CANVAS_W: 480,
  CANVAS_H: 856,
  SPRITE_SCALE: 1, // 图集帧按 logicalSize ×1 绘制（PNG 像素自动缩为 0.5）
  PLAYER_SPEED: 220,
  FIRE: { l1: 0.14, l2: 0.13, l3: 0.12, l4: 0.16 }
};

PW.Assets = (function () {
  var atlas = window.PLANE_WAR_ATLAS;
  var img = new Image();
  var loaded = false;

  function load(cb) {
    if (!atlas) { cb(new Error('图集数据缺失 (assets/atlas.js)'), null); return; }
    img.onload = function () { loaded = true; cb(null, img); };
    img.onerror = function () { cb(new Error('雪碧图加载失败: ' + atlas.meta.image), null); };
    img.src = 'assets/' + atlas.meta.image;
  }

  function frame(name) { return atlas.frames[name] || null; }

  return {
    atlas: atlas,
    img: img,
    load: load,
    frame: frame,
    anim: function (n) { return atlas.animations[n] || null; },
    get loaded() { return loaded; }
  };
})();

/* 以“世界坐标”绘制图集帧；cx/cy 为锚点（默认帧中心） */
PW.Sprite = {
  draw: function (ctx, name, cx, cy, opt) {
    opt = opt || {};
    var f = PW.Assets.frame(name);
    if (!f || !PW.Assets.loaded) return;
    var s = opt.scale == null ? PW.CONFIG.SPRITE_SCALE : opt.scale;
    var w = Math.round(f.logicalSize[0] * s);
    var h = Math.round(f.logicalSize[1] * s);
    var ax = opt.anchorX == null ? f.anchor.x : opt.anchorX;
    var ay = opt.anchorY == null ? f.anchor.y : opt.anchorY;
    var dx = Math.round(cx - w * ax);
    var dy = Math.round(cy - h * ay);
    var oldAlpha = ctx.globalAlpha;
    if (opt.alpha != null) ctx.globalAlpha = oldAlpha * opt.alpha;
    ctx.drawImage(PW.Assets.img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, dx, dy, w, h);
    ctx.globalAlpha = oldAlpha;
  },
  /* 仅取尺寸 */
  size: function (name, scale) {
    var f = PW.Assets.frame(name);
    if (!f) return { w: 0, h: 0 };
    var s = scale == null ? 1 : scale;
    return { w: f.logicalSize[0] * s, h: f.logicalSize[1] * s };
  }
};

/* 帧动画播放器：自动读取 atlas.animations 的 fps/loop/帧序列 */
PW.Anim = function (animName, opts) {
  opts = opts || {};
  var def = PW.Assets.anim(animName);
  this.name = animName;
  this.frames = (def && def.frames) || (PW.Assets.frame(animName) ? [animName] : []);
  this.fps = opts.fps || (def && def.fps) || 12;
  this.loop = opts.loop == null ? !!(def && def.loop) : !!opts.loop;
  this.t = 0;
  this.i = 0;
  this.done = this.frames.length === 0;
};

PW.Anim.prototype.update = function (dt) {
  if (this.done || this.frames.length === 0) return;
  this.t += dt;
  var span = this.frames.length / this.fps;
  if (this.t >= span) {
    if (this.loop) {
      this.t = this.t % span;
    } else {
      this.t = span - 1e-6;
      this.done = true;
    }
  }
  this.i = Math.min(this.frames.length - 1, Math.floor(this.t * this.fps));
};

PW.Anim.prototype.frame = function () { return this.frames[this.i] || null; };
