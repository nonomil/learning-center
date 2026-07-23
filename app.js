const app = document.querySelector('#app');
const profileLabel = document.querySelector('[data-profile-label]');
const footerLinks = document.querySelector('[data-footer-links]');
const launchParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const launchId = String(launchParams.get('petbankLaunch') || '').trim();
const profileRef = normalizeId(launchParams.get('petbankProfile') || 'default');
const hostOrigin = readReferrerOrigin();
const PROGRESS_KEY = `learncenter_progress_v1_${profileRef}`;
const state = {
  manifest: null,
  view: 'dashboard',
  packId: '',
  moduleId: '',
  lessonId: '',
  dataCache: new Map(),
  progress: readProgress(),
  notice: '',
  noticeKind: 'info'
};

function normalizeId(value) {
  return String(value || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
}

function readReferrerOrigin() {
  try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; }
}

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.warn('[learning-center] progress read failed:', error);
    return {};
  }
}

function writeProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    return true;
  } catch (error) {
    console.warn('[learning-center] progress write failed:', error);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function activeLink(key) {
  const link = state.manifest?.links?.[key];
  if (!link) return '';
  const local = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  return String(local ? link.devUrl || link.url : link.url || '');
}

function linkMarkup(key, label = state.manifest?.links?.[key]?.title || '打开项目') {
  const url = activeLink(key);
  return url
    ? `<a class="button button-quiet" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
    : `<span class="button button-quiet pending-link" aria-disabled="true">${escapeHtml(label)}（发布地址待确认）</span>`;
}

function packById(packId) { return state.manifest?.packs?.find((pack) => pack.id === packId) || null; }
function moduleById(pack, moduleId) { return pack?.modules?.find((module) => module.id === moduleId) || null; }
function progressKey(packId, moduleId, lessonId) { return `${packId}:${moduleId}:${lessonId}`; }
function isComplete(packId, moduleId, lessonId) { return Boolean(state.progress[progressKey(packId, moduleId, lessonId)]); }

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} request failed: ${response.status}`);
  return response.json();
}

async function moduleData(module) {
  if (!module?.data) return null;
  if (!state.dataCache.has(module.data)) state.dataCache.set(module.data, loadJson(module.data));
  return state.dataCache.get(module.data);
}

