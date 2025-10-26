// public/js/excel.js
// SheetJS(xlsx) 기반 엑셀 파서
// 반환 형식: [{ job, category, question, active }, ...]

export const Excel = (function () {
  async function readExcel(file) {
    const arrBuf = await file.arrayBuffer();
    const wb = XLSX.read(arrBuf, { type: 'array' });

    const wsName = wb.SheetNames[0];
    if (!wsName) throw new Error('시트를 찾을 수 없습니다.');
    const ws = wb.Sheets[wsName];

    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows.map(row => normalizeRow(row));
  }

  function normalizeRow(row) {
    const map = {};
    Object.keys(row).forEach(k => {
      map[k.trim().toLowerCase()] = row[k];
    });
    return {
      job: map.job ?? map['직무'] ?? '',
      category: map.category ?? map['카테고리'] ?? '',
      question: map.question ?? map['질문'] ?? '',
      active: map.active ?? map['active(1|0)'] ?? map['활성'] ?? 1
    };
  }

  return { readExcel };
})();
