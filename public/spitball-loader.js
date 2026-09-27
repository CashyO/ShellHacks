/*!
 * spitball-loader.js — one-shot loading overlay for Spitball.
 * Vanilla JS, no dependencies. Works as a <script> (window.SpitballLoader) or CommonJS require.
 *
 *   SpitballLoader.start({ color: '#E53935', backdrop: 'flow' });  // show overlay, straw slides in
 *   SpitballLoader.progress(0.4);                                   // optional, 0..1 — fills the straw's stripes
 *   await SpitballLoader.done();                                    // fills to 100%, fires, ball covers screen, fades to page
 *
 * If you never call progress(), the straw creeps toward 90% on its own until done() is called.
 */
(function (root) {
  'use strict';

  var INK = '#1A1A1A';
  var TYPE = { feature: '#2E6BE6', improvement: '#7B4ED8', fix: '#C27C06', security: '#D23C35', test: '#0C8585' };
  var DEFAULT_IDEAS = [['Pomodoro timer','feature'],['Recurring events','feature'],['Drag to reschedule','feature'],['Conflict detection','improvement'],
    ['iCal export','feature'],['Validate POST /events','security'],['Timezone bug','fix'],['Tests for schedule.js','test'],['Keyboard shortcuts','improvement'],
    ['Pause and resume','feature'],['Notify when time is up','feature'],['RRULE support','improvement'],['Snap to 15 minutes','improvement'],
    ['Undo a move','feature'],['Rate-limit event writes','security']];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function dirFromAngle(deg) { var r = deg * Math.PI / 180; return [Math.cos(r), 0, Math.sin(r)]; }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16); return 'rgb(' + Math.round(((n >> 16) & 255) * k) + ',' + Math.round(((n >> 8) & 255) * k) + ',' + Math.round((n & 255) * k) + ')'; }
  function hull(P) {
    var p = P.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
    for (i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var LIGHT = norm([-0.45, -1, -0.7]);

  var R = 0.23, LEN = 5.2, Y0 = 1.35, Z0 = 7.4, FLOOR = Y0 + R + 0.42, BR = 0.24, NR = 40;
  var T_AIM = 1.15, T_FIRE = 1.3, SHOT = 1.0;

  var inst = null;

  function start(opts) {
    if (inst) return api;
    opts = opts || {};
    var color = opts.color || '#E53935';
    var backdrop = opts.backdrop === 'none' ? 'none' : 'flow';
    var showLabel = opts.label !== false;
    var labelText = opts.labelText || 'Loading ideas';
    var ideas = (opts.ideas || DEFAULT_IDEAS).map(function (d) { return typeof d === 'string' ? [d, 'feature'] : d; });
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var el = document.createElement('div');
    el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', labelText);
    el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#FFFFFF;overflow:hidden';
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(cv); document.body.appendChild(el);
    var ctx = cv.getContext('2d');

    var W = 0, H = 0, DPR = 1, F = 1, CX = 0, CY = 0;
    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1); W = el.clientWidth; H = el.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      F = Math.min(W * 0.62, H * 1.05); CX = W / 2; CY = H * 0.33;
    }
    window.addEventListener('resize', resize); resize();
    function proj(x, y, z) { return [CX + F * x / z, CY + F * y / z]; }
    function unproj(sx, sy, z) { return [(sx - CX) * z / F, (sy - CY) * z / F, z]; }
    function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

    function makeStraw(c, d) {
      d = norm(d);
      var u = [0, 1, 0]; u = norm([u[0] - d[0] * dot(u, d), u[1] - d[1] * dot(u, d), u[2] - d[2] * dot(u, d)]);
      var v = cross(d, u);
      function nrm(phi) { var c1 = Math.cos(phi), s1 = Math.sin(phi); return [u[0] * c1 + v[0] * s1, u[1] * c1 + v[1] * s1, u[2] * c1 + v[2] * s1]; }
      function at(s, phi, r) { if (r === undefined) r = R; var n = nrm(phi); return [c[0] + d[0] * s + n[0] * r, c[1] + d[1] * s + n[1] * r, c[2] + d[2] * s + n[2] * r]; }
      function P(s, phi, r) { var q = at(s, phi, r); return proj(q[0], q[1], q[2]); }
      function ring(s, r) { var a = []; for (var i = 0; i < NR; i++) a.push(P(s, i / NR * Math.PI * 2, r)); return a; }
      function front(s, phi) { return dot(nrm(phi), at(s, phi)) < 0; }
      return { c: c, d: d, nrm: nrm, P: P, ring: ring, front: front, mouth: [c[0] - d[0] * LEN / 2, c[1] - d[1] * LEN / 2, c[2] - d[2] * LEN / 2] };
    }
    function drawStraw(g, spin, prog) {
      var sMax = -LEN / 2 + prog * LEN, outline = hull(g.ring(-LEN / 2).concat(g.ring(LEN / 2)));
      var NS = 36, i, p0, p1, pm, k;
      for (i = 0; i < NS; i++) {
        p0 = i / NS * Math.PI * 2; p1 = (i + 1) / NS * Math.PI * 2; pm = (p0 + p1) / 2;
        if (!g.front(0, pm)) continue;
        k = 0.84 + 0.16 * Math.max(0, dot(g.nrm(pm), LIGHT));
        poly([g.P(-LEN / 2, p0), g.P(LEN / 2, p0), g.P(LEN / 2, p1), g.P(-LEN / 2, p1)]);
        ctx.fillStyle = shade('#FFFFFF', k); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8; ctx.stroke();
      }
      var buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], TURNS = 4.2, BANDS = 3, BW = 0.95, steps = 378, b;
      for (b = 0; b < BANDS; b++) {
        var off = b / BANDS * Math.PI * 2 + spin;
        for (i = 0; i < steps; i++) {
          var t0 = i / steps, t1 = (i + 1) / steps, s0 = -LEN / 2 + t0 * LEN, s1 = -LEN / 2 + t1 * LEN;
          if (s0 >= sMax) break;
          if (s1 > sMax) { t1 = (sMax + LEN / 2) / LEN; s1 = sMax; }
          var a0 = off + t0 * TURNS * Math.PI * 2, a1 = off + t1 * TURNS * Math.PI * 2, am = (a0 + a1) / 2 + BW / 2;
          if (!g.front((s0 + s1) / 2, am)) continue;
          k = 0.8 + 0.2 * Math.max(0, dot(g.nrm(am), LIGHT));
          var c0 = g.P(s0, a0), c1 = g.P(s1, a1), c2 = g.P(s1, a1 + BW), c3 = g.P(s0, a0 + BW), path = buckets[clamp(Math.floor((k - 0.8) / 0.05), 0, 3)];
          path.moveTo(c0[0], c0[1]); path.lineTo(c1[0], c1[1]); path.lineTo(c2[0], c2[1]); path.lineTo(c3[0], c3[1]); path.closePath();
        }
      }
      for (i = 0; i < 4; i++) { ctx.fillStyle = shade(color, 0.825 + 0.05 * i); ctx.fill(buckets[i]); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke(buckets[i]); }
      poly(outline); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
      [-LEN / 2, LEN / 2].forEach(function (s) {
        var sign = s > 0 ? 1 : -1, ec = [g.c[0] + g.d[0] * s, g.c[1] + g.d[1] * s, g.c[2] + g.d[2] * s];
        if (-sign * dot(g.d, ec) / Math.hypot(ec[0], ec[1], ec[2]) <= 0.02) return;
        var outer = g.ring(s), inner = g.ring(s, R * 0.8);
        poly(outer); ctx.fillStyle = shade(color, 0.92); ctx.fill();
        poly(inner); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(); ctx.fillStyle = 'rgba(26,26,26,0.12)'; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6; poly(outer); ctx.stroke();
        ctx.strokeStyle = 'rgba(26,26,26,0.45)'; ctx.lineWidth = 1; poly(inner); ctx.stroke();
      });
    }

    function softShape(pts, blur, alpha) {
      var OFF = 10000; ctx.save();
      ctx.shadowColor = 'rgba(26,26,26,' + alpha + ')'; ctx.shadowBlur = blur * DPR; ctx.shadowOffsetX = OFF * DPR;
      ctx.beginPath(); ctx.moveTo(pts[0][0] - OFF, pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - OFF, pts[i][1]);
      ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    }
    function strawShadow(g) {
      var dh = [g.d[0], 0, g.d[2]], lh = Math.hypot(dh[0], dh[2]);
      dh = lh > 1e-3 ? [dh[0] / lh, 0, dh[2] / lh] : [1, 0, 0];
      var vh = [-dh[2], 0, dh[0]], h = FLOOR - (g.c[1] + R);
      function fp(spread) {
        var pts = [], w = R * spread;
        [-LEN / 2, LEN / 2].forEach(function (s) {
          var cx = g.c[0] + g.d[0] * s, cz = g.c[2] + g.d[2] * s;
          for (var k = 0; k < 16; k++) {
            var a = k / 16 * Math.PI * 2, x = cx + vh[0] * Math.cos(a) * w + dh[0] * Math.sin(a) * w * 0.9, z = cz + vh[2] * Math.cos(a) * w + dh[2] * Math.sin(a) * w * 0.9;
            if (z > 0.2) pts.push(proj(x, FLOOR, z));
          }
        });
        return pts.length > 2 ? hull(pts) : null;
      }
      var wide = fp(1.9 + h * 2.2), core = fp(1.05);
      if (wide) softShape(wide, F * (0.1 + h * 0.12) / g.c[2], 0.16);
      if (core) softShape(core, F * 0.035 / g.c[2], 0.22);
    }

    function chip(x, y, fs, text, col, alpha, center) {
      if (fs < 5 || alpha <= 0.01) return;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.font = '500 ' + fs.toFixed(1) + 'px "Helvetica Neue", Helvetica, Arial, sans-serif';
      var tw = ctx.measureText(text).width, ph = fs * 1.9, pw = tw + fs * 2.4, x0 = center ? x - pw / 2 : x, y0 = y - ph / 2;
      ctx.beginPath(); ctx.roundRect(x0, y0, pw, ph, ph / 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.strokeStyle = '#D9D7D0'; ctx.lineWidth = Math.max(1, fs * 0.06); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + fs * 0.95, y, fs * 0.28, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(text, x0 + fs * 1.6, y + fs * 0.04);
      ctx.restore();
    }
    var graph = (function () {
      var r = rng(11), nodes = [{ x: 0, y: 0, z: 0, root: true }], links = [], ring = Math.min(9, ideas.length);
      for (var i = 0; i < ring; i++) { var a = i / ring * Math.PI * 2; nodes.push({ x: Math.cos(a) * 3.2, y: Math.sin(a) * 1.6 - 0.2, z: Math.sin(a * 2) * 0.8, c: TYPE[ideas[i][1]] || TYPE.feature, t: ideas[i][0], k: i }); links.push([0, i + 1]); }
      for (var j = 0; j < Math.min(6, ideas.length - ring); j++) {
        var p = 1 + ((j * 3 + 1) % ring), b = nodes[p], a2 = Math.atan2(b.y, b.x) + (r() - 0.5) * 0.9, id2 = ideas[ring + j];
        nodes.push({ x: b.x + Math.cos(a2) * 1.6, y: b.y + Math.sin(a2) * 1.0, z: b.z + (r() - 0.5), c: TYPE[id2[1]] || TYPE.feature, t: id2[0], k: ring + j }); links.push([p, nodes.length - 1]);
      }
      return { nodes: nodes, links: links };
    })();
    function drawFlow(fill) {
      var ang = clk * 0.18, ca = Math.cos(ang), sa = Math.sin(ang), N = graph.nodes.length - 1;
      var intake = lastStraw ? lastStraw.P(LEN / 2, 0, 0) : [CX, CY], sx = clamp(W / 380, 1.6, 2.6);
      var P = graph.nodes.map(function (n) { var x = n.x * ca - n.z * sa, z = n.x * sa + n.z * ca; return proj(x * sx, n.y * 1.15 - 1.9, 17 + z); });
      graph.nodes.forEach(function (n) { if (!n.root && fill >= (n.k + 1) / N && n.abs == null) n.abs = clk; });
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#C9CFD6'; ctx.beginPath();
      graph.links.forEach(function (l) { if (graph.nodes[l[1]].abs != null) return; ctx.moveTo(P[l[0]][0], P[l[0]][1]); ctx.lineTo(P[l[1]][0], P[l[1]][1]); }); ctx.stroke();
      var rp = P[0], rr = F * 0.62 / 17;
      ctx.beginPath(); ctx.arc(rp[0], rp[1], F * 0.42 / 17, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#D6DDE3'; ctx.beginPath(); ctx.arc(rp[0], rp[1], rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#1C9A50'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(rp[0], rp[1], rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill); ctx.stroke(); ctx.lineCap = 'butt';
      graph.nodes.forEach(function (n, i) {
        if (n.root) return;
        var sp = P[i], r = F * 0.2 / 17;
        if (n.abs != null) {
          var f = seg(clk, n.abs, n.abs + 0.6); if (f >= 1) return;
          var e = f * f * (3 - 2 * f), arc = Math.sin(Math.PI * f) * Math.min(90, H * 0.12);
          sp = [sp[0] + (intake[0] - sp[0]) * e, sp[1] + (intake[1] - sp[1]) * e - arc]; r *= 1 - 0.55 * e;
          ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, Math.PI * 2); ctx.fillStyle = n.c; ctx.fill();
          chip(sp[0] + r + 4, sp[1], 11 * (1 - 0.4 * e), n.t, n.c, 1 - seg(f, 0.75, 1), false);
          return;
        }
        ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.setLineDash([3, 2.5]); ctx.strokeStyle = n.c; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
      });
    }
    function drawBurst() {
      if (!burst) return;
      burst.items.forEach(function (it) {
        var k = seg(clk - burst.t0 - it.d, 0, 1.05); if (k <= 0 || k >= 1) return;
        var e = Math.pow(k, 1.5), z = burst.from[2] + (0.9 - burst.from[2]) * e;
        var sp = proj(burst.from[0] + Math.cos(it.a) * it.sp * e, burst.from[1] + Math.sin(it.a) * it.sp * 0.6 * e, z), a = 1 - seg(k, 0.7, 1), r = Math.min(F * 0.07 / z, 60);
        ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, Math.PI * 2); ctx.fillStyle = it.c; ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1;
        chip(sp[0], sp[1] + r + 0.25 * F / z, Math.min(48, 0.22 * F / z), it.t, it.c, a, true);
      });
    }

    function drawBall() {
      var k = seg(shot.t, 0, SHOT), e = Math.pow(k, 1.6), p = mix(shot.from, shot.to, e);
      var emerge = outBack(seg(shot.t, 0, 0.18)), alpha = 1 - seg(shot.t, SHOT + 0.35, SHOT + 1.0);
      var s = proj(p[0], p[1], p[2]), r = F * BR / p[2] * (0.55 + 0.45 * emerge);
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(s[0], s[1]);
      ctx.shadowColor = 'rgba(26,26,26,.22)'; ctx.shadowBlur = Math.min(40, r * 0.25) * DPR; ctx.shadowOffsetY = r * 0.06;
      var sg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.04, 0, 0, r);
      sg.addColorStop(0, '#FFFFFF'); sg.addColorStop(0.55, '#F5F5F3'); sg.addColorStop(1, '#D8D7D2');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(26,26,26,0.55)'; ctx.lineWidth = clamp(r * 0.015, 1.2, 3); ctx.stroke();
      ctx.restore();
    }

    var clk = 0, enter = 0, spin = 0, target = 0, shown = 0, userProg = false, finishing = false, doneAt = null;
    var shot = null, burst = null, kick = 0, lastStraw = null, revealed = false, raf = 0, resolveDone = null;
    var donePromise = new Promise(function (res) { resolveDone = res; });

    function fire() {
      var g = lastStraw;
      shot = { t: 0, from: g.mouth.slice(), to: unproj(CX, H * 0.5, F * BR / (Math.hypot(W, H) * 1.4)) };
      var loaded = backdrop === 'flow' ? graph.nodes.filter(function (n) { return n.abs != null; }).slice(-10) : [];
      burst = loaded.length ? { t0: clk, from: g.mouth.slice(), items: loaded.map(function (n, i) { return { t: n.t, c: n.c, a: i / loaded.length * Math.PI * 2 + Math.random() * 0.5, sp: 1.1 + Math.random() * 1.4, d: Math.random() * 0.18 }; }) } : null;
      kick = 1;
    }
    function finish() {
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      if (el.parentNode) el.parentNode.removeChild(el);
      inst = null; resolveDone();
    }

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      clk += dt; enter += dt; spin -= dt * 3.2;
      if (!userProg && !finishing) target = Math.max(target, 0.9 * (1 - Math.exp(-Math.max(0, enter - 1.1) / 3)));
      if (finishing) target = 1;
      if (enter > 1.0) shown += (target - shown) * (1 - Math.exp(-dt * (finishing ? 7 : 3.5)));
      if (finishing && shown > 0.995) { shown = 1; if (doneAt == null) doneAt = clk; }
      el.setAttribute('aria-valuenow', String(Math.round(shown * 100)));

      var t = doneAt == null ? -1 : clk - doneAt;
      var aim = t < 0 ? 0 : t < 0.35 ? -10 * inOut(seg(t, 0, 0.35)) : -10 + 100 * outBack(seg(t, 0.35, T_AIM));
      if (t >= T_FIRE && !shot) fire();
      if (shot) shot.t += dt;
      kick = Math.max(0, kick - dt * 2.2);
      var kk = kick > 0 ? (kick > 0.8 ? outCubic((1 - kick) / 0.2) : inOut(kick / 0.8)) * 0.5 : 0;
      var c = [-15 * (1 - outBack(seg(enter, 0, 1.1))), Y0 + Math.sin(clk * 0.8) * 0.035, Z0 + kk];
      var g = makeStraw(c, dirFromAngle(aim)); lastStraw = g;

      if (shot && shot.t >= SHOT && !revealed) { revealed = true; el.style.background = 'transparent'; el.style.pointerEvents = 'none'; }

      ctx.clearRect(0, 0, W, H);
      if (!revealed) {
        if (backdrop === 'flow') drawFlow(shown);
        strawShadow(g);
        drawStraw(g, spin, shown);
        if (showLabel && !shot) {
          var la = seg(enter, 0.9, 1.3) * (1 - seg(t, 0, 0.3));
          if (la > 0) {
            ctx.save(); ctx.globalAlpha = la; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = '500 11px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
            ctx.fillText((shown >= 1 ? 'READY' : labelText.toUpperCase()), CX, H * 0.74);
            ctx.font = '700 28px "Helvetica Neue", Helvetica, Arial, sans-serif';
            ctx.fillText(Math.round(shown * 100) + '%', CX, H * 0.74 + 34);
            ctx.restore();
          }
        }
        drawBurst();
      }
      if (shot) drawBall();
      if (shot && shot.t > SHOT + 1.05) return finish();
      raf = requestAnimationFrame(frame);
    }

    if (reduce) {
      el.style.transition = 'opacity .35s';
      inst = {
        progress: function () {},
        done: function () { el.style.opacity = '0'; setTimeout(finish, 360); return donePromise; },
        destroy: finish
      };
      return api;
    }
    raf = requestAnimationFrame(frame);
    inst = {
      progress: function (p) { userProg = true; target = Math.max(target, clamp(+p || 0, 0, 1)); },
      done: function () { finishing = true; return donePromise; },
      destroy: finish
    };
    return api;
  }

  var api = {
    start: start,
    progress: function (p) { if (inst) inst.progress(p); return api; },
    done: function () { return inst ? inst.done() : Promise.resolve(); },
    destroy: function () { if (inst) inst.destroy(); },
    get active() { return !!inst; }
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpitballLoader = api;
})(typeof window !== 'undefined' ? window : this);
