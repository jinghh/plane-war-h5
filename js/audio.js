/* ============================================================
 * js/audio.js —— 全部音效由 WebAudio 程序化合成，无任何外部音频文件
 * ============================================================ */
PW.Audio = (function () {
  var ctx = null, master = null, noiseBuf = null;
  var muted = false;
  try { muted = localStorage.getItem('planeWarMuted') === '1'; } catch (e) { muted = false; }

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  function tone(o) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var dur = o.dur || 0.08;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq || 440, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.25, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise(o) {
    var c = ensure(); if (!c) return;
    if (!noiseBuf) {
      var n = Math.floor(c.sampleRate * 0.7);
      noiseBuf = c.createBuffer(1, n, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = c.currentTime + (o.delay || 0);
    var dur = o.dur || 0.3;
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(o.cutoff || 900, t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(80, (o.cutoff || 900) * 0.35), t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(o.gain || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  var sfx = {
    shoot: function () { tone({ freq: 900, slide: 620, dur: 0.05, type: 'square', gain: 0.10 }); },
    shootBig: function () { tone({ freq: 520, slide: 260, dur: 0.09, type: 'sawtooth', gain: 0.14 }); },
    explosion: function (big) {
      noise({ dur: big ? 0.55 : 0.22, gain: big ? 0.55 : 0.35, cutoff: big ? 1200 : 900 });
      if (big) tone({ freq: 160, slide: 60, dur: 0.35, type: 'sawtooth', gain: 0.2 });
    },
    hit: function () {
      noise({ dur: 0.22, gain: 0.4, cutoff: 700 });
      tone({ freq: 180, slide: 70, dur: 0.25, type: 'square', gain: 0.22 });
    },
    pickup: function () {
      tone({ freq: 660, dur: 0.07, type: 'square', gain: 0.18 });
      tone({ freq: 880, dur: 0.07, type: 'square', gain: 0.18, delay: 0.07 });
      tone({ freq: 1180, dur: 0.1, type: 'square', gain: 0.18, delay: 0.14 });
    },
    bomb: function () {
      noise({ dur: 0.85, gain: 0.6, cutoff: 1600 });
      tone({ freq: 420, slide: 60, dur: 0.6, type: 'sawtooth', gain: 0.25 });
    },
    warn: function () {
      tone({ freq: 520, dur: 0.16, type: 'square', gain: 0.22 });
      tone({ freq: 380, dur: 0.22, type: 'square', gain: 0.22, delay: 0.2 });
    },
    bossDie: function () {
      noise({ dur: 1.1, gain: 0.6, cutoff: 1800 });
      tone({ freq: 300, slide: 40, dur: 0.9, type: 'sawtooth', gain: 0.28 });
    },
    click: function () { tone({ freq: 720, dur: 0.04, type: 'square', gain: 0.12 }); }
  };

  return {
    play: function (name, arg) { if (!muted && sfx[name]) sfx[name](arg); },
    unlock: function () { ensure(); },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem('planeWarMuted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) ensure();
      return muted;
    },
    get muted() { return muted; }
  };
})();
