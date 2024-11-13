import { openDB, IDBPDatabase } from 'idb';

interface FileEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  compressedSize: number;
  data: Blob;
  createdAt: Date;
}

class FileDatabase {
  private db: IDBPDatabase | null = null;
  private dbName = 'file-manager-db';
  private version = 1;

  async init() {
    this.db = await openDB(this.dbName, this.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('type', 'type');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }

  async addFile(file: FileEntry): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('files', file);
  }

  async getFile(id: string): Promise<FileEntry | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('files', id);
  }

  async getAllFiles(): Promise<FileEntry[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('files');
  }

  async deleteFile(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('files', id);
  }

  async getStorageUsage(): Promise<{ total: number; compressed: number }> {
    if (!this.db) await this.init();
    const files = await this.getAllFiles();
    return files.reduce(
      (acc, file) => ({
        total: acc.total + file.size,
        compressed: acc.compressed + file.compressedSize,
      }),
      { total: 0, compressed: 0 }
    );
  }
}

export const fileDB = new FileDatabase();
