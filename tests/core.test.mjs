// Unit tests for the pure data logic in index.html (<script id="core">). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx = { Intl, Date }; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.FoodCore;
const plain = v => JSON.parse(JSON.stringify(v));

const HEADER = C.HEADER.slice();
// Columns deliberately shuffled + an extra unknown column, to prove mapping is by header name, not position.
const SHUFFLED = ['item','date','extra_col','entry_id','kcal','time','meal_type','protein_g','deleted','photo_file_id','photo_name','updated_at','updated_by','source','carbs_g','fat_g'];
const row = (h, o) => h.map(k => o[k] ?? '');
const sample = h => [h,
  row(h,{entry_id:'2026-01-05_0830_breakfast_1_1', item:'Oats', date:'2026-01-05', time:'08:30', meal_type:'breakfast', kcal:400, protein_g:20, carbs_g:50, fat_g:10, photo_file_id:'F1', photo_name:'2026-01-05_0830_breakfast_1.jpg', extra_col:'keep me'}),
  row(h,{entry_id:'2026-01-05_0830_breakfast_1_2', item:'Latte', date:'2026-01-05', time:'08:30', meal_type:'breakfast', kcal:130, protein_g:8, photo_file_id:'F1', photo_name:'2026-01-05_0830_breakfast_1.jpg'}),
  row(h,{entry_id:'2026-01-05_1900_dinner_1_1', item:'Ramen', date:'2026-01-05', time:'19:00', meal_type:'dinner', kcal:800, protein_g:30, deleted:'TRUE'}),
  [], // blank rows are skipped
  row(h,{entry_id:'2026-01-06_1230_lunch_1_1', item:'Sushi', date:'06/01/2026', time:'12:30', meal_type:'Lunch', kcal:'1,050', protein_g:'45'}),
];

test('maps columns by header name, in any order', () => {
  const p = C.parseFoodLog(sample(SHUFFLED));
  assert.equal(p.entries.length, 4);
  const oats = p.entries[0];
  assert.equal(oats.item, 'Oats'); assert.equal(oats.kcal, 400); assert.equal(oats.time, '08:30'); assert.equal(oats._row, 2);
  const sushi = p.entries.find(e => e.item === 'Sushi');
  assert.equal(sushi.date, '2026-01-06', 'UK day-first date parsed'); assert.equal(sushi.kcal, 1050); assert.equal(sushi.meal_type, 'lunch'); assert.equal(sushi._row, 6);
  assert.ok(p.writable, 'all write-required columns present');
});

test('legacy headers (Date, Meal, Protein g …) are understood but read-only', () => {
  const legacy = ['Date','Time','Meal','Item','Portion','kcal','Protein g','Carbs g','Fat g','Fibre g','Sugar g','Sodium mg','Alcohol units','Source','Confidence','Notes'];
  const p = C.parseFoodLog([legacy, ['2026-01-07','13:05','Lunch','Bento','1 box',650,30,80,20,4,6,900,0,'takeaway','medium','']]);
  const e = p.entries[0];
  assert.equal(e.meal_type, 'lunch'); assert.equal(e.protein_g, 30); assert.equal(e.sodium_mg, 900); assert.equal(e.source, 'takeaway');
  assert.equal(p.writable, false);
  assert.deepEqual(plain(p.missing), ['entry_id','photo_file_id','photo_name','updated_at','updated_by','deleted']);
});

test('soft-deleted rows are excluded from totals', () => {
  const p = C.parseFoodLog(sample(HEADER));
  const byDate = C.groupByDate(p.entries);
  assert.equal(byDate['2026-01-05'].length, 2, 'deleted Ramen hidden');
  const t = C.sumTotals(p.entries.filter(e => e.date === '2026-01-05'));
  assert.equal(t.kcal, 530); assert.equal(t.protein_g, 28); assert.equal(t.count, 2);
  assert.ok(p.entries.some(e => e.deleted && e.item === 'Ramen'), 'still present in raw list');
});

