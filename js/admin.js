// public/js/admin.js
import { DB } from "./db.js";
import { Excel } from "./excel.js";
import { escapeHtml } from "./util.js";

(function () {
  const jobSelect = document.getElementById('job-select');
  const catSelect = document.getElementById('cat-select');
  const refreshBtn = document.getElementById('refresh-list');
  const saveBtn = document.getElementById('save-db');

  const questionInput = document.getElementById('question-input');
  const addBtn = document.getElementById('add-question');
  const updateBtn = document.getElementById('update-question');
  const cancelBtn = document.getElementById('cancel-edit');

  const jobsList = document.getElementById('jobs-list');
  const newJobName = document.getElementById('new-job-name');
  const addJobBtn = document.getElementById('add-job');

  const excelFile = document.getElementById('excel-file');
  const importBtn = document.getElementById('import-excel');
  const updateDuplicates = document.getElementById('update-duplicates');

  const tableWrap = document.getElementById('questions-table');
  let editTargetId = null;

  async function bootstrap() {
    await DB.openOrCreate();
    await DB.ensureAtLeastOneJob();
    bindEvents();
    await renderJobsList();
    await renderQuestions();
  }

  function bindEvents() {
    jobSelect.addEventListener('change', renderQuestions);
    catSelect.addEventListener('change', renderQuestions);
    refreshBtn.addEventListener('click', renderQuestions);

    addBtn.addEventListener('click', addQuestion);
    updateBtn.addEventListener('click', updateQuestion);
    cancelBtn.addEventListener('click', cancelEdit);

    addJobBtn.addEventListener('click', addJob);

    importBtn.addEventListener('click', handleImportClick);
    saveBtn.addEventListener('click', () => alert('Firestore는 자동 저장됩니다.'));
  }

  async function loadJobsToSelect() {
    const rows = await DB.listJobs();
    jobSelect.innerHTML = rows.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  }

  async function renderJobsList() {
    const rows = await DB.listJobs();
    jobsList.innerHTML = rows.map(r => `
      <li class="flex items-center justify-between py-2">
        <span class="text-slate-700">${escapeHtml(r.name)}</span>
        <div class="flex items-center gap-1">
          <button class="text-xs rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200" data-act="rename" data-id="${r.id}">이름 변경</button>
          <button class="text-xs rounded-md bg-rose-500 text-white px-2 py-1 hover:bg-rose-600" data-act="del" data-id="${r.id}">삭제</button>
        </div>
      </li>
    `).join('');

    jobsList.querySelectorAll('button').forEach(btn => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', async () => {
        if (act === 'rename') await renameJob(id);
        else if (act === 'del') await deleteJob(id);
      });
    });
  }

  async function renderQuestions() {
    const jobId = jobSelect.value;
    const cat = catSelect.value;
    if (!jobId || !cat) return;

    const rows = await DB.listQuestions(jobId, cat, false);
    const table = `
      <table class="w-full">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-3 py-2 text-left text-slate-600 text-sm">ID</th>
            <th class="px-3 py-2 text-left text-slate-600 text-sm">질문</th>
            <th class="px-3 py-2 text-left text-slate-600 text-sm">상태</th>
            <th class="px-3 py-2 text-left text-slate-600 text-sm w-40">작업</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr class="border-t border-slate-200">
              <td class="px-3 py-2 text-slate-500 text-sm">${escapeHtml(r.id)}</td>
              <td class="px-3 py-2 text-slate-800 text-sm">${escapeHtml(r.content)}</td>
              <td class="px-3 py-2 text-slate-500 text-sm">${r.active ? '활성' : '비활성'}</td>
              <td class="px-3 py-2">
                <div class="flex gap-1">
                  <button class="text-xs rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200" data-act="edit" data-id="${r.id}">편집</button>
                  <button class="text-xs rounded-md bg-amber-500 text-white px-2 py-1 hover:bg-amber-600" data-act="toggle" data-id="${r.id}">${r.active ? '비활성' : '활성'}</button>
                  <button class="text-xs rounded-md bg-rose-500 text-white px-2 py-1 hover:bg-rose-600" data-act="del" data-id="${r.id}">삭제</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    tableWrap.innerHTML = table;

    tableWrap.querySelectorAll('button').forEach(btn => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      btn.addEventListener('click', async () => {
        if (act === 'edit') await startEdit(id);
        else if (act === 'toggle') await toggleActive(id);
        else if (act === 'del') await deleteQuestion(id);
      });
    });

    cancelEdit();
  }

  async function addQuestion() {
    const jobId = jobSelect.value;
    const cat = catSelect.value;
    const content = questionInput.value.trim();
    if (!content) return alert('질문을 입력하세요.');

    await DB.addQuestion({ jobId, categoryCode: cat, content, active: true });
    questionInput.value = '';
    await renderQuestions();
  }

  async function startEdit(id) {
    const rows = await DB.listQuestions(jobSelect.value, catSelect.value, false);
    const row = rows.find(r => r.id === id);
    if (!row) return;

    editTargetId = id;
    questionInput.value = row.content;
    addBtn.disabled = true;
    updateBtn.disabled = false;
    cancelBtn.disabled = false;
  }

  function cancelEdit() {
    editTargetId = null;
    questionInput.value = '';
    addBtn.disabled = false;
    updateBtn.disabled = true;
    cancelBtn.disabled = true;
  }

  async function updateQuestion() {
    if (!editTargetId) return;
    const content = questionInput.value.trim();
    if (!content) return alert('질문을 입력하세요.');

    await DB.updateQuestion(editTargetId, { content });
    cancelEdit();
    await renderQuestions();
  }

  async function toggleActive(id) {
    const rows = await DB.listQuestions(jobSelect.value, catSelect.value, false);
    const row = rows.find(r => r.id === id);
    if (!row) return;

    await DB.updateQuestion(id, { active: !row.active });
    await renderQuestions();
  }

  async function deleteQuestion(id) {
    if (!confirm('정말 삭제할까요?')) return;
    await DB.deleteQuestion(id);
    await renderQuestions();
  }

  async function addJob() {
    const name = newJobName.value.trim();
    if (!name) return;
    try {
      await DB.addJob(name);
      newJobName.value = '';
      await loadJobsToSelect();
      await renderJobsList();
    } catch (e) {
      alert('직무 추가 실패(중복 여부 확인): ' + e.message);
    }
  }

  async function renameJob(id) {
    const rows = await DB.listJobs();
    const current = rows.find(r => r.id === id)?.name || '';
    const name = prompt('새 이름을 입력하세요', current);
    if (!name) return;
    try {
      await DB.renameJob(id, name.trim());
      await loadJobsToSelect();
      await renderJobsList();
      await renderQuestions();
    } catch (e) {
      alert('이름 변경 실패: ' + e.message);
    }
  }

  async function deleteJob(id) {
    if (!confirm('해당 직무를 삭제하면 관련 질문도 함께 삭제됩니다. 계속할까요?')) return;
    await DB.deleteJobCascade(id);
    await loadJobsToSelect();
    await renderJobsList();
    await renderQuestions();
  }

  async function handleImportClick() {
    if (!excelFile.files.length) {
      alert('엑셀 파일을 먼저 선택하세요.');
      return;
    }
    try {
      const rows = await Excel.readExcel(excelFile.files[0]);
      const updateDup = !!updateDuplicates.checked;
      const result = await DB.importRows(rows, { updateDup });
      alert(`가져오기 완료:
추가 ${result.inserted}건, 업데이트 ${result.updated}건, 비활성 ${result.deactivated}건`);
      await renderJobsList();
      await loadJobsToSelect();
      await renderQuestions();
    } catch (e) {
      console.error(e);
      alert('엑셀 처리 실패: ' + e.message);
    }
  }

  bootstrap();
})();