function lessonsOf(data) {
  if (Array.isArray(data?.lessons)) return data.lessons;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function lessonIdOf(lesson, index) { return String(lesson?.id || `item-${index + 1}`); }

function moduleProgress(pack, module, data) {
  const lessons = lessonsOf(data);
  const completed = lessons.filter((lesson, index) => isComplete(pack.id, module.id, lessonIdOf(lesson, index))).length;
  return { completed, total: lessons.length, percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0 };
}

async function packProgress(pack) {
  const entries = await Promise.all(pack.modules.map(async (module) => ({ module, data: await moduleData(module) })));
  return entries.reduce((result, entry) => {
    const progress = moduleProgress(pack, entry.module, entry.data);
    result.total += progress.total;
    result.completed += progress.completed;
    return result;
  }, { total: 0, completed: 0 });
}

function showNotice(text, kind = 'info') {
  state.notice = text;
  state.noticeKind = kind;
}

function noticeMarkup() {
  return state.notice ? `<div class="notice${state.noticeKind === 'error' ? ' is-error' : ''}" role="status">${escapeHtml(state.notice)}</div>` : '';
}

function renderHeader(title, subtitle = '') {
  return `<div class="section-heading"><div><p class="eyebrow">LEARNING CENTER</p><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></div>`;
}

async function renderDashboard() {
  const packResults = await Promise.all(state.manifest.packs.map(async (pack) => ({ pack, progress: await packProgress(pack) })));
  const total = packResults.reduce((sum, item) => sum + item.progress.total, 0);
  const completed = packResults.reduce((sum, item) => sum + item.progress.completed, 0);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return `
    <section class="hero">
      <div><p class="eyebrow">从幼小衔接到小学</p><h1>${escapeHtml(state.manifest.title)}</h1><p>${escapeHtml(state.manifest.subtitle)}</p></div>
      <aside class="hero-aside"><strong>${percent}%</strong><span>当前学习中心完成度 · ${completed}/${total} 个学习单元</span></aside>
    </section>
    ${noticeMarkup()}
    <div class="toolbar"><span class="card-kicker">独立项目 · 本地学习进度</span><div class="toolbar-actions"><button class="button" type="button" data-action="plan">查看学习计划</button><button class="button" type="button" data-action="print">打印今日学习单</button></div></div>
    <section class="stats" aria-label="学习统计">
      <div class="stat"><small>学习单元</small><strong>${total}</strong></div>
      <div class="stat"><small>已完成</small><strong>${completed}</strong></div>
      <div class="stat"><small>本机档案</small><strong>独立</strong></div>
      <div class="stat"><small>数据归属</small><strong>本项目</strong></div>
    </section>
    ${renderHeader('选择学习方向', '内容独立维护，学习记录保存在本项目。')}
    <section class="pack-grid" aria-label="学习资料包">${packResults.map(({ pack, progress }) => `
      <article class="pack-card"><div class="card-kicker">${escapeHtml(pack.emoji || '📚')} ${escapeHtml(pack.audience)}</div><h3>${escapeHtml(pack.title)}</h3><p>${escapeHtml(pack.summary)}</p><div class="card-tags">${pack.modules.slice(0, 4).map((module) => `<span class="tag">${escapeHtml(module.title)}</span>`).join('')}</div><div class="progress-line"><span class="progress-track"><i style="width:${progress.total ? Math.round(progress.completed / progress.total * 100) : 0}%"></i></span><span>${progress.completed}/${progress.total}</span></div><div class="card-footer"><button class="button button-primary" type="button" data-action="pack" data-pack-id="${escapeHtml(pack.id)}">进入资料包</button></div></article>
    `).join('')}</section>
    ${renderHeader('项目之间互相打开', '每个项目都有自己的网址和本地进度。')}
    <div class="toolbar-actions">${linkMarkup('petbank', '返回宠物积分总站')}${linkMarkup('picturebooks')}${linkMarkup('wordQuest')}${linkMarkup('miniGames')}</div>
  `;
}

async function renderPack() {
  const pack = packById(state.packId);
  if (!pack) return renderDashboard();
  const entries = await Promise.all(pack.modules.map(async (module) => ({ module, data: await moduleData(module) })));
  return `<div class="back-row"><button class="button button-quiet" type="button" data-action="dashboard">← 返回学习中心</button></div>${noticeMarkup()}${renderHeader(pack.title, pack.summary)}<section class="module-grid">${entries.map(({ module, data }) => { const progress = moduleProgress(pack, module, data); return `<article class="module-card"><div class="card-kicker">${escapeHtml(module.emoji || '📘')} ${escapeHtml(module.type || '学习')}</div><h3>${escapeHtml(module.title)}</h3><p>${escapeHtml(data?.summary || data?.description || '打开这一模块，按自己的节奏完成一小节。')}</p><div class="progress-line"><span class="progress-track"><i style="width:${progress.percent}%"></i></span><span>${progress.completed}/${progress.total}</span></div><div class="card-footer">${module.type === 'external' ? linkMarkup(module.project, '打开单词远征') : `<button class="button button-primary" type="button" data-action="module" data-pack-id="${escapeHtml(pack.id)}" data-module-id="${escapeHtml(module.id)}">开始这一模块</button>`}</div></article>`; }).join('')}</section>`;
}

function lessonSummary(lesson, index, pack, module) {
  const id = lessonIdOf(lesson, index);
  return `<button type="button" class="${id === state.lessonId ? 'is-active' : ''}" data-action="lesson" data-lesson-id="${escapeHtml(id)}"><strong>${escapeHtml(lesson.title || `第 ${index + 1} 节`)}</strong><small>${isComplete(pack.id, module.id, id) ? '已完成' : escapeHtml(lesson.duration || lesson.estimatedMinutes ? `${lesson.duration || lesson.estimatedMinutes + ' 分钟'}` : '待学习')}</small></button>`;
}

function renderResources(resources = []) {
  if (!Array.isArray(resources) || !resources.length) return '';
  return `<div class="resource-grid">${resources.map((resource) => `<article class="resource-card"><div class="card-kicker">${escapeHtml(resource.sourceType || '学习入口')}</div><h3>${escapeHtml(resource.title || '打开资源')}</h3><p>${escapeHtml(resource.description || resource.actionHint || '')}</p><div class="resource-url">${escapeHtml(resource.url || '')}</div>${resource.url ? `<div class="card-footer"><a class="button button-primary" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener">打开新页面</a></div>` : ''}</article>`).join('')}</div>`;
}

function renderLessonContent(lesson, module) {
  if (!lesson) return '<div class="empty-state">请选择左侧的一节学习内容。</div>';
  const words = Array.isArray(lesson.words) ? `<div class="card-tags">${lesson.words.map((word) => `<span class="tag">${escapeHtml(typeof word === 'string' ? word : word.word || word.char || '')}</span>`).join('')}</div>` : '';
  const chars = Array.isArray(lesson.characters) ? `<div class="card-tags">${lesson.characters.map((char) => `<span class="tag">${escapeHtml(typeof char === 'string' ? char : char.char || char.word || '')}</span>`).join('')}</div>` : '';
  const content = lesson.content || lesson.prompt || lesson.description || lesson.focus || '这一节已经准备好，和孩子一起完成即可。';
  const pinyin = lesson.pinyinContent || lesson.pinyin || '';
  const checklist = Array.isArray(lesson.checklist) ? `<h3>完成前检查</h3><ul class="checklist">${lesson.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  const resources = renderResources(lesson.resources);
  const completed = isComplete(state.packId, module.id, state.lessonId);
  return `<p class="eyebrow">${escapeHtml(module.title)}</p><h2>${escapeHtml(lesson.title || '今日学习')}</h2><p class="muted">${escapeHtml(lesson.focus || lesson.completionNote || '')}</p>${words}${chars}<div class="lesson-content">${escapeHtml(content)}</div>${pinyin ? `<p class="pinyin">${escapeHtml(pinyin)}</p>` : ''}${resources}${checklist}<div class="toolbar"><span class="card-kicker">${completed ? '已记录完成' : '完成后留下记录'}</span><button class="button button-primary" type="button" data-action="complete" data-pack-id="${escapeHtml(state.packId)}" data-module-id="${escapeHtml(module.id)}" data-lesson-id="${escapeHtml(state.lessonId)}">${completed ? '再次确认完成' : '完成这一节'}</button></div>`;
}

async function renderModule() {
  const pack = packById(state.packId);
  const module = moduleById(pack, state.moduleId);
  if (!pack || !module) return renderPack();
  const data = await moduleData(module);
  const lessons = lessonsOf(data);
  if (!state.lessonId && lessons.length) state.lessonId = lessonIdOf(lessons[0], 0);
  const lessonIndex = lessons.findIndex((lesson, index) => lessonIdOf(lesson, index) === state.lessonId);
  const lesson = lessonIndex >= 0 ? lessons[lessonIndex] : null;
  return `<div class="back-row"><button class="button button-quiet" type="button" data-action="pack" data-pack-id="${escapeHtml(pack.id)}">← 返回${escapeHtml(pack.title)}</button></div>${noticeMarkup()}<section class="detail-layout"><aside class="side-panel"><h2>${escapeHtml(module.title)}</h2><div class="side-list">${lessons.map((item, index) => lessonSummary(item, index, pack, module)).join('')}</div></aside><article class="detail-panel">${renderLessonContent(lesson, module)}</article></section>`;
}

async function renderPlan() {
  const packs = state.manifest.packs;
  const plans = await Promise.all(packs.map(async (pack) => ({ pack, plan: pack.plan ? await loadJson(pack.plan) : null })));
  return `<div class="back-row"><button class="button button-quiet" type="button" data-action="dashboard">← 返回学习中心</button></div>${noticeMarkup()}${renderHeader('学习计划', '把每天的小任务拆开，按自己的节奏继续。')}<section class="week-grid">${plans.map(({ pack, plan }) => `<article class="week-card"><div class="card-kicker">${escapeHtml(pack.emoji || '📅')} ${escapeHtml(pack.title)}</div><h3>${escapeHtml(plan?.title || pack.title)}</h3><p>${escapeHtml(plan?.summary || plan?.description || '每天完成一小节即可。')}</p>${Array.isArray(plan?.dailyRoutine) ? `<ul>${plan.dailyRoutine.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}${Array.isArray(plan?.weeks) ? `<small>${plan.weeks.length} 周计划可展开到具体模块</small>` : ''}<div class="card-footer"><button class="button button-primary" type="button" data-action="pack" data-pack-id="${escapeHtml(pack.id)}">查看资料包</button></div></article>`).join('')}</section>`;
}

async function renderPrint() {
  const pack = packById('summer-chinese-bridge-2026') || state.manifest.packs[0];
  const module = pack?.modules?.[0];
  const data = await moduleData(module);
  const lessons = lessonsOf(data).slice(0, 7);
  return `<div class="back-row"><button class="button button-quiet" type="button" data-action="dashboard">← 返回学习中心</button></div><section class="print-sheet"><p class="eyebrow">LEARNING CENTER · PRINT</p><h1>一周学习单</h1><p>学习方向：${escapeHtml(pack?.title || '学习中心')}　档案：本机独立保存</p><div class="print-row">${lessons.map((lesson, index) => `<div class="print-box"><strong>第 ${index + 1} 天 · ${escapeHtml(lesson.title || '')}</strong><small>□ 已朗读　□ 已复习　□ 想再读一次</small></div>`).join('')}</div><p>家长记录：________________________________________________________</p><p>孩子今天最喜欢：__________________________________________________</p><button class="button button-primary" type="button" data-action="print-now">打印这张学习单</button></section>`;
}

async function render() {
  if (!state.manifest) return;
  try {
    const markup = state.view === 'dashboard' ? await renderDashboard() : state.view === 'pack' ? await renderPack() : state.view === 'module' ? await renderModule() : state.view === 'plan' ? await renderPlan() : await renderPrint();
    app.innerHTML = markup;
  } catch (error) {
    console.warn('[learning-center] render failed:', error);
    app.innerHTML = `<div class="empty-state"><strong>学习中心暂时无法打开</strong><p>${escapeHtml(error.message)}</p><button class="button" type="button" data-action="dashboard">重新打开</button></div>`;
  }
}

function sendCompletion(packId, moduleId, lessonId) {
  if (!launchId || profileRef === 'default' || !window.opener || !hostOrigin) return false;
  const completionId = `lesson:${profileRef}:${packId}:${moduleId}:${lessonId}`;
  try {
    window.opener.postMessage({ type: 'petbank.bridge.v1.completed', version: 1, launchId, profileRef, projectId: 'learning-center', activityId: `${packId}:${moduleId}`, completionId, occurredAt: new Date().toISOString() }, hostOrigin);
    return true;
  } catch (error) {
    console.warn('[learning-center] completion send failed:', error);
    return false;
  }
}

function completeLesson(packId, moduleId, lessonId) {
  const key = progressKey(packId, moduleId, lessonId);
  state.progress[key] = { completedAt: new Date().toISOString(), profileRef };
  if (!writeProgress()) {
    showNotice('本地进度保存失败，请检查浏览器存储后重试。', 'error');
    return;
  }
  const sent = sendCompletion(packId, moduleId, lessonId);
  showNotice(sent ? '本节已保存，主站奖励正在处理。' : '本节已保存在独立学习中心。');
}

function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'dashboard') { state.view = 'dashboard'; state.notice = ''; return void render(); }
  if (action === 'plan') { state.view = 'plan'; return void render(); }
  if (action === 'print') { state.view = 'print'; return void render(); }
  if (action === 'print-now') return window.print();
  if (action === 'pack') { state.packId = target.dataset.packId || ''; state.view = 'pack'; state.notice = ''; return void render(); }
  if (action === 'module') { state.packId = target.dataset.packId || ''; state.moduleId = target.dataset.moduleId || ''; state.lessonId = ''; state.view = 'module'; state.notice = ''; return void render(); }
  if (action === 'lesson') { state.lessonId = target.dataset.lessonId || ''; return void render(); }
  if (action === 'complete') { completeLesson(target.dataset.packId, target.dataset.moduleId, target.dataset.lessonId); return void render(); }
}

function initFooter() {
  footerLinks.innerHTML = ['petbank', 'picturebooks', 'wordQuest', 'miniGames'].map((key) => {
    const link = state.manifest.links[key];
    const url = activeLink(key);
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(link.title)}</a>` : `<span class="pending-link">${escapeHtml(link.title)}待发布</span>`;
  }).join('');
}

window.addEventListener('message', (event) => {
  if (!hostOrigin || event.origin !== hostOrigin) return;
  const data = event.data || {};
  if (data.type !== 'petbank.bridge.v1.reward-result' || data.launchId !== launchId || data.profileRef !== profileRef || data.projectId !== 'learning-center') return;
  showNotice(data.status === 'accepted' ? '主站奖励已到账。' : data.status === 'duplicate' ? '主站已经处理过这次奖励。' : '主站暂未接受奖励，请稍后重试。', data.status === 'rejected' ? 'error' : 'info');
  void render();
});

app.addEventListener('click', handleClick);
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => {
  const view = link.dataset.nav;
  state.view = view === 'plan' ? 'plan' : 'dashboard';
  void render();
}));

try {
  state.manifest = await loadJson('data/manifest.json');
  profileLabel.textContent = launchId ? '主站启动 · 独立进度' : '独立学习空间';
  initFooter();
  await render();
} catch (error) {
  console.warn('[learning-center] boot failed:', error);
  app.innerHTML = '<div class="empty-state">学习中心数据加载失败，请使用本地静态服务打开。</div>';
}
