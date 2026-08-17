import fs from 'fs';
import path from 'path';

// Persist document store to disk to maintain complete state durability across server restarts
const DB_FILE = path.resolve(process.cwd(), 'firestore_data.json');

type CollectionStore = Record<string, any>;
type DatabaseStore = Record<string, CollectionStore>;

let dbStore: DatabaseStore = {};
let isLoaded = false;

function loadStore(): DatabaseStore {
  if (isLoaded) return dbStore;
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbStore = JSON.parse(content);
    } else {
      dbStore = {};
    }
  } catch (err) {
    console.warn('[DocStore] Failed to read db file, initializing empty store:', err);
    dbStore = {};
  }
  isLoaded = true;
  return dbStore;
}

function persistStore(): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DocStore] Failed to write db file to disk:', err);
  }
}

// Initial load
loadStore();

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
  constructor(public collectionPath: string, public id: string) {}

  async get(): Promise<DocSnapshot> {
    const store = loadStore();
    const col = store[this.collectionPath] || {};
    const rawData = col[this.id];
    const exists = rawData !== undefined && rawData !== null;
    return {
      id: this.id,
      exists,
      data: () => (exists ? JSON.parse(JSON.stringify(rawData)) : null),
      ref: this,
    };
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    const store = loadStore();
    if (!store[this.collectionPath]) {
      store[this.collectionPath] = {};
    }
    if (options?.merge && store[this.collectionPath][this.id]) {
      store[this.collectionPath][this.id] = {
        ...store[this.collectionPath][this.id],
        ...JSON.parse(JSON.stringify(data)),
      };
    } else {
      store[this.collectionPath][this.id] = JSON.parse(JSON.stringify(data));
    }
    persistStore();
  }

  async update(data: any): Promise<void> {
    const store = loadStore();
    if (!store[this.collectionPath] || store[this.collectionPath][this.id] === undefined) {
      throw new Error(`Document ${this.collectionPath}/${this.id} not found for update`);
    }
    store[this.collectionPath][this.id] = {
      ...store[this.collectionPath][this.id],
      ...JSON.parse(JSON.stringify(data)),
    };
    persistStore();
  }

  async delete(): Promise<void> {
    const store = loadStore();
    if (store[this.collectionPath] && store[this.collectionPath][this.id] !== undefined) {
      delete store[this.collectionPath][this.id];
      persistStore();
    }
  }
}

interface FilterConstraint {
  field: string;
  op: string;
  val: any;
}

interface OrderConstraint {
  field: string;
  dir: 'asc' | 'desc';
}

export class QueryBuilderWrapper {
  private filters: FilterConstraint[] = [];
  private order: OrderConstraint | null = null;
  private limitCount: number | null = null;

  constructor(
    private collectionPath: string,
    initialFilters: FilterConstraint[] = [],
    initialOrder: OrderConstraint | null = null,
    initialLimit: number | null = null
  ) {
    this.filters = [...initialFilters];
    this.order = initialOrder;
    this.limitCount = initialLimit;
  }

  where(field: string, op: any, val: any) {
    return new QueryBuilderWrapper(
      this.collectionPath,
      [...this.filters, { field, op: String(op), val }],
      this.order,
      this.limitCount
    );
  }

  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    return new QueryBuilderWrapper(this.collectionPath, this.filters, { field, dir }, this.limitCount);
  }

  limit(n: number) {
    return new QueryBuilderWrapper(this.collectionPath, this.filters, this.order, n);
  }

  doc(docId?: string): DocRefWrapper {
    const actualId = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new DocRefWrapper(this.collectionPath, actualId);
  }

  async get(): Promise<QuerySnap> {
    const store = loadStore();
    const col = store[this.collectionPath] || {};
    let entries = Object.entries(col).map(([id, data]) => ({ id, data }));

    // Apply where filters
    for (const filter of this.filters) {
      entries = entries.filter(({ data }) => {
        const fieldVal = data?.[filter.field];
        switch (filter.op) {
          case '==':
            return fieldVal === filter.val;
          case '!=':
            return fieldVal !== filter.val;
          case '>':
            return fieldVal > filter.val;
          case '>=':
            return fieldVal >= filter.val;
          case '<':
            return fieldVal < filter.val;
          case '<=':
            return fieldVal <= filter.val;
          case 'in':
            return Array.isArray(filter.val) && filter.val.includes(fieldVal);
          case 'array-contains':
            return Array.isArray(fieldVal) && fieldVal.includes(filter.val);
          default:
            return fieldVal === filter.val;
        }
      });
    }

    // Apply orderBy
    if (this.order) {
      const { field, dir } = this.order;
      entries.sort((a, b) => {
        const valA = a.data?.[field];
        const valB = b.data?.[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        return dir === 'asc' ? 1 : -1;
      });
    }

    // Apply limit
    if (this.limitCount !== null && this.limitCount > 0) {
      entries = entries.slice(0, this.limitCount);
    }

    const docs: DocSnapshot[] = entries.map(({ id, data }) => ({
      id,
      exists: true,
      data: () => JSON.parse(JSON.stringify(data)),
      ref: new DocRefWrapper(this.collectionPath, id),
    }));

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      forEach: (callback: (doc: DocSnapshot) => void) => {
        docs.forEach(callback);
      },
    };
  }
}

type BatchOp =
  | { type: 'set'; ref: DocRefWrapper; data: any; options?: { merge?: boolean } }
  | { type: 'update'; ref: DocRefWrapper; data: any }
  | { type: 'delete'; ref: DocRefWrapper };

export class BatchWrapper {
  private ops: BatchOp[] = [];

  set(docRefWrapper: DocRefWrapper, data: any, options?: { merge?: boolean }) {
    this.ops.push({ type: 'set', ref: docRefWrapper, data, options });
    return this;
  }

  update(docRefWrapper: DocRefWrapper, data: any) {
    this.ops.push({ type: 'update', ref: docRefWrapper, data });
    return this;
  }

  delete(docRefWrapper: DocRefWrapper) {
    this.ops.push({ type: 'delete', ref: docRefWrapper });
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      if (op.type === 'set') {
        await op.ref.set(op.data, op.options);
      } else if (op.type === 'update') {
        await op.ref.update(op.data);
      } else if (op.type === 'delete') {
        await op.ref.delete();
      }
    }
    this.ops = [];
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
    const stagedOps: BatchOp[] = [];
    const txWrapper = {
      get: async (docRefWrapper: DocRefWrapper): Promise<DocSnapshot> => {
        return docRefWrapper.get();
      },
      set: (docRefWrapper: DocRefWrapper, data: any, options?: { merge?: boolean }) => {
        stagedOps.push({ type: 'set', ref: docRefWrapper, data, options });
      },
      update: (docRefWrapper: DocRefWrapper, data: any) => {
        stagedOps.push({ type: 'update', ref: docRefWrapper, data });
      },
      delete: (docRefWrapper: DocRefWrapper) => {
        stagedOps.push({ type: 'delete', ref: docRefWrapper });
      },
    };

    const result = await updateFunction(txWrapper);

    for (const op of stagedOps) {
      if (op.type === 'set') {
        await op.ref.set(op.data, op.options);
      } else if (op.type === 'update') {
        await op.ref.update(op.data);
      } else if (op.type === 'delete') {
        await op.ref.delete();
      }
    }

    return result;
  },
};

export const adminAuth = {
  async verifyIdToken(token: string) {
    return { uid: token, email: 'user@aurainvest.com' };
  },
};

