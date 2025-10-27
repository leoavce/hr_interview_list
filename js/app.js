// public/js/app.js
import { DB } from "./db.js";
import { escapeHtml } from "./util.js";

(function () {
  const jobSearch = document.getElementById('job-search');
  const jobSelect = document.getElementById('job-position');
  const catSection = document.getElementById('category-section');
  const questionsSection = document.getElementById('questions-section');
  const questionsList = document.getElementById('questions-list');

  let jobs = [];
  let selectedJobId = null;
  let selectedCat = null;

  const CAT_META = {
    a: { icon: 'code', title: 'Technical' },
    b: { icon: 'groups', title: 'Behavioral' },
    c: { icon: 'design_services', title: 'Situational' },
    d: { icon: 'psychology_alt', title: 'Brain Teasers' },
  };

  async function bootstrap() {
    await DB.openOrCreate();
    await DB.ensureAtLeastOneJob();
    await loadJobs();
    bindEvents();
  }

  function bindEvents() {
    jobSearch.addEventListener('input', filterJobs);
    jobSelect.addEventListener('change', onJobChange);
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        selectedCat = btn.dataset.cat;
        await renderQuestions();
      });
    });
  }

  async function loadJobs() {
    jobs = await DB.listJobs();
    renderJobSelect(jobs);
  }

  function renderJobSelect(list) {
    const selected = jobSelect.value;
    jobSelect.innerHTML = `<option disabled ${selected ? '' : 'selected'}>직무를 선택하세요...</option>` +
      list.map(j => `<option value="${j.id}">${escapeHtml(j.name)}</option>`).join('');
  }

  function filterJobs() {
    const q = jobSearch.value.trim().toLowerCase();
    const filtered = q ? jobs.filter(j => j.name.toLowerCase().includes(q)) : jobs;
    renderJobSelect(filtered);
  }

  function onJobChange() {
    selectedJobId = jobSelect.value;
    selectedCat = null;
    questionsSection.classList.add('hidden');
    catSection.classList.remove('hidden');
  }

  async function renderQuestions() {
    if (!selectedJobId || !selectedCat) return;
    const rows = await DB.listQuestions(selectedJobId, selectedCat, true);
    questionsList.innerHTML = rows.map(r => card(r)).join('') || emptyCard();
    questionsSection.classList.remove('hidden');
  }

  function card(r) {
    const updated = r.updatedAt?.toDate ? r.updatedAt.toDate().toISOString() : '';
    return `
      <div class="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-start gap-4">
          <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#137fec]">
            <span class="material-symbols-outlined text-2xl">help_outline</span>
          </div>
          <div>
            <h4 class="text-lg font-semibold text-slate-800">${escapeHtml(CAT_META[selectedCat].title)}</h4>
            <p class="mt-1 text-slate-600">${escapeHtml(r.content)}</p>
            <p class="mt-2 text-xs text-slate-400">마지막 수정: ${escapeHtml(updated)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function emptyCard() {
    return `
      <div class="rounded-md border border-dashed border-slate-300 bg-white p-6 text-slate-500">
        해당 분류의 질문이 없습니다.
      </div>
    `;
  }

  bootstrap();
})();
