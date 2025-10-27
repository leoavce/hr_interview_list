// public/js/firebase-init.js
// Firebase v11 ESM CDN 기반 초기화 (GitHub Pages 정적 호스팅 대응)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// === 프로젝트 설정 (사용자 제공 값) ===
const firebaseConfig = {
  apiKey: "AIzaSyAtXte_VEjW7h2sqDmHHyRZgR-M426GDLs",
  authDomain: "interview-assist-25d8b.firebaseapp.com",
  projectId: "interview-assist-25d8b",
  storageBucket: "interview-assist-25d8b.firebasestorage.app",
  messagingSenderId: "26146666279",
  appId: "1:26146666279:web:00976d7034a14569e05b02",
  measurementId: "G-7G7FSCHVN8"
};

export const app = initializeApp(firebaseConfig);

// Analytics는 브라우저 환경/권한에 따라 자동 비활성화될 수 있음
try { getAnalytics(app); } catch(_) {}

export const db = getFirestore(app);

/*
────────────────────────────────────────────────────────
[선택] Firestore Security Rules 샘플 (관리용 쓰기 토큰)
- GitHub Pages(무계정)에서 외부 쓰기 남용 방지
- 콘솔에서 'config/security' 문서에 { writeToken: "<랜덤문자열>" } 저장
- 관리자는 edit.html 첫 접속 시 해당 토큰 입력 → LocalStorage 저장
- 클라이언트는 쓰기할 때마다 `_writeToken` 필드를 함께 전송
- Rules에서 해당 토큰과 비교하여 허용/차단

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isFromAllowedOrigin() {
      // (선택) GitHub Pages 도메인 화이트리스트
      return request.time != null
        && request.headers['Origin'] in [
          'https://<your-github-username>.github.io'
        ];
    }

    match /config/security {
      allow read: if true;        // 토큰은 읽기 허용(필요시 false로 하고 콘솔에서만 조회)
      allow write: if false;      // 운영 중 직접 수정은 콘솔에서
    }

    match /jobs/{docId} {
      allow read: if true;
      allow write: if
        isFromAllowedOrigin()
        && request.resource.data._writeToken == get(/databases/$(database)/documents/config/security).data.writeToken;
    }

    match /questions/{docId} {
      allow read: if true;
      allow write: if
        isFromAllowedOrigin()
        && request.resource.data._writeToken == get(/databases/$(database)/documents/config/security).data.writeToken;
    }
  }
}
────────────────────────────────────────────────────────
*/
