import { openDB, IDBPDatabase } from 'idb';

interface FileEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  compressedSize: number;
  data: Blob;
  createdAt: Date;
  associatedFiles?: string[]; // Array of associated file IDs
}

class FileDatabase {
  private db: IDBPDatabase | null = null;
  private dbName = 'file-manager-db';
  private version = 2; // Incrementing version for schema update

  async init() {
    this.db = await openDB(this.dbName, this.version, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('type', 'type');
          store.createIndex('createdAt', 'createdAt');
        }
        // Add associatedFiles field if upgrading from version 1
        if (oldVersion < 2) {
          const store = db.objectStores.get('files');
          if (!store?.indexNames.contains('associatedFiles')) {
            store?.createIndex('associatedFiles', 'associatedFiles', { multiEntry: true });
          }
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
    // Remove associations from other files
    const files = await this.getAllFiles();
    for (const file of files) {
      if (file.associatedFiles?.includes(id)) {
        const updatedAssociations = file.associatedFiles.filter(fid => fid !== id);
        await this.addFile({
          ...file,
          associatedFiles: updatedAssociations
        });
      }
    }
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

  async associateFiles(htmlFileId: string, jsonFileId: string): Promise<void> {
    if (!this.db) await this.init();
    const htmlFile = await this.getFile(htmlFileId);
    if (!htmlFile) throw new Error('HTML file not found');
    
    const jsonFile = await this.getFile(jsonFileId);
    if (!jsonFile) throw new Error('JSON file not found');

    // Update HTML file associations
    await this.addFile({
      ...htmlFile,
      associatedFiles: [...(htmlFile.associatedFiles || []), jsonFileId]
    });
  }

  async removeAssociation(htmlFileId: string, jsonFileId: string): Promise<void> {
    if (!this.db) await this.init();
    const htmlFile = await this.getFile(htmlFileId);
    if (!htmlFile) throw new Error('HTML file not found');

    await this.addFile({
      ...htmlFile,
      associatedFiles: (htmlFile.associatedFiles || []).filter(id => id !== jsonFileId)
    });
  }

  async getAssociatedFiles(fileId: string): Promise<FileEntry[]> {
    if (!this.db) await this.init();
    const file = await this.getFile(fileId);
    if (!file?.associatedFiles) return [];
    
    const associatedFiles = await Promise.all(
      file.associatedFiles.map(id => this.getFile(id))
    );
    return associatedFiles.filter((f): f is FileEntry => f !== undefined);
  }
}

export const fileDB = new FileDatabase();
