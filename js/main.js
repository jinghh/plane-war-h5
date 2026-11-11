/* ============================================================
 * js/main.js —— 启动、屏幕适配（整数缩放）、DOM UI 绑定、主循环
 * ============================================================ */
(function () {
  'use strict';

  var W = PW.CONFIG.W, H = PW.CONFIG.H;
  var canvas = document.getElementById('game');
  var stage = document.getElementById('stage');
  var loading = document.getElementById('loading');
  var game = null;
  var lastTime = 0;
  var lastBombs = -1;

  var els = {
    title: document.getElementById('overlay-title'),
    pause: document.getElementById('overlay-pause'),
    over: document.getElementById('overlay-gameover'),
    titleBest: document.getElementById('title-best'),
    overScore: document.getElementById('over-score'),
    overBest: document.getElementById('over-best'),
    overKills: document.getElementById('over-kills'),
    overCycle: document.getElementById('over-cycle'),
    btnStart: document.getElementById('btn-start'),
    btnResume: document.getElementById('btn-resume'),
    btnRestartPause: document.getElementById('btn-restart-pause'),
    btnRestart: document.getElementById('btn-restart'),
    btnPause: document.getElementById('btn-pause'),
    btnMute: document.getElementById('btn-mute'),
    btnBomb: document.getElementById('btn-bomb')
  };

  /* ---------- 适配：世界整数倍放大到高分辨率画布，再等比缩放到屏幕 ---------- */
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var pad = (vw < 760 || vh < 900) ? 0 : 18;
    var aw = Math.max(120, vw - pad * 2);
    var ah = Math.max(200, vh - pad * 2);
    var aspect = W / H;
    var cw = Math.min(aw, ah * aspect);
    var ch = cw / aspect;

    var dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    var s = Math.round(Math.min(cw * dpr / W, ch * dpr / H));
    s = Math.max(1, Math.min(6, s));

    canvas.width = W * s;
    canvas.height = H * s;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    document.documentElement.style.setProperty('--u', (cw / W) + 'px');

    if (game) game.setViewport(s);
  }

  /* ---------- DOM UI ---------- */
  function syncMute() {
    els.btnMute.textContent = PW.Audio.muted ? '静音' : '音效';
  }

  function syncBomb() {
    if (!game) return;
    if (game.player.bombs !== lastBombs) {
      lastBombs = game.player.bombs;
      els.btnBomb.textContent = '炸弹 \u00d7' + game.player.bombs;
    }
  }

  /* ---------- 皮肤选择器（标题页，选择写入 localStorage） ---------- */
  function buildSkinPicker() {
    var host = document.getElementById('skin-picker');
    if (!host || !PW.Skin) return;
    host.innerHTML = '';

    PW.Skin.list.forEach(function (skin) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-btn' + (PW.Skin.id() === skin.id ? ' on' : '');
      btn.setAttribute('data-skin', skin.id);

      var f = PW.Assets.frame(skin.prefix + '_idle');
      if (f) {
        var cv = document.createElement('canvas');
        /* 图集是 4x 整数放大，等比例缩回逻辑尺寸即还原像素画 */
        cv.width = f.logicalSize[0];
        cv.height = f.logicalSize[1];
        var c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(PW.Assets.img, f.frame.x, f.frame.y, f.frame.w, f.frame.h,
          0, 0, f.logicalSize[0], f.logicalSize[1]);
        btn.appendChild(cv);
      }

      var name = document.createElement('span');
      name.textContent = skin.name;
      btn.appendChild(name);

      btn.addEventListener('click', function () {
        PW.Audio.unlock();
        if (PW.Skin.set(skin.id)) {
          if (game && game.player) game.player.setSkin(PW.Skin.def());
          PW.Audio.play('click');
        }
        var all = host.querySelectorAll('.skin-btn');
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle('on', all[i] === btn);
        }
      });

      host.appendChild(btn);
    });
  }

  function onState(state, g) {
    els.title.classList.toggle('show', state === 'title');
    els.pause.classList.toggle('show', state === 'paused');
    els.over.classList.toggle('show', state === 'gameover');

    var inGame = state === 'playing' || state === 'paused';
    els.btnPause.classList.toggle('hidden', !inGame);
    els.btnBomb.classList.toggle('hidden', state !== 'playing');
    els.btnPause.textContent = state === 'paused' ? '继续' : '暂停';

    if (state === 'title') {
      els.titleBest.textContent = String(g.best);
    }
    if (state === 'gameover') {
      els.overScore.textContent = String(g.score);
      els.overBest.textContent = String(g.best);
      els.overKills.textContent = String(g.kills);
      els.overCycle.textContent = String(g.cycle);
    }
    syncBomb();
  }

  function bindUI() {
    els.btnStart.addEventListener('click', function () {
      PW.Audio.unlock();
      game.start();
    });
    els.btnResume.addEventListener('click', function () { game.resume(); });
    els.btnRestartPause.addEventListener('click', function () { game.start(); });
    els.btnRestart.addEventListener('click', function () { game.start(); });

    els.btnPause.addEventListener('click', function () {
      PW.Audio.unlock();
      game.togglePause();
    });
    els.btnMute.addEventListener('click', function () {
      PW.Audio.toggle();
      syncMute();
    });
    els.btnBomb.addEventListener('click', function () { game.useBomb(); });

    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && game && game.state === 'playing') game.pause();
    });
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    if (!lastTime) lastTime = ts;
    var dt = (ts - lastTime) / 1000;
    lastTime = ts;

    game.update(dt);
    game.render();
    syncBomb();

    window.requestAnimationFrame(frame);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    /* 注册输入监听（此前遗漏了这一步，导致手机触摸与键鼠事件都收不到） */
    PW.Input.init(canvas);

    game = new PW.Game(canvas, { onState: onState });
    fit();
    bindUI();
    syncMute();

    PW.Background.init();

    PW.Assets.load(function (err) {
      if (err) {
        loading.textContent = '资源加载失败：' + err.message;
        loading.classList.add('error');
        return;
      }
      loading.classList.add('hidden');
      buildSkinPicker();
      game.setState('title');
      window.requestAnimationFrame(frame);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