test('findRowByEntryId returns the live sheet row, even after rows shift', () => {
  const v = sample(SHUFFLED);
  assert.equal(C.findRowByEntryId(v, '2026-01-06_1230_lunch_1_1'), 6);
  v.splice(1, 0, row(SHUFFLED, {entry_id:'inserted', date:'2026-01-04'}));
  assert.equal(C.findRowByEntryId(v, '2026-01-06_1230_lunch_1_1'), 7);
  assert.equal(C.findRowByEntryId(v, 'nope'), -1);
});

test('applyChanges only touches changed fields and keeps unknown columns', () => {
  const v = sample(SHUFFLED); const r = C.findRowByEntryId(v, '2026-01-05_0830_breakfast_1_1');
  const out = C.applyChanges(v[r-1], { kcal: 450, deleted: true, updated_by: 'me', updated_at: '2026-01-05 09:00', not_a_column: 'x' }, v[0]);
  const m = C.buildColMap(v[0]);
  assert.equal(out[m.kcal], 450); assert.equal(out[m.deleted], 'TRUE'); assert.equal(out[m.updated_by], 'me');
  assert.equal(out[m.extra_col], 'keep me'); assert.equal(out[m.item], 'Oats'); assert.equal(out.length, v[0].length);
});

test('entryToRow writes in header order; diffEntry finds real changes only', () => {
  const e = { entry_id:'x_1', date:'2026-01-08', time:'07:45', meal_type:'breakfast', item:'Toast', kcal:200, protein_g:null, deleted:false };
  const out = C.entryToRow(e, SHUFFLED); const m = C.buildColMap(SHUFFLED);
  assert.equal(out[m.item], 'Toast'); assert.equal(out[m.kcal], 200); assert.equal(out[m.protein_g], ''); assert.equal(out[m.deleted], ''); assert.equal(out[m.extra_col], '');
  const orig = C.parseFoodLog(sample(HEADER)).entries[0];
  assert.deepEqual(plain(C.diffEntry(orig, { ...orig })), {});
  assert.deepEqual(plain(C.diffEntry(orig, { ...orig, kcal: 410, meal_type: 'snack' })), { meal_type:'snack', kcal:410 });
});

test('targets: date-effective rows, min/max range, profile; generic fallback', () => {
  const tv = [['Effective from','kcal target','kcal min','kcal max','Protein g','Fat g (approx)','Fibre g','Sodium max mg','Notes'],
    ['2026-01-01',2200,2150,2250,120,70,30,2300,'a'], ['2026-02-01',1900,1850,1950,120,60,30,2300,'b'], [], ['Profile and plan notes'], ['Start weight','~80 kg'], ['Goal weight','74 kg by spring']];
  const t = C.parseTargets(tv);
  assert.equal(t.list.length, 2); assert.equal(t.profile.start_weight, 80); assert.equal(t.profile.goal_weight, 74);
  assert.equal(C.targetFor('2026-01-31', t.list).kcal, 2200);
  assert.equal(C.targetFor('2026-02-01', t.list).kcal, 1900);
  assert.equal(C.targetFor('2025-12-01', t.list).kcal, 2200, 'before first row uses first row');
  assert.equal(C.targetFor('2026-01-10', t.list).fat_g, 70);
  assert.ok(C.targetFor('2026-01-10', []). _default);
  assert.equal(C.kcalStatus(2200, t.list[0]), 'on'); assert.equal(C.kcalStatus(2000, t.list[0]), 'under'); assert.equal(C.kcalStatus(2400, t.list[0]), 'over'); assert.equal(C.kcalStatus(0, t.list[0]), 'none');
});

test('photo naming and entry ids follow the convention', () => {
  assert.equal(C.photoName('2026-01-05','08:30','breakfast',2), '2026-01-05_0830_breakfast_2.jpg');
  assert.equal(C.entryIdFor('2026-01-05_0830_breakfast_2.jpg', 3), '2026-01-05_0830_breakfast_2_3');
  const names = ['2026-01-05_0830_breakfast_1.jpg','2026-01-05_0830_breakfast_1_2','2026-01-05_0830_breakfast_3.jpg','2026-01-05_0830_lunch_7.jpg'];
  assert.equal(C.nextN(names, C.photoPrefix('2026-01-05','08:30','breakfast')), 4);
  assert.equal(C.nextN(['2026-01-05_0830_breakfast_k2_1'], '2026-01-05_0830_breakfast', 'k'), 3);
});

