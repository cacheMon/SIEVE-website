// A live SIEVE cache on the landing page.
//
// The rules follow the pseudocode in the SIEVE blog post and NSDI '24 paper:
//   - one FIFO queue; new objects always go in at the head;
//   - a hit sets the object's visited bit, and nothing moves;
//   - on a miss with a full cache, the hand starts where it last stopped (or
//     at the tail) and walks toward the head; it clears the bit of each
//     visited object it passes, which stays where it is, and evicts the first
//     object whose bit is clear;
//   - the hand then rests on the evicted object's neighbour toward the head,
//     and wraps back to the tail when it walks past the head.
// The queue is drawn far smaller than a real cache so every move is easy to
// follow.

(function () {
  'use strict';

  function Sieve(cap) {
    this.cap = cap;
    this.reset();
  }

  Sieve.prototype.reset = function () {
    this.q = [];          // index 0 is the head (newest), the last is the tail
    this.visited = {};
    this.hand = null;     // the key the hand points at; null means the tail
    this.hits = 0;
    this.misses = 0;
  };

  Sieve.prototype.handIndex = function () {
    return this.hand === null ? this.q.length - 1 : this.q.indexOf(this.hand);
  };

  // Serves one request and says what happened
  Sieve.prototype.request = function (key) {
    if (this.q.indexOf(key) >= 0) {
      this.hits++;
      var was = this.visited[key];
      this.visited[key] = true;
      return { kind: 'hit', key: key, was: was };
    }
    this.misses++;
    var e = { kind: 'miss', key: key, evicted: null, passed: [], wrapped: false };
    if (this.q.length >= this.cap) this.evict(e);
    this.q.unshift(key);
    this.visited[key] = false;
    return e;
  };

  Sieve.prototype.evict = function (e) {
    var q = this.q, i = this.handIndex();
    while (this.visited[q[i]]) {
      this.visited[q[i]] = false;
      e.passed.push(q[i]);
      i--;
      if (i < 0) { i = q.length - 1; e.wrapped = true; }
    }
    e.evicted = q[i];
    this.hand = i > 0 ? q[i - 1] : null;
    delete this.visited[q[i]];
    q.splice(i, 1);
  };

  // The opening requests walk through every rule: the cache fills, A and C
  // are hit, and the first eviction passes A (which keeps its place) to evict
  // B; later G, H and I are hit, so the hand passes them, wraps from the head
  // to the tail and evicts C; a second hit on E changes nothing. After that a
  // seeded stream mixes a few popular keys, some that return now and then,
  // and a steady flow of keys that are requested once.
  var INTRO = ['A', 'B', 'C', 'D', 'E', 'F', 'A', 'C', 'G', 'H', 'A', 'E',
    'I', 'G', 'H', 'I', 'J', 'E', 'E', 'K'];
  var HOT = ['A', 'C', 'E'];
  var HOT_W = [0.45, 0.3, 0.25];
  var WARM = ['G', 'H', 'J', 'K'];
  var COLD = ['L', 'N', 'P', 'Q', 'R', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'B', 'D', 'F', 'I'];

  function Stream(seed) {
    this.seed = seed;
    this.reset();
  }
  Stream.prototype.reset = function () {
    this.i = 0;
    this.cold = 0;
    this.s = this.seed >>> 0;
  };
  Stream.prototype.rand = function () {   // mulberry32
    var t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Stream.prototype.next = function () {
    if (this.i < INTRO.length) return INTRO[this.i++];
    this.i++;
    var r = this.rand();
    if (r < 0.5) {
      var u = this.rand(), acc = 0;
      for (var k = 0; k < HOT.length; k++) { acc += HOT_W[k]; if (u < acc) return HOT[k]; }
      return HOT[HOT.length - 1];
    }
    if (r < 0.72) return WARM[Math.floor(this.rand() * WARM.length)];
    return COLD[this.cold++ % COLD.length];
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = { Sieve: Sieve, Stream: Stream, INTRO: INTRO };
  }
  if (typeof document === 'undefined') return;

  /* ---------------- drawing ---------------- */

  var root = document.getElementById('sim');
  if (!root) return;

  var CAP = 6;
  var DWELL = 1500, HOP = 300, MOVE = 650;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) HOP = MOVE = 0;

  var cache = new Sieve(CAP);
  var stream = new Stream(20240416);
  var upcoming = [];

  var stage = root.querySelector('.sim-stage');
  var layer = root.querySelector('.sim-tokens');
  var handEl = root.querySelector('.sim-hand');
  var nextList = root.querySelector('.sim-next');
  var logList = root.querySelector('.sim-log');
  var playBtn = root.querySelector('[data-act="play"]');
  var stepBtn = root.querySelector('[data-act="step"]');
  var resetBtn = root.querySelector('[data-act="reset"]');
  var stat = {};
  root.querySelectorAll('[data-stat]').forEach(function (el) { stat[el.getAttribute('data-stat')] = el; });

  var box = root.querySelector('.sim-slots');
  box.innerHTML = '';
  for (var n = 0; n < CAP; n++) {
    var s = document.createElement('span');
    s.className = 'sim-slot';
    box.appendChild(s);
  }
  var slots = box.children;

  var tokens = {};     // key -> element
  var pending = [];    // timers of the step being animated

  function makeToken(key) {
    var el = document.createElement('div');
    el.className = 'sim-tok';
    el.innerHTML = '<span class="sim-key">' + key + '</span><span class="sim-bit"></span>';
    layer.appendChild(el);
    tokens[key] = el;
    return el;
  }

  // Top-left corner and size of slot i, relative to the stage
  function spot(i) {
    var base = stage.getBoundingClientRect();
    var r = slots[i].getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width };
  }

  function translate(p, dy) { return 'translate(' + p.x + 'px,' + (p.y + (dy || 0)) + 'px)'; }

  function place(el, p) {
    el.style.width = el.style.height = p.w + 'px';
    el.style.transform = translate(p);
    el._p = p;
  }

  function paint(key, visited) {
    var el = tokens[key];
    if (!el) return;
    el.classList.toggle('is-visited', !!visited);
    el.title = key + (visited ? ': visited' : ': not visited');
  }

  // The hand sits under slot i
  function handSpot(i) {
    var p = spot(Math.max(0, i));
    return { x: p.x + p.w / 2, y: p.y + p.w };
  }
  function moveHand(i, animate, lift) {
    var to = handSpot(i), from = handEl._p;
    handEl.style.transform = 'translate(' + to.x + 'px,' + to.y + 'px)';
    handEl._p = to;
    if (!animate || !from || !HOP) return;
    var frames = [{ transform: 'translate(' + from.x + 'px,' + from.y + 'px)' }];
    if (lift) frames.push({ transform: 'translate(' + (from.x + to.x) / 2 + 'px,' + (to.y + lift) + 'px)', offset: 0.5 });
    frames.push({ transform: 'translate(' + to.x + 'px,' + to.y + 'px)' });
    handEl.animate(frames, { duration: lift ? HOP * 1.6 : HOP, easing: 'cubic-bezier(.4,0,.2,1)' });
  }

  // Moves every token to its place in the queue
  function layout(animate) {
    var seen = {};
    cache.q.forEach(function (key, i) {
      seen[key] = true;
      var el = tokens[key], to = spot(i);
      if (!el) {
        el = makeToken(key);
        place(el, to);
        paint(key, cache.visited[key]);
        if (animate && MOVE) {
          el.animate([
            { transform: translate({ x: to.x - to.w * 1.1, y: to.y }) + ' scale(.6)', opacity: 0 },
            { transform: translate(to), opacity: 1 }
          ], { duration: MOVE, easing: 'cubic-bezier(.2,0,.2,1)' });
        }
        return;
      }
      var from = el._p;
      place(el, to);
      if (animate && MOVE && from && (from.x !== to.x || from.y !== to.y)) {
        el.animate([{ transform: translate(from) }, { transform: translate(to) }], { duration: MOVE, easing: 'cubic-bezier(.4,0,.2,1)' });
      }
    });
    Object.keys(tokens).forEach(function (key) { if (!seen[key]) { tokens[key].remove(); delete tokens[key]; } });
    moveHand(cache.handIndex(), animate);
  }

  function leave(key) {
    var el = tokens[key];
    delete tokens[key];
    if (!el) return;
    if (!MOVE) { el.remove(); return; }
    var p = el._p;
    el.animate([
      { transform: translate(p), opacity: 1 },
      { transform: translate(p, p.w * 0.9) + ' scale(.6)', opacity: 0 }
    ], { duration: MOVE * 0.8, easing: 'ease-in' }).onfinish = function () { el.remove(); };
    el.style.opacity = 0;
  }

  function pulse(key) {
    var el = tokens[key];
    if (!el || !MOVE) return;
    el.animate([{ scale: 1 }, { scale: 1.2 }, { scale: 1 }], { duration: 420, easing: 'ease-out' });
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  function chip(key) { return '<b class="sim-k">' + key + '</b>'; }
  function and(keys) {
    var b = keys.map(chip);
    return b.length === 1 ? b[0] : b.slice(0, -1).join(', ') + ' and ' + b[b.length - 1];
  }

  // At most three lines per request
  function narrate(e) {
    var k = chip(e.key);
    if (e.kind === 'hit') {
      return [['hit', k + ' is cached: <em>hit</em>. ' +
        (e.was ? 'Its bit is already set, so nothing changes.' : 'Its visited bit is set; nothing moves.')]];
    }
    if (!e.evicted) return [['miss', k + ' is not cached: <em>miss</em>. It goes in at the head.']];
    var lines = [['miss', k + ' is not cached: <em>miss</em>. The cache is full, so the hand looks for an object to evict.']];
    if (e.passed.length) {
      lines.push(['pass', 'It passes ' + and(e.passed) + (e.passed.length > 1 ? ', which were' : ', which was') +
        ' visited, and clears ' + (e.passed.length > 1 ? 'their bits' : 'its bit') + '; ' +
        (e.passed.length > 1 ? 'they stay' : 'it stays') + ' where ' + (e.passed.length > 1 ? 'they are' : 'it is') +
        (e.wrapped ? ', and the hand wraps from the head back to the tail.' : '.')]);
    }
    lines.push(['evict', chip(e.evicted) + ' was not visited, so it is evicted, and ' + k + ' goes in at the head.']);
    return lines;
  }

  var logHeight = 0;
  function showLog(lines) {
    logList.innerHTML = lines.map(function (l) { return '<li data-kind="' + l[0] + '">' + l[1] + '</li>'; }).join('');
    var h = logList.offsetHeight;
    if (h > logHeight) { logHeight = h; logList.style.minHeight = h + 'px'; }
  }

  function fillUpcoming() {
    while (upcoming.length < 8) upcoming.push(stream.next());
    nextList.innerHTML = upcoming.map(function (k, i) {
      return '<li' + (i === 0 ? ' class="now"' : '') + '>' + k + '</li>';
    }).join('');
  }

  function showStats() {
    var n = cache.hits + cache.misses;
    stat.hits.textContent = cache.hits;
    stat.misses.textContent = cache.misses;
    stat.ratio.textContent = n ? Math.round(100 * cache.misses / n) + '%' : '–';
  }

  function later(fn, ms) { pending.push(setTimeout(fn, ms)); }

  // Cuts the running animation short and shows the cache as it now is
  function settle() {
    if (!pending.length) return;
    pending.forEach(clearTimeout);
    pending = [];
    layout(false);
    cache.q.forEach(function (k) { paint(k, cache.visited[k]); });
  }

  // Serves the next request, animates it, and returns how long that takes
  function step() {
    settle();
    var key = upcoming.shift();
    var before = cache.q.slice(), start = cache.handIndex();
    var e = cache.request(key);
    showLog(narrate(e));
    fillUpcoming();
    showStats();

    if (e.kind === 'hit') {
      paint(key, true);
      pulse(key);
      return 450;
    }
    if (!e.evicted) {
      layout(true);
      return MOVE;
    }

    if (!MOVE) {
      layout(false);
      cache.q.forEach(function (k) { paint(k, cache.visited[k]); });
      return 0;
    }

    // The hand walks the old queue: each visited object it passes loses its
    // bit, then the victim leaves and everything settles into place
    var path = [start], i = start;
    e.passed.forEach(function () {
      i--;
      if (i < 0) i = before.length - 1;
      path.push(i);
    });
    var t = 0;
    e.passed.forEach(function (k, j) {
      var from = path[j], to = path[j + 1], wrap = to > from;
      later(function () { paint(k, false); }, t);
      later(function () { moveHand(to, true, wrap ? -spot(0).w * 0.9 : 0); }, t);
      t += wrap ? HOP * 1.6 : HOP;
    });
    // the hand rests on the victim's slot before it is evicted
    later(function () { leave(e.evicted); }, t + HOP * 0.4);
    later(function () { pending = []; layout(true); }, t + HOP * 0.4 + MOVE * 0.5);
    return t + HOP * 0.4 + MOVE * 1.5;
  }

  function restart() {
    pending.forEach(clearTimeout);
    pending = [];
    cache.reset();
    stream.reset();
    upcoming = [];
    Object.keys(tokens).forEach(function (k) { tokens[k].remove(); });
    tokens = {};
    handEl._p = null;
    moveHand(0, false);
    showLog([['', 'Requests arrive in the order shown above. Each one is a hit or a miss; a miss on a full cache sends the hand looking for an object to evict.']]);
    fillUpcoming();
    showStats();
  }

  /* autoplay, only while the simulation is on screen */
  var playing = !reduce, visible = false, timer = null;

  function tick() {
    timer = setTimeout(tick, step() + DWELL);
  }

  function sync() {
    var run = playing && visible && !document.hidden;
    if (run && !timer) timer = setTimeout(tick, 600);
    if (!run && timer) { clearTimeout(timer); timer = null; }
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    playBtn.querySelector('.sim-play-label').textContent = playing ? 'Pause' : 'Play';
    root.classList.toggle('is-playing', playing);
    // Read each step aloud only when someone is stepping through by hand
    logList.setAttribute('aria-live', playing ? 'off' : 'polite');
  }

  playBtn.addEventListener('click', function () { playing = !playing; sync(); });
  stepBtn.addEventListener('click', function () { playing = false; sync(); step(); });
  resetBtn.addEventListener('click', function () { restart(); sync(); });
  document.addEventListener('visibilitychange', sync);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.35 }).observe(stage);
  } else {
    visible = true;
  }

  var raf = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      layout(false);
      logHeight = 0;
      logList.style.minHeight = '';
    });
  });

  restart();
  sync();
})();
