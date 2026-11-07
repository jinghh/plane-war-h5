/* ============================================================
 * js/input.js —— 键鼠 + 触控输入
 * 触摸使用 Touch Events（兼容性最好），鼠标/触控笔使用 Pointer Events。
 * 触摸的 move/end 监听在 window 上，手指滑出画布也不会丢事件。
 * ============================================================ */
PW.Input = (function () {
  var keys = {};
  var pointer = {
    x: PW.CONFIG.W / 2, y: PW.CONFIG.H - 80,
    down: false, hover: false, touch: false,
    grabX: null, grabY: null
  };
  var flags = { bomb: false, pause: false, restart: false, start: false };
  var canvas = null;
  var touchId = null;   /* 正在拖动的触摸点 identifier */
  var activeId = null;  /* 正在拖动的鼠标/触控笔 pointerId */

  function toWorld(clientX, clientY) {
    if (!canvas) return { x: pointer.x, y: pointer.y };
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return { x: pointer.x, y: pointer.y };
    return {
      x: (clientX - r.left) / r.width * PW.CONFIG.W,
      y: (clientY - r.top) / r.height * PW.CONFIG.H
    };
  }

  function setWorld(clientX, clientY) {
    var p = toWorld(clientX, clientY);
    pointer.x = p.x;
    pointer.y = p.y;
  }

  function insideCanvas(clientX, clientY) {
    if (!canvas) return false;
    var r = canvas.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function findTouch(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  /* ---------------- 触摸（手机/平板） ---------------- */
  function onTouchStart(e) {
    if (!canvas || touchId !== null) return;
    if (!(e.target === canvas || canvas.contains(e.target))) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    touchId = t.identifier;
    activeId = null;
    setWorld(t.clientX, t.clientY);
    pointer.down = true;
    pointer.touch = true;
    pointer.hover = false;
    PW.Audio.unlock();
    if (e.cancelable) e.preventDefault();
  }

  function onTouchMove(e) {
    if (touchId === null) return;
    var t = findTouch(e.touches, touchId) || findTouch(e.changedTouches, touchId);
    if (!t) return;
    setWorld(t.clientX, t.clientY);
    pointer.down = true;
    if (e.cancelable) e.preventDefault();
  }

  function onTouchEnd(e) {
    if (touchId === null) return;
    if (!findTouch(e.changedTouches, touchId)) return;

    touchId = null;
    pointer.down = false;
    pointer.hover = false;
    if (e.cancelable) e.preventDefault();
  }

  /* ---------------- 鼠标 / 触控笔 ---------------- */
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return; /* 触摸统一走 Touch Events */
    if (!canvas || !(e.target === canvas || canvas.contains(e.target))) return;

    activeId = e.pointerId;
    setWorld(e.clientX, e.clientY);
    pointer.down = true;
    pointer.hover = true;
    pointer.touch = e.pointerType === 'pen';
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    PW.Audio.unlock();
    if (e.cancelable) e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;

    setWorld(e.clientX, e.clientY);
    if (e.pointerType === 'mouse') {
      pointer.touch = false;
      pointer.hover = insideCanvas(e.clientX, e.clientY);
    } else {
      pointer.touch = true;
    }
    if (activeId !== null && e.pointerId === activeId) pointer.down = true;
  }

  function onPointerUp(e) {
    if (e.pointerType === 'touch') return;
    if (activeId !== null && e.pointerId !== activeId) return;

    activeId = null;
    pointer.down = false;
    pointer.hover = false;
  }

  function init(el) {
    canvas = el;

    /* Touch Events：只负责触摸，window 级接收 move/end */
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    /* Pointer Events：鼠标与触控笔 */
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    el.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch') return;
      if (activeId === null) pointer.hover = false;
    });

    window.addEventListener('keydown', function (e) {
      var code = e.code || '';
      var key = (e.key || '').toLowerCase();
      keys[code] = true;
      keys[key] = true;
      if (code === 'KeyB' || code === 'KeyJ') flags.bomb = true;
      if (code === 'KeyP' || code === 'Escape') flags.pause = true;
      if (code === 'KeyR') flags.restart = true;
      if (code === 'Enter' || code === 'Space') flags.start = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(code) >= 0) e.preventDefault();
      PW.Audio.unlock();
    });

    window.addEventListener('keyup', function (e) {
      keys[e.code || ''] = false;
      keys[(e.key || '').toLowerCase()] = false;
    });

    window.addEventListener('blur', function () {
      keys = {};
      touchId = null;
      activeId = null;
      pointer.down = false;
    });
  }

  return {
    init: init,
    keys: function () { return keys; },
    pointer: pointer,
    consume: function (name) { var v = !!flags[name]; flags[name] = false; return v; },
    clearFlags: function () {
      flags.bomb = flags.pause = flags.restart = flags.start = false;
      pointer.grabX = null;
      pointer.grabY = null;
    }
  };
})();