test('UK timestamps use Europe/London (BST in summer, GMT in winter)', () => {
  assert.equal(C.ukStamp(new Date('2026-07-01T11:05:00Z')), '2026-07-01 12:05');
  assert.equal(C.ukStamp(new Date('2026-01-01T23:30:00Z')), '2026-01-01 23:30');
  assert.equal(C.ukStamp(new Date('2026-03-29T00:59:00Z')), '2026-03-29 00:59');
});

test('date/time parsing handles serials and am/pm', () => {
  assert.equal(C.parseDate(46027), '2026-01-05'); // Sheets serial
  assert.equal(C.parseTime('7:05 pm'), '19:05'); assert.equal(C.parseTime(0.5), '12:00'); assert.equal(C.parseTime('08:30:00'), '08:30');
  assert.equal(C.weekStart('2026-01-08'), '2026-01-05'); assert.equal(C.addMonths('2026-12', 1), '2027-01');
});

test('monthly recap numbers', () => {
  const tv = [['Effective from','kcal target','kcal min','kcal max','Protein g'],['2026-01-01',500,450,550,25]];
  const p = C.parseFoodLog(sample(HEADER)); const t = C.parseTargets(tv).list;
  const rc = C.monthRecap(p.entries, t, '2026-01');
  assert.equal(rc.items, 3); assert.equal(rc.daysLogged, 2); assert.equal(rc.meals, 2, 'Oats + Latte share a photo = 1 meal');
  assert.equal(rc.daysOnTarget, 1, '530 kcal on 5 Jan is within 450–550');
  assert.equal(rc.bestProteinDay.date, '2026-01-06'); assert.equal(rc.avgKcal, (530+1050)/2);
});

test('isDiaryHidden matches the no-diary-photo tag, comma or space separated, any case', () => {
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'no-diary-photo' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'Rice, No-Diary-Photo' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'dinner', tags:'spicy no-diary-photo extra' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'foo,no-diary-photo,bar' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'no-diary-photos' }), false);
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'rice bowl' }), false);
  assert.equal(C.isDiaryHidden({ meal_type:'breakfast', tags:'' }), false);
  assert.equal(C.isDiaryHidden({ meal_type:'drink', tags:'coffee' }), false);
});

test('isDiaryHidden matches meal_type snack, any case', () => {
  assert.equal(C.isDiaryHidden({ meal_type:'snack', tags:'' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'Snack', tags:'fruit' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:' SNACK ' }), true);
  assert.equal(C.isDiaryHidden({ meal_type:'lunch', tags:'' }), false);
  assert.equal(C.isDiaryHidden({ meal_type:'breakfast' }), false);
});

