// public/js/db.js (변경 없음)
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { makeDedupKey } from "./util.js";

const COL_JOBS = 'jobs';
const COL_QUESTIONS = 'questions';

export const DB = {
  async openOrCreate() { /* noop for Firestore */ },

  async ensureAtLeastOneJob() {
    const snap = await getDocs(query(collection(db, COL_JOBS), orderBy('name')));
    if (!snap.empty) return;
    await addDoc(collection(db, COL_JOBS), {
      name: 'Backend Developer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  async listJobs() {
    const snap = await getDocs(query(collection(db, COL_JOBS), orderBy('name')));
    return snap.docs.map(d => ({ id: d.id, ...(d.data()) }));
  },

  async addJob(name) {
    const ref = await addDoc(collection(db, COL_JOBS), {
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  },

  async renameJob(id, name) {
    await updateDoc(doc(db, COL_JOBS, id), {
      name,
      updatedAt: serverTimestamp()
    });
  },

  async deleteJobCascade(id) {
    const batch = writeBatch(db);
    const qSnap = await getDocs(query(collection(db, COL_QUESTIONS), where('jobId', '==', id)));
    qSnap.forEach(d => batch.delete(doc(db, COL_QUESTIONS, d.id)));
    batch.delete(doc(db, COL_JOBS, id));
    await batch.commit();
  },

  async listQuestions(jobId, cat, onlyActive=false) {
    const conditions = [
      where('jobId', '==', jobId),
      where('categoryCode', '==', cat),
    ];
    if (onlyActive) conditions.push(where('active', '==', true));
    const qSnap = await getDocs(query(collection(db, COL_QUESTIONS), ...conditions, orderBy('createdAt', 'desc')));
    return qSnap.docs.map(d => ({ id: d.id, ...(d.data()) }));
  },

  async addQuestion({ jobId, categoryCode, content, active=true }) {
    const ref = await addDoc(collection(db, COL_QUESTIONS), {
      jobId, categoryCode, content, active,
      dedupKey: makeDedupKey(jobId, categoryCode, content),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref.id;
  },

  async updateQuestion(id, patch) {
    await updateDoc(doc(db, COL_QUESTIONS, id), {
      ...patch,
      updatedAt: serverTimestamp()
    });
  },

  async deleteQuestion(id) {
    await deleteDoc(doc(db, COL_QUESTIONS, id));
  },

  async getQuestionByDedup(jobId, cat, content) {
    const key = makeDedupKey(jobId, cat, content);
    const snap = await getDocs(query(collection(db, COL_QUESTIONS), where('dedupKey', '==', key)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data()) };
  },

  async importRows(rows, { updateDup=false } = {}) {
    let inserted = 0, updated = 0, deactivated = 0;

    const jobIdCache = new Map();
    const ensureJobId = async (name) => {
      if (jobIdCache.has(name)) return jobIdCache.get(name);
      const js = await getDocs(query(collection(db, COL_JOBS), where('name', '==', name)));
      let id = null;
      if (js.empty) {
        const newId = await DB.addJob(name);
        id = newId;
      } else {
        id = js.docs[0].id;
      }
      jobIdCache.set(name, id);
      return id;
    };

    let batch = writeBatch(db);
    let ops = 0;
    const commitIfNeeded = async () => {
      if (ops >= 450) {
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
      const dupSnap = await getDocs(query(collection(db, COL_QUESTIONS), where('dedupKey', '==', key)));

      if (!dupSnap.empty) {
        if (updateDup) {
          const d = dupSnap.docs[0];
          const wasActive = !!d.data().active;
          batch.update(doc(db, COL_QUESTIONS, d.id), {
            active,
            updatedAt: serverTimestamp()
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
          updatedAt: serverTimestamp()
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
