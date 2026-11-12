// The sky follows the viewer's own clock: sunrise, day, sunset and night.
// Plain JS, inlined into the page (index.astro) so it runs before the first paint: it sets the CSS
// colours the fallback sky and the browser bars read, and window.__sky, which the WebGL sky reads.
//
// The phase comes from the sun's real height where the viewer is. Their place is guessed from the
// device's timezone (no permission prompt, ever); geolocation is used only if it was already granted.
//   ?sky=sunrise|day|sunset|night   pin a phase
//   ?hour=19.5                      pretend it is this local hour today
//   ?tz=Asia/Manila                 pretend to be in this timezone
(function () {
  var q = new URLSearchParams(location.search);

  // each palette: sky top, sky middle, low glow, cloud highlight, cloud shadow, CSS low stop, stars,
  // and the light on the dolls (hemisphere, key). day is the original look and must not change.
  var PALETTES = {
    day: {
      deep: '#1450c4', pale: '#2f7ee6', glow: '#2f7ee6', cream: '#f4ecd9', shade: '#4a7fd4',
      cssGlow: '#92b5e0', bar: '#1450c2', paper: '#f2ead7', stars: 0,
      hemi: '#fffaf0', key: '#fff6e6',
    },
    sunrise: {
      deep: '#7b8bd6', pale: '#f4b9cb', glow: '#fad9a0', cream: '#fff3e4', shade: '#d595b4',
      cssGlow: '#fad9a0', bar: '#7b8bd6', paper: '#fdf0e0', stars: 0,
      hemi: '#fff1ea', key: '#ffe6cf',
    },
    sunset: {
      deep: '#4a3a8e', pale: '#e57b98', glow: '#f7b56e', cream: '#ffe3c2', shade: '#a8679f',
      cssGlow: '#f7b56e', bar: '#4a3a8e', paper: '#fbe0c2', stars: 0.25,
      hemi: '#ffe6d6', key: '#ffd3ad',
    },
    night: {
      deep: '#070f2c', pale: '#14295c', glow: '#1f3a78', cream: '#c3cde6', shade: '#2b4384',
      cssGlow: '#1f3a78', bar: '#070f2c', paper: '#b9c3dc', stars: 1,
      hemi: '#e2e8ff', key: '#d4dcff',
    },
  };
  var NAMES = ['sunrise', 'day', 'sunset', 'night'];
  var LABELS = { sunrise: 'Sunrise', day: 'Day', sunset: 'Sunset', night: 'Night' };
  var pinned = NAMES.indexOf(q.get('sky')) >= 0 ? q.get('sky') : null; // a phase chosen by hand, or null to follow the clock

  // a rough place for the zones most people are in: [lat, lon]
  var ZONES = {
    'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Lisbon': [38.7, -9.1],
    'Europe/Madrid': [40.4, -3.7], 'Europe/Paris': [48.9, 2.4], 'Europe/Brussels': [50.8, 4.4],
    'Europe/Amsterdam': [52.4, 4.9], 'Europe/Berlin': [52.5, 13.4], 'Europe/Rome': [41.9, 12.5],
    'Europe/Zurich': [47.4, 8.5], 'Europe/Vienna': [48.2, 16.4], 'Europe/Stockholm': [59.3, 18.1],
    'Europe/Oslo': [59.9, 10.8], 'Europe/Copenhagen': [55.7, 12.6], 'Europe/Helsinki': [60.2, 24.9],
    'Europe/Warsaw': [52.2, 21], 'Europe/Prague': [50.1, 14.4], 'Europe/Athens': [38, 23.7],
    'Europe/Istanbul': [41, 29], 'Europe/Moscow': [55.8, 37.6], 'Europe/Kyiv': [50.5, 30.5],
    'Asia/Manila': [14.6, 121], 'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Shanghai': [31.2, 121.5],
    'Asia/Taipei': [25, 121.5], 'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.6, 127],
    'Asia/Singapore': [1.3, 103.8], 'Asia/Kuala_Lumpur': [3.1, 101.7], 'Asia/Jakarta': [-6.2, 106.8],
    'Asia/Bangkok': [13.8, 100.5], 'Asia/Ho_Chi_Minh': [10.8, 106.7], 'Asia/Kolkata': [22.6, 78],
    'Asia/Calcutta': [22.6, 78], 'Asia/Karachi': [24.9, 67], 'Asia/Dubai': [25.2, 55.3],
    'Asia/Riyadh': [24.7, 46.7], 'Asia/Qatar': [25.3, 51.5], 'Asia/Tehran': [35.7, 51.4],
    'Asia/Jerusalem': [31.8, 35.2], 'Asia/Dhaka': [23.8, 90.4],
    'America/New_York': [40.7, -74], 'America/Toronto': [43.7, -79.4], 'America/Chicago': [41.9, -87.6],
    'America/Denver': [39.7, -105], 'America/Phoenix': [33.4, -112.1], 'America/Los_Angeles': [34.1, -118.2],
    'America/Vancouver': [49.3, -123.1], 'America/Anchorage': [61.2, -149.9], 'Pacific/Honolulu': [21.3, -157.9],
    'America/Mexico_City': [19.4, -99.1], 'America/Bogota': [4.7, -74.1], 'America/Lima': [-12, -77],
    'America/Santiago': [-33.4, -70.7], 'America/Sao_Paulo': [-23.6, -46.6],
    'America/Argentina/Buenos_Aires': [-34.6, -58.4], 'America/Buenos_Aires': [-34.6, -58.4],
    'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145], 'Australia/Brisbane': [-27.5, 153],
    'Australia/Perth': [-31.9, 115.9], 'Australia/Adelaide': [-34.9, 138.6], 'Pacific/Auckland': [-36.8, 174.8],
    'Africa/Lagos': [6.5, 3.4], 'Africa/Cairo': [30, 31.2], 'Africa/Nairobi': [-1.3, 36.8],
    'Africa/Johannesburg': [-26.2, 28], 'Africa/Casablanca': [33.6, -7.6],
  };
  var REGION_LAT = { Europe: 50, Asia: 25, Africa: 5, America: 35, Australia: -32, Pacific: -15, Atlantic: 40, Indian: -10, Antarctica: -75, Arctic: 78 };

  function offsetMinutes(tz, date) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
        .formatToParts(date).forEach(function (x) { p[x.type] = +x.value; });
      return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
    } catch (e) { return -date.getTimezoneOffset(); }
  }

  var tz = q.get('tz') || (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
  var place = null; // [lat, lon], or null to fall back to fixed hours
  if (ZONES[tz]) place = ZONES[tz];
  else if (REGION_LAT[tz.split('/')[0]] !== undefined) {
    // an unlisted zone: its standard (winter) offset gives the longitude, its region a latitude
    var y = new Date().getFullYear();
    var std = Math.min(offsetMinutes(tz, new Date(Date.UTC(y, 0, 15))), offsetMinutes(tz, new Date(Date.UTC(y, 6, 15))));
    place = [REGION_LAT[tz.split('/')[0]], std / 4];
    if (REGION_LAT[tz.split('/')[0]] === 35 && std / 60 > -5 && std / 60 < -2) place[0] = -20; // South America
  }

  // the sun's height above the horizon in degrees, and whether it is still climbing (NOAA's approximation)
  function sun(date, lat, lon) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 1);
    var hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var g = (2 * Math.PI / 365) * ((date.getTime() - start) / 864e5 - hours / 24 + (hours - 12) / 24);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var ha = ((hours * 60 + eq + 4 * lon) / 4 - 180) * Math.PI / 180;
    var la = lat * Math.PI / 180;
    var cz = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha);
    var ha180 = Math.atan2(Math.sin(ha), Math.cos(ha));
    return { elev: 90 - Math.acos(Math.max(-1, Math.min(1, cz))) * 180 / Math.PI, rising: ha180 < 0 };
  }

  // without a place, a plain clock: the sun is up from 6:30 to 18:30
  function clockSun(localHour) {
    return { elev: 55 * Math.sin(Math.PI * (localHour - 6.5) / 12), rising: localHour < 12.5 };
  }

  function now() {
    var d = new Date();
    var h = parseFloat(q.get('hour') || '');
    if (!isNaN(h)) {
      // that local hour, today, in the viewer's (or the given) timezone
      var off = tz ? offsetMinutes(tz, d) : -d.getTimezoneOffset();
      var local = new Date(d.getTime() + off * 60000);
      d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + (h * 60 - off) * 60000);
    }
    return d;
  }

  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // full day above 10 degrees, full night below -10; between, the warm light, about 35 to 45 minutes
  // either side of the horizon at London's latitude, a little quicker nearer the equator
  function weights() {
    var w = { sunrise: 0, day: 0, sunset: 0, night: 0 };
    if (pinned) { w[pinned] = 1; return w; }
    return live(w);
  }
  function live(w) {
    var d = now(), s;
    if (place) s = sun(d, place[0], place[1]);
    else s = clockSun(d.getHours() + d.getMinutes() / 60);
    w.day = smooth(2, 10, s.elev);
    w.night = smooth(-4, -11, s.elev);
    w[s.rising ? 'sunrise' : 'sunset'] = Math.max(0, 1 - w.day - w.night);
    w.elev = Math.round(s.elev * 10) / 10;
    return w;
  }

  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function toHex(r) { return '#' + r.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function blend(w) {
    var out = {};
    Object.keys(PALETTES.day).forEach(function (k) {
      if (typeof PALETTES.day[k] === 'number') {
        out[k] = NAMES.reduce(function (s, n) { return s + PALETTES[n][k] * w[n]; }, 0);
      } else {
        var acc = [0, 0, 0];
        NAMES.forEach(function (n) { var c = hex(PALETTES[n][k]); for (var i = 0; i < 3; i++) acc[i] += c[i] * w[n]; });
        out[k] = toHex(acc);
      }
    });
    return out;
  }

  var root = document.documentElement;
  var sky = { weights: null, palette: null, phase: 'day', place: place, tz: tz };
  function apply() {
    var w = weights();
    var p = blend(w);
    sky.weights = w;
    sky.palette = p;
    sky.phase = NAMES.reduce(function (a, b) { return w[b] > w[a] ? b : a; }, 'day');
    root.dataset.sky = sky.phase;
    root.style.setProperty('--sky-deep', p.deep);
    root.style.setProperty('--sky-pale', p.pale);
    root.style.setProperty('--sky-glow', p.cssGlow);
    root.style.setProperty('--sky-cream', p.cream);
    root.style.setProperty('--sky-bar', p.bar);
    root.style.setProperty('--sky-paper', p.paper);
    var meta = document.querySelector('meta[name="theme-color"]');
    var trial = q.get('world') === 'valley' || (q.get('set') && q.get('set') !== 'dither'); // the older scenes keep their own bar
    if (meta && !trial) meta.setAttribute('content', p.bar);
    showToggle();
    try { dispatchEvent(new CustomEvent('mamasons:sky', { detail: sky })); } catch (e) {}
  }
  function livePhase() {
    var w = live({ sunrise: 0, day: 0, sunset: 0, night: 0 });
    return NAMES.reduce(function (a, b) { return w[b] > w[a] ? b : a; }, 'day');
  }

  // the toggle by the sound button: each tap moves on to the next phase, and the tap that comes
  // round to the viewer's own time hands the sky back to the clock
  function showToggle() {
    var b = document.querySelector('[data-sky-toggle]');
    if (!b) return;
    b.dataset.phase = sky.phase;
    b.setAttribute('aria-label', 'Time of day: ' + LABELS[sky.phase] + (pinned ? '' : ', your time') + '. Change');
  }
  sky.set = function (name) { pinned = NAMES.indexOf(name) >= 0 ? name : null; apply(); };
  sky.next = function () {
    var n = NAMES[(NAMES.indexOf(sky.phase) + 1) % NAMES.length];
    sky.set(n === livePhase() ? null : n);
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-sky-toggle]')) sky.next();
  });
  document.addEventListener('DOMContentLoaded', showToggle);
  window.__sky = sky;
  apply();
  // a page left open drifts with the day
  setInterval(apply, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });

  // a better place, but only if the viewer already said yes to this site: never a prompt
  if (!q.get('tz') && navigator.permissions && navigator.geolocation) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (s) {
      if (s.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(function (pos) {
        place = sky.place = [pos.coords.latitude, pos.coords.longitude];
        apply();
      }, function () {}, { maximumAge: 36e5, timeout: 8000 });
    }).catch(function () {});
  }
})();
