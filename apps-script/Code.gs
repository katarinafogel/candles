/**
 * Мастерская свечей — приём отзывов (ТЗ, раздел 6.5).
 *
 * Привязан к Google-таблице мастера, опубликован как веб-приложение.
 * Листы «Свечи» и «Отзывы» создаются сами при первом запросе.
 * Секретный токен лежит в свойствах скрипта под ключом TOKEN,
 * почта для писем — под ключом EMAIL (если пусто — почта владельца скрипта).
 *
 * Браузер шлёт POST с Content-Type: text/plain, поэтому предварительного
 * CORS-запроса нет. Ответ — JSON.
 *
 * Безопасность:
 * - @OnlyCurrentDoc: скрипт получает доступ только к этой таблице, а не ко всему Диску.
 * - Снаружи доступны только четыре действия ниже; ничего не удаляется.
 * - Всё, что приходит от посетителей, проверяется и обрезается, а текст
 *   записывается в ячейки как текст, а не как формула.
 * - Отзывы и письма ограничены по количеству в час.
 *
 * @OnlyCurrentDoc
 */

var CANDLES = 'Свечи';
var REVIEWS = 'Отзывы';

var MAX_REVIEWS_PER_HOUR = 60;
var MAX_REVIEWS_PER_CANDLE_PER_HOUR = 10;
var MAX_EMAILS_PER_HOUR = 20;

var ID_RE = /^S-\d{1,6}$/;
var UUID_RE = /^[0-9a-f-]{36}$/i;

var REVIEW_COLUMNS = [
  'id', 'candleId', 'date', 'receivedAt',
  'overall', 'design', 'scentCold', 'scentHot', 'burn', 'wentOut', 'soot',
  'heat', 'crack', 'leak', 'instructionClear', 'finished',
  'burnHours', 'sessions', 'selfExtinguished', 'comment', 'name',
];

// Every answer the form can send; anything else is dropped.
var CHOICES = {
  scentCold: ['none', 'weak', 'nice', 'strong'],
  scentHot: ['none', 'weak', 'nice', 'strong'],
  burn: ['weak', 'normal', 'strong'],
  wentOut: ['no', 'sometimes', 'often'],
  soot: ['no', 'little', 'strong'],
  heat: ['cool', 'warm', 'hot'],
  crack: ['no', 'crack', 'broken'],
  leak: ['no', 'yes'],
  instructionClear: ['yes', 'notReally', 'didntRead'],
  finished: ['yes', 'burning'],
};

var LABELS = {
  scentCold: 'Аромат холодной', scentHot: 'Аромат горящей', burn: 'Как горела',
  wentOut: 'Тухла', soot: 'Коптила', heat: 'Нагрев подсвечника', crack: 'Трещина',
  leak: 'Протёк воск', instructionClear: 'Инструкция понятна', finished: 'Догорела',
};

function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 20000) return json({ error: 'bad request' });
    var body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'register': return json(register_(body));
      case 'candle': return json(candle_(body));
      case 'feedback': return json(feedback_(body));
      case 'pull': return json(pull_(body));
      default: return json({ error: 'unknown action' });
    }
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  }
}

function doGet() {
  return json({ ok: true, app: 'candle-tracker' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected || expected.length < 20) throw new Error('В свойствах скрипта не задан TOKEN (нужно 20+ символов)');
  if (typeof token !== 'string' || token !== expected) {
    Utilities.sleep(1000); // slows down guessing
    throw new Error('Неверный токен');
  }
}

/** Text from visitors is stored as plain text: a leading = + - @ would otherwise make it a formula. */
function text_(v, max) {
  if (v === undefined || v === null) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function num_(v, min, max) {
  var n = Number(v);
  return v === '' || v === null || v === undefined || !isFinite(n) ? '' : Math.min(max, Math.max(min, n));
}

/** Counts events in the script cache; returns false once the hourly limit is reached. */
function allow_(key, limit) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0);
  if (n >= limit) return false;
  cache.put(key, String(n + 1), 3600);
  return true;
}

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function candlesSheet_() {
  return sheet_(CANDLES, ['id', 'name', 'instruction', 'updatedAt']);
}

function reviewsSheet_() {
  return sheet_(REVIEWS, REVIEW_COLUMNS);
}

