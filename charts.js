// Charts on the landing page (Chart.js 3), redrawn from the figures in the
// paper and the blog post; the values were read from those figures' vector
// coordinates.
//
// SIEVE is the one series every chart is about, so it alone wears the accent
// and the others share a neutral gray; algorithm names are on the axis, so no
// identity rests on color. Each chart is drawn when it scrolls into view and
// redrawn in the new colors when the reader switches schemes.

(function () {
  'use strict';
  if (!window.Chart) return;

  var ALGOS = ['SIEVE', 'S3-FIFO', 'TinyLFU', 'CLOCK', 'LRU', 'FIFO'];
  // Miss ratio on a Zipf workload (alpha = 1), by cache size as a share of
  // the working set
  var ZIPF = {
    sizes: ['0.1%', '1%', '10%', '20%'],
    miss: {
      SIEVE: [0.511, 0.360, 0.208, 0.163],
      'S3-FIFO': [0.514, 0.356, 0.205, 0.163],
      TinyLFU: [0.517, 0.357, 0.204, 0.162],
      CLOCK: [0.607, 0.427, 0.239, 0.181],
      LRU: [0.618, 0.437, 0.246, 0.187],
      FIFO: [0.654, 0.472, 0.277, 0.214]
    }
  };
  // Mean miss ratio reduction from FIFO across traces, in percent, before and
  // after SIEVE replaces the algorithm's LRU or FIFO queue
  var PRIMITIVE = {
    labels: ['SIEVE alone', 'LeCaR', 'TwoQ', 'ARC', 'S3-FIFO'],
    original: [null, 14.6, 16.5, 17.3, 20.0],
    sieve: [18.1, 18.0, 17.4, 19.9, 20.2]
  };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var charts = {};

  function dark() { return document.body.getAttribute('data-md-color-scheme') === 'slate'; }

  function tokens() {
    var css = getComputedStyle(document.querySelector('.sv') || document.body);
    function v(name) { return css.getPropertyValue(name).trim(); }
    return {
      ink: v('--sv-ink'), ink2: v('--sv-ink-2'), mute: v('--sv-mute'), line: v('--sv-line'), surface: v('--sv-card'),
      accent: dark() ? '#ff6b5c' : '#e0382b', other: dark() ? '#6b7484' : '#8a93a2'
    };
  }

  // Values at the tips of horizontal bars
  var tipLabels = {
    id: 'tipLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.fmt) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 12px ' + Chart.defaults.font.family;
      ctx.fillStyle = opts.color;
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach(function (ds, d) {
        var meta = chart.getDatasetMeta(d);
        if (meta.hidden) return;
        meta.data.forEach(function (bar, i) {
          if (ds.data[i] == null) return;
          ctx.fillText(opts.fmt(ds.data[i]), bar.x + 6, bar.y);
        });
      });
      ctx.restore();
    }
  };

  function baseOptions(t, fmt, max) {
    return {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: reduce ? false : { duration: 700, easing: 'easeOutQuart' },
      layout: { padding: { right: 44 } },
      interaction: { mode: 'nearest', intersect: true, axis: 'y' },
      scales: {
        x: { beginAtZero: true, max: max, grid: { color: t.line, drawBorder: false, tickLength: 0 },
          ticks: { color: t.mute, padding: 6, maxTicksLimit: 4, font: { size: 11 }, callback: function (v) { return fmt(v); } } },
        y: { grid: { display: false, drawBorder: false }, ticks: { color: t.ink2, padding: 6, font: { size: 12 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, titleColor: t.mute, bodyColor: t.ink,
          titleFont: { size: 12, weight: '500' }, bodyFont: { size: 13, weight: '600' }, padding: 10, cornerRadius: 8,
          caretSize: 0, displayColors: false,
          callbacks: { label: function (item) { return fmt(item.raw) + (item.dataset.label ? '  ' + item.dataset.label : ''); } }
        },
        tipLabels: { color: t.ink2, fmt: fmt }
      }
    };
  }

  function bars(color, data, label, t) {
    return {
      label: label, data: data, backgroundColor: color, borderColor: t.surface,
      borderWidth: { top: 1, bottom: 1 }, borderSkipped: 'start',
      borderRadius: { topRight: 4, bottomRight: 4 }, maxBarThickness: 18
    };
  }

  function zipfConfig(i) {
    var t = tokens();
    var fmt = function (v) { return v.toFixed(2); };
    var data = ALGOS.map(function (a) { return ZIPF.miss[a][i]; });
    var colors = ALGOS.map(function (a) { return a === 'SIEVE' ? t.accent : t.other; });
    var opts = baseOptions(t, fmt, Math.ceil(Math.max.apply(null, data) * 20) / 20);
    opts.plugins.tipLabels.fmt = function (v) { return v.toFixed(3); };
    opts.plugins.title = { display: true, text: ZIPF.sizes[i] + ' of the working set', align: 'start',
      color: t.ink, font: { size: 13, weight: '600' }, padding: { bottom: 8 } };
    opts.plugins.tooltip.callbacks.label = function (item) { return item.raw.toFixed(3) + ' miss ratio'; };
    // every bar carries its value, so the panels need no value axis
    opts.scales.x.display = false;
    var ds = bars(colors, data, '', t);
    return { type: 'bar', data: { labels: ALGOS, datasets: [ds] }, plugins: [tipLabels], options: opts };
  }

  function primitiveConfig() {
    var t = tokens();
    var fmt = function (v) { return v.toFixed(1) + '%'; };
    var opts = baseOptions(t, function (v) { return v + '%'; }, 25);
    opts.plugins.tipLabels.fmt = fmt;
    opts.plugins.tooltip.callbacks.label = function (item) { return fmt(item.raw) + '  ' + item.dataset.label; };
    opts.plugins.legend = {
      display: true, position: 'top', align: 'start',
      labels: { color: t.ink2, usePointStyle: true, pointStyle: 'rect', boxWidth: 8, boxHeight: 8, padding: 14, font: { size: 12, weight: '500' } }
    };
    return {
      type: 'bar',
      data: {
        labels: PRIMITIVE.labels,
        datasets: [
          Object.assign(bars(t.other, PRIMITIVE.original, 'Original', t), { pointStyle: 'rect' }),
          Object.assign(bars(t.accent, PRIMITIVE.sieve, 'With SIEVE', t), { pointStyle: 'rect' })
        ]
      },
      plugins: [tipLabels],
      options: opts
    };
  }

  var CONFIGS = {
    'chart-zipf-0': function () { return zipfConfig(0); },
    'chart-zipf-1': function () { return zipfConfig(1); },
    'chart-zipf-2': function () { return zipfConfig(2); },
    'chart-zipf-3': function () { return zipfConfig(3); },
    'chart-primitive': primitiveConfig
  };

  function table(id, head, rows) {
    var box = document.querySelector('[data-table="' + id + '"]');
    if (!box || box.firstChild) return;
    var tbl = document.createElement('table');
    var tr = tbl.createTHead().insertRow();
    head.forEach(function (h) { var th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    var body = tbl.createTBody();
    rows.forEach(function (r) {
      var row = body.insertRow();
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = r[0];
      row.appendChild(th);
      r.slice(1).forEach(function (c) { row.insertCell().textContent = c; });
    });
    box.appendChild(tbl);
  }

  table('zipf', ['Algorithm'].concat(ZIPF.sizes), ALGOS.map(function (a) {
    return [a].concat(ZIPF.miss[a].map(function (v) { return v.toFixed(3); }));
  }));
  table('chart-primitive', ['Algorithm', 'Original', 'With SIEVE'], PRIMITIVE.labels.map(function (l, i) {
    var o = PRIMITIVE.original[i];
    return [l, o == null ? '–' : o.toFixed(1) + '%', PRIMITIVE.sieve[i].toFixed(1) + '%'];
  }));

  function draw(id, animate) {
    var canvas = document.getElementById(id);
    if (!canvas || !canvas.parentElement.clientWidth) return;
    if (charts[id]) charts[id].destroy();
    var cfg = CONFIGS[id]();
    if (!animate) cfg.options.animation = false;
    charts[id] = new Chart(canvas, cfg);
  }

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;

  var ids = Object.keys(CONFIGS);
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        draw(e.target.id, true);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    ids.forEach(function (id) { var c = document.getElementById(id); if (c) io.observe(c); });
  } else {
    ids.forEach(function (id) { draw(id, false); });
  }

  new MutationObserver(function () {
    Object.keys(charts).forEach(function (id) { draw(id, false); });
  }).observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme'] });
})();
