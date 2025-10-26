// public/js/util.js
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// (선택) 관리용 쓰기 토큰 - LocalStorage에 저장/조회
export function getWriteTokenInteractive() {
  let token = localStorage.getItem('interview_write_token');
  if (!token) {
    token = prompt('관리자 쓰기 토큰을 입력하세요.\n(콘솔의 config/security.writeToken 값)');
    if (token) localStorage.setItem('interview_write_token', token);
  }
  return token || '';
}

// 중복 키(질문) 생성을 위한 정규화
export function makeDedupKey(jobId, categoryCode, content) {
  const norm = (content || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${jobId}|${categoryCode}|${norm}`;
}
