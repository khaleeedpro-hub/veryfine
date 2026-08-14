import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction as firestoreRunTransaction,
  writeBatch,
  WhereFilterOp,
  OrderByDirection,
  QueryConstraint,
  DocumentReference,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const adminDbId = (config as any).firestoreDatabaseId || (config as any).databaseId || 'ai-studio-veryfineinvestus-57aad29a-d7de-45e5-b2a3-09f72df87a39';
export const rawDb = getFirestore(app, adminDbId);

export const rawAuth = getAuth(app);

export interface DocSnapshot {
  id: string;
  exists: boolean;
  data: () => any;
  ref: DocRefWrapper;
}

export interface QuerySnap {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: DocSnapshot) => void) => void;
}

export class DocRefWrapper {
  constructor(public rawRef: DocumentReference) {}

  get id() {
    return this.rawRef.id;
  }

  async get(): Promise<DocSnapshot> {
    const snap = await getDoc(this.rawRef);
    return {
      id: snap.id,
      exists: snap.exists(),
      data: () => snap.data() || null,
      ref: this,
    };
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    await setDoc(this.rawRef, data, options || {});
  }

  async update(data: any): Promise<void> {
    await updateDoc(this.rawRef, data);
  }

  async delete(): Promise<void> {
    await deleteDoc(this.rawRef);
  }
}

export class QueryBuilderWrapper {
  private constraints: QueryConstraint[] = [];

  constructor(private collectionPath: string, initialConstraints: QueryConstraint[] = []) {
    this.constraints = [...initialConstraints];
  }

  where(field: string, op: WhereFilterOp, val: any) {
    return new QueryBuilderWrapper(this.collectionPath, [...this.constraints, where(field, op, val)]);
  }

  orderBy(field: string, dir: OrderByDirection = 'asc') {
    return new QueryBuilderWrapper(this.collectionPath, [...this.constraints, orderBy(field, dir)]);
  }

  limit(n: number) {
    return new QueryBuilderWrapper(this.collectionPath, [...this.constraints, limit(n)]);
  }

  doc(docId?: string): DocRefWrapper {
    const colRef = collection(rawDb, this.collectionPath);
    const dRef = docId ? doc(colRef, docId) : doc(colRef);
    return new DocRefWrapper(dRef);
  }

  async get(): Promise<QuerySnap> {
    const colRef = collection(rawDb, this.collectionPath);
    const q = query(colRef, ...this.constraints);
    const snap = await getDocs(q);
    const docs: DocSnapshot[] = snap.docs.map((d) => ({
      id: d.id,
      exists: d.exists(),
      data: () => d.data(),
      ref: new DocRefWrapper(d.ref),
    }));
    return {
      docs,
      empty: snap.empty,
      size: snap.size,
      forEach: (callback: (doc: DocSnapshot) => void) => {
        docs.forEach(callback);
      },
    };
  }
}

export class BatchWrapper {
  private rawBatch = writeBatch(rawDb);

  set(docRefWrapper: DocRefWrapper, data: any, options?: { merge?: boolean }) {
    this.rawBatch.set(docRefWrapper.rawRef, data, options || {});
    return this;
  }

  update(docRefWrapper: DocRefWrapper, data: any) {
    this.rawBatch.update(docRefWrapper.rawRef, data);
    return this;
  }

  delete(docRefWrapper: DocRefWrapper) {
    this.rawBatch.delete(docRefWrapper.rawRef);
    return this;
  }

  async commit(): Promise<void> {
    await this.rawBatch.commit();
  }
}

export const adminDb = {
  collection(path: string) {
    return new QueryBuilderWrapper(path);
  },
  batch() {
    return new BatchWrapper();
  },
  async runTransaction<T>(
    updateFunction: (transaction: {
      get: (docRefWrapper: DocRefWrapper) => Promise<DocSnapshot>;
      set: (docRefWrapper: DocRefWrapper, data: any, options?: { merge?: boolean }) => void;
      update: (docRefWrapper: DocRefWrapper, data: any) => void;
      delete: (docRefWrapper: DocRefWrapper) => void;
    }) => Promise<T>
  ): Promise<T> {
    return firestoreRunTransaction(rawDb, async (tx) => {
      const txWrapper = {
        get: async (docRefWrapper: DocRefWrapper): Promise<DocSnapshot> => {
          const snap = await tx.get(docRefWrapper.rawRef);
          return {
            id: snap.id,
            exists: snap.exists(),
            data: () => snap.data() || null,
            ref: docRefWrapper,
          };
        },
        set: (docRefWrapper: DocRefWrapper, data: any, options?: { merge?: boolean }) => {
          tx.set(docRefWrapper.rawRef, data, options || {});
        },
        update: (docRefWrapper: DocRefWrapper, data: any) => {
          tx.update(docRefWrapper.rawRef, data);
        },
        delete: (docRefWrapper: DocRefWrapper) => {
          tx.delete(docRefWrapper.rawRef);
        },
      };
      return await updateFunction(txWrapper);
    });
  },
};

export const adminAuth = rawAuth;