/** Мастер публикует название и инструкцию свечи в момент выдачи. */
function register_(b) {
  checkToken_(b.token);
  if (!ID_RE.test(String(b.id))) throw new Error('Неверный ИД свечи');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = candlesSheet_();
    var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    var row = [b.id, text_(b.name, 200), text_(b.instruction, 5000), new Date()];
    for (var i = 1; i < ids.length; i++) {
      if (ids[i][0] === b.id) {
        sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return { ok: true };
      }
    }
    sh.appendRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Публичная страница получает только название и инструкцию. */
function candle_(b) {
  if (!ID_RE.test(String(b.id))) return { id: '', found: false };
  var values = candlesSheet_().getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === b.id) {
      return { id: b.id, name: plain_(values[i][1]), instruction: plain_(values[i][2]), found: true };
    }
  }
  return { id: b.id, found: false };
}

/** Drops the apostrophe added by text_ when reading back. */
function plain_(v) {
  var s = String(v);
  return s.charAt(0) === "'" ? s.slice(1) : s;
}

function feedback_(b) {
  var r = b.review || {};
  if (!UUID_RE.test(String(r.id)) || !ID_RE.test(String(r.candleId))) throw new Error('Пустой отзыв');
  if (!allow_('reviews', MAX_REVIEWS_PER_HOUR) || !allow_('reviews:' + r.candleId, MAX_REVIEWS_PER_CANDLE_PER_HOUR)) {
    throw new Error('Слишком много отзывов, попробуйте позже');
  }
  var clean = {
    id: String(r.id),
    candleId: String(r.candleId),
    date: isNaN(new Date(r.date)) ? new Date().toISOString() : new Date(r.date).toISOString(),
    receivedAt: new Date().toISOString(),
    overall: num_(r.overall, 1, 10),
    design: num_(r.design, 1, 10),
    burnHours: num_(r.burnHours, 0, 10000),
    sessions: num_(r.sessions, 0, 10000),
    selfExtinguished: num_(r.selfExtinguished, 0, 10000),
    comment: text_(r.comment, 3000),
    name: text_(r.name, 100),
  };
  Object.keys(CHOICES).forEach(function (k) {
    clean[k] = CHOICES[k].indexOf(r[k]) >= 0 ? r[k] : '';
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = reviewsSheet_();
    // Защита от дублей: UUID, сгенерированный на телефоне получателя.
    var last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === clean.id) return { ok: true, duplicate: true };
    }
    sh.appendRow(REVIEW_COLUMNS.map(function (c) { return clean[c]; }));
    if (allow_('emails', MAX_EMAILS_PER_HOUR)) notify_(clean, sh.getLastRow());
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function notify_(r, rowNumber) {
  var to = PropertiesService.getScriptProperties().getProperty('EMAIL') || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var link = ss.getUrl() + '#gid=' + reviewsSheet_().getSheetId() + '&range=A' + rowNumber;
  var lines = ['Свеча: ' + r.candleId];
  if (r.name) lines.push('От: ' + plain_(r.name));
  if (r.overall) lines.push('Общая оценка: ' + r.overall + '/10');
  if (r.design) lines.push('Дизайн: ' + r.design + '/10');
  Object.keys(LABELS).forEach(function (k) {
    if (r[k]) lines.push(LABELS[k] + ': ' + r[k]);
  });
  if (r.burnHours) lines.push('Горела: ' + r.burnHours + ' ч, сессий ' + (r.sessions || 0) + ', тухла сама ' + (r.selfExtinguished || 0));
  if (r.comment) lines.push('', 'Комментарий:', plain_(r.comment));
  lines.push('', 'Строка в таблице: ' + link);
  // Plain-text letter only to the master: visitors can't choose the recipient or inject HTML.
  MailApp.sendEmail(to, 'Отзыв на свечу ' + r.candleId + (r.overall ? ' — ' + r.overall + '/10' : ''), lines.join('\n'));
}

/** Мастер забирает отзывы новее указанной даты. */
function pull_(b) {
  checkToken_(b.token);
  var since = b.since ? new Date(b.since).getTime() : 0;
  var now = new Date();
  var values = reviewsSheet_().getDataRange().getValues();
  var head = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var o = {};
    for (var j = 0; j < head.length; j++) {
      var v = values[i][j];
      if (v === '' || v === null) continue;
      o[head[j]] = v instanceof Date ? v.toISOString() : v;
    }
    var t = o.receivedAt ? new Date(o.receivedAt).getTime() : 0;
    if (t > since) {
      delete o.receivedAt;
      // Числа из таблицы приходят числами, остальное — строками.
      ['candleId', 'id', 'comment', 'name'].forEach(function (k) { if (o[k] !== undefined) o[k] = plain_(o[k]); });
      out.push(o);
    }
  }
  return { reviews: out, now: now.toISOString() };
}