test('token record: save, read, expiry skew, and clear', () => {
  const now = 1_700_000_000_000;
  const saved = C.saveToken({ access_token:'tok-1', expires_in:1800, scope:'sheets drive' }, now, 'user@example.com');
  assert.equal(saved.access_token, 'tok-1');
  assert.equal(saved.exp, now + 1800 * 1000);
  assert.equal(saved.scopes, 'sheets drive');
  assert.equal(saved.email, 'user@example.com');
  assert.equal(C.TOKEN_SKEW_MS, 2 * 60 * 1000);
  assert.equal(C.TOKEN_WARN_MS, 5 * 60 * 1000);
  const fallback = C.saveToken({ access_token:'tok-2', scopes:['a','b'] }, now, '  user@example.com  ');
  assert.equal(fallback.exp, now + 3600 * 1000, 'missing expires_in defaults to one hour');
  assert.equal(fallback.scopes, 'a b');
  assert.equal(fallback.email, 'user@example.com');

  assert.equal(C.readToken(saved, now), 'tok-1');
  assert.equal(C.readToken(saved, saved.exp - C.TOKEN_SKEW_MS - 1), 'tok-1', 'more than 2 minutes left');
  assert.equal(C.readToken(saved, saved.exp - C.TOKEN_SKEW_MS), null, 'exactly 2 minutes left is inside the skew');
  assert.equal(C.readToken(saved, saved.exp - 90 * 1000), null, '90 seconds left is not used');
  assert.equal(C.readToken(saved, saved.exp), null);
  assert.equal(C.readToken({ token:'legacy', exp: now + 10 * 60 * 1000 }, now), 'legacy');
  assert.equal(C.readToken(null, now), null);
  assert.equal(C.readToken({ access_token:'', exp: now + 999999 }, now), null);

  const soon = { access_token:'tok-1', exp: now + 4 * 60 * 1000, email:'user@example.com' };
  assert.equal(C.tokenWarning(soon, now), true);
  assert.equal(C.readToken(soon, now), 'tok-1', '4 minutes left is still used');
  const skew = { access_token:'tok-1', exp: now + 90 * 1000, email:'user@example.com' };
  assert.equal(C.tokenWarning(skew, now), true);
  assert.equal(C.readToken(skew, now), null, 'inside the 2 minute skew the banner can show but the token is not reused');
  assert.equal(C.tokenWarning({ access_token:'tok-1', exp: now + C.TOKEN_WARN_MS }, now), true);
  assert.equal(C.tokenWarning({ access_token:'tok-1', exp: now + C.TOKEN_WARN_MS + 1 }, now), false);
  assert.equal(C.tokenWarning({ access_token:'tok-1', exp: now }, now), false);

  assert.equal(C.clearToken(saved), null);
  const kept = C.clearToken(saved, true);
  assert.equal(kept.access_token, '');
  assert.equal(kept.exp, 0);
  assert.equal(kept.scopes, '');
  assert.equal(kept.email, 'user@example.com');
  assert.equal(C.readToken(kept, now), null);
  assert.equal(C.clearToken({ access_token:'tok-1', exp: saved.exp }, true), null, 'no email to keep');
});

test('totals still include diary-hidden rows', () => {
  const h = C.HEADER.slice();
  const rows = [h,
    row(h,{entry_id:'a', item:'Oats', date:'2026-01-05', time:'08:30', meal_type:'breakfast', kcal:400, protein_g:20}),
    row(h,{entry_id:'2026-11-24_1116_snack_k1_1', item:'Crackers', date:'2026-01-05', time:'11:16', meal_type:'snack', kcal:180, protein_g:3}),
    row(h,{entry_id:'c', item:'Secret lunch', date:'2026-01-05', time:'12:30', meal_type:'lunch', kcal:50, protein_g:2, tags:'no-diary-photo'}),
    row(h,{entry_id:'d', item:'Gone', date:'2026-01-05', time:'13:00', meal_type:'snack', kcal:999, protein_g:99, deleted:'TRUE'}),
  ];
  const p = C.parseFoodLog(rows);
  const live = p.entries.filter(e => !e.deleted);
  assert.equal(live.filter(C.isDiaryHidden).length, 2);
  assert.equal(live.filter(e => !C.isDiaryHidden(e)).map(e => e.item).join(), 'Oats');
  const t = C.sumTotals(p.entries);
  assert.equal(t.kcal, 630); assert.equal(t.protein_g, 25); assert.equal(t.count, 3);
  const by = C.groupByDate(p.entries);
  assert.equal(by['2026-01-05'].length, 3, 'hidden rows stay in the day group used for totals');
  assert.equal(C.sumTotals(by['2026-01-05']).kcal, 630);
  const rc = C.monthRecap(p.entries, [], '2026-01');
  assert.equal(rc.totals.kcal, 630); assert.equal(rc.avgKcal, 630); assert.equal(rc.items, 1); assert.equal(rc.photos, 0);
  const shown = C.monthRecap(p.entries, [], '2026-01', true);
  assert.equal(shown.totals.kcal, 630); assert.equal(shown.items, 3);
});
