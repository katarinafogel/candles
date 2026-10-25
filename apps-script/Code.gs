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
 */

var CANDLES = 'Свечи';
var REVIEWS = 'Отзывы';

var REVIEW_COLUMNS = [
  'id', 'candleId', 'date', 'receivedAt',
  'overall', 'design', 'scentCold', 'scentHot', 'burn', 'wentOut', 'soot',
  'heat', 'crack', 'leak', 'instructionClear', 'finished',
  'burnHours', 'sessions', 'selfExtinguished', 'comment', 'name',
];

var LABELS = {
  scentCold: 'Аромат холодной', scentHot: 'Аромат горящей', burn: 'Как горела',
  wentOut: 'Тухла', soot: 'Коптила', heat: 'Нагрев подсвечника', crack: 'Трещина',
  leak: 'Протёк воск', instructionClear: 'Инструкция понятна', finished: 'Догорела',
};

function doPost(e) {
  try {
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
  if (!expected) throw new Error('В свойствах скрипта не задан TOKEN');
  if (token !== expected) throw new Error('Неверный токен');
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
  if (!b.id) throw new Error('Нет ИД свечи');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = candlesSheet_();
    var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    var row = [b.id, b.name || '', b.instruction || '', new Date()];
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
  var sh = candlesSheet_();
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === b.id) return { id: b.id, name: values[i][1], instruction: values[i][2], found: true };
  }
  return { id: b.id, found: false };
}

function feedback_(b) {
  var r = b.review || {};
  if (!r.id || !r.candleId) throw new Error('Пустой отзыв');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = reviewsSheet_();
    // Защита от дублей: UUID, сгенерированный на телефоне получателя.
    var last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === r.id) return { ok: true, duplicate: true };
    }
    var receivedAt = new Date();
    var row = REVIEW_COLUMNS.map(function (c) {
      if (c === 'receivedAt') return receivedAt.toISOString();
      var v = r[c];
      return v === undefined || v === null ? '' : v;
    });
    sh.appendRow(row);
    notify_(r, sh.getLastRow());
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
  if (r.name) lines.push('От: ' + r.name);
  if (r.overall) lines.push('Общая оценка: ' + r.overall + '/10');
  if (r.design) lines.push('Дизайн: ' + r.design + '/10');
  Object.keys(LABELS).forEach(function (k) {
    if (r[k]) lines.push(LABELS[k] + ': ' + r[k]);
  });
  if (r.burnHours) lines.push('Горела: ' + r.burnHours + ' ч, сессий ' + (r.sessions || 0) + ', тухла сама ' + (r.selfExtinguished || 0));
  if (r.comment) lines.push('', 'Комментарий:', r.comment);
  lines.push('', 'Строка в таблице: ' + link);
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
      ['candleId', 'id', 'comment', 'name'].forEach(function (k) { if (o[k] !== undefined) o[k] = String(o[k]); });
      out.push(o);
    }
  }
  return { reviews: out, now: now.toISOString() };
}
