// public/js/db.js
// Firestore 기반 DB 헬퍼 — 기존 SQLite 함수와 유사한 역할을 수행
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { makeDedupKey } from "./util.js";

const COL_JOBS = 'jobs';
const COL_QUESTIONS = 'questions';

export const DB = {
  // seed 또는 보조 로직 없이 즉시 사용 가능
  async openOrCreate() { /* noop for Firestore */ },

  // ===== Jobs =====
  async ensureAtLeastOneJob() {
    const snap = await getDocs(query(collection(db, COL_JOBS), orderBy('name')));
    if (!snap.empty) return;
    await addDoc(collection(db, COL_JOBS), {
      name: 'Backend Developer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      _writeToken: '' // rules 충족용 필드 자리, 쓰기 시 덮어씀
    });
  },

  async listJobs() {
    const snap = await getDocs(query(collection(db, COL_JOBS), orderBy('name')));
    return snap.docs.map(d => ({ id: d.id, ...(d.data()) }));
  },

  async addJob(name, writeToken='') {
    const ref = await addDoc(collection(db, COL_JOBS), {
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      _writeToken: writeToken
    });
    return ref.id;
  },

  async renameJob(id, name, writeToken='') {
    await updateDoc(doc(db, COL_JOBS, id), {
      name,
      updatedAt: serverTimestamp(),
      _writeToken: writeToken
    });
  },

  async deleteJobCascade(id, writeToken='') {
    // Firestore는 트랜잭션/배치로 하위 문서 삭제 필요
    const batch = writeBatch(db);
    // 관련 질문 삭제
    const qSnap = await getDocs(query(
      collection(db, COL_QUESTIONS),
      where('jobId', '==', id)
    ));
    qSnap.forEach(d => batch.delete(doc(db, COL_QUESTIONS, d.id)));
    // 직무 삭제
    batch.delete(doc(db, COL_JOBS, id));
    await batch.commit();
  },

  // ===== Questions =====
  async listQuestions(jobId, cat, onlyActive=false) {
    const conditions = [
      where('jobId','==', jobId),
      where('categoryCode','==', cat),
    ];
    if (onlyActive) conditions.push(where('active','==', true));
    const qSnap = await getDocs(query(
      collection(db, COL_QUESTIONS),
      ...conditions,
      orderBy('createdAt', 'desc')
    ));
    return qSnap.docs.map(d => ({ id: d.id, ...(d.data()) }));
  },

  async addQuestion({ jobId, categoryCode, content, active=true }, writeToken='') {
    const ref = await addDoc(collection(db, COL_QUESTIONS), {
      jobId, categoryCode, content, active,
      dedupKey: makeDedupKey(jobId, categoryCode, content),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      _writeToken: writeToken
    });
    return ref.id;
  },

  async updateQuestion(id, patch, writeToken='') {
    await updateDoc(doc(db, COL_QUESTIONS, id), {
      ...patch,
      updatedAt: serverTimestamp(),
      _writeToken: writeToken
    });
  },

  async deleteQuestion(id) {
    await deleteDoc(doc(db, COL_QUESTIONS, id));
  },

  async getQuestionByDedup(jobId, cat, content) {
    const key = makeDedupKey(jobId, cat, content);
    const snap = await getDocs(query(
      collection(db, COL_QUESTIONS), where('dedupKey','==', key)
    ));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data()) };
  },

  async importRows(rows, { updateDup=false, writeToken='' } = {}) {
    let inserted = 0, updated = 0, deactivated = 0;

    // job name → id 캐시
    const jobIdCache = new Map();
    const ensureJobId = async (name) => {
      if (jobIdCache.has(name)) return jobIdCache.get(name);
      // 존재 확인
      const js = await getDocs(query(collection(db, COL_JOBS), where('name','==', name)));
      let id = null;
      if (js.empty) {
        const newId = await DB.addJob(name, writeToken);
        id = newId;
      } else {
        id = js.docs[0].id;
      }
      jobIdCache.set(name, id);
      return id;
    };

    // 배치로 묶되, Firestore 제한(500 op) 고려하여 분할 커밋
    let batch = writeBatch(db);
    let ops = 0;
    const commitIfNeeded = async () => {
      if (ops >= 450) { // 여유 버퍼
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    };

    for (const r of rows) {
      const job = (r.job || '').trim();
      const cat = (r.category || '').trim().toLowerCase();
      const content = (r.question || '').trim();
      const active = String(r.active ?? '1').trim() === '1';

      if (!job || !content || !['a','b','c','d'].includes(cat)) continue;

      const jobId = await ensureJobId(job);
      const key = makeDedupKey(jobId, cat, content);
      const dupSnap = await getDocs(query(collection(db, COL_QUESTIONS), where('dedupKey','==', key)));

      if (!dupSnap.empty) {
        if (updateDup) {
          const d = dupSnap.docs[0];
          const wasActive = !!d.data().active;
          batch.update(doc(db, COL_QUESTIONS, d.id), {
            active,
            updatedAt: serverTimestamp(),
            _writeToken: writeToken
          });
          ops++;
          if (wasActive && !active) deactivated++; else updated++;
          await commitIfNeeded();
        }
      } else {
        const newRef = doc(collection(db, COL_QUESTIONS));
        batch.set(newRef, {
          jobId, categoryCode: cat, content, active,
          dedupKey: key,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          _writeToken: writeToken
        });
        ops++;
        inserted++;
        if (!active) deactivated++;
        await commitIfNeeded();
      }
    }

    if (ops > 0) await batch.commit();
    return { inserted, updated, deactivated };
  }
};
