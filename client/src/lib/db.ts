import { openDB, IDBPDatabase } from 'idb';

interface FileEntry {
  id: string;
  name: string;
  type: string;
  size: number;
  compressedSize: number;
  data: Blob;
  createdAt: Date;
  associatedFiles?: string[];
}

interface QueuedOperation {
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

class FileDatabase {
  private db: IDBPDatabase | null = null;
  private dbName = 'file-manager-db';
  private version = 2;
  private initPromise: Promise<void> | null = null;
  private isInitializing = false;
  private operationQueue: QueuedOperation[] = [];
  private initialized = false;

  private async executeQueuedOperations() {
    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          const result = await operation.operation();
          operation.resolve(result);
        } catch (error) {
          operation.reject(error instanceof Error ? error : new Error('Database operation failed'));
        }
      }
    }
  }

  private queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.initialized && this.db) {
      return operation();
    }

    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        operation,
        resolve,
        reject,
      });

      if (!this.isInitializing) {
        this.init().catch(reject);
      }
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.isInitializing) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = new Promise<void>(async (resolve, reject) => {
      try {
        this.db = await openDB(this.dbName, this.version, {
          upgrade(db, oldVersion) {
            if (!db.objectStoreNames.contains('files')) {
              const store = db.createObjectStore('files', { keyPath: 'id' });
              store.createIndex('name', 'name');
              store.createIndex('type', 'type');
              store.createIndex('createdAt', 'createdAt');
            }
            if (oldVersion < 2 && db.objectStoreNames.contains('files')) {
              const store = db.transaction('files', 'readwrite').objectStore('files');
              if (!store.indexNames.contains('associatedFiles')) {
                store.createIndex('associatedFiles', 'associatedFiles', { multiEntry: true });
              }
            }
          },
        });
        
        this.initialized = true;
        await this.executeQueuedOperations();
        resolve();
      } catch (error) {
        this.db = null;
        this.initialized = false;
        reject(error instanceof Error ? error : new Error('Failed to initialize database'));
      } finally {
        this.isInitializing = false;
      }
    });

    return this.initPromise;
  }

  async addFile(file: FileEntry): Promise<void> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      await this.db.put('files', file);
    });
  }

  async getFile(id: string): Promise<FileEntry | undefined> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await this.db.get('files', id);
    });
  }

  async getAllFiles(): Promise<FileEntry[]> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await this.db.getAll('files');
    });
  }

  async deleteFile(id: string): Promise<void> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      
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
      await this.db.delete('files', id);
    });
  }

  async getStorageUsage(): Promise<{ total: number; compressed: number }> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      const files = await this.getAllFiles();
      return files.reduce(
        (acc, file) => ({
          total: acc.total + file.size,
          compressed: acc.compressed + file.compressedSize,
        }),
        { total: 0, compressed: 0 }
      );
    });
  }

  async associateFiles(htmlFileId: string, jsonFileId: string): Promise<void> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      
      const htmlFile = await this.getFile(htmlFileId);
      if (!htmlFile) throw new Error('HTML file not found');
      
      const jsonFile = await this.getFile(jsonFileId);
      if (!jsonFile) throw new Error('JSON file not found');

      await this.addFile({
        ...htmlFile,
        associatedFiles: [...(htmlFile.associatedFiles || []), jsonFileId]
      });
    });
  }

  async removeAssociation(htmlFileId: string, jsonFileId: string): Promise<void> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      
      const htmlFile = await this.getFile(htmlFileId);
      if (!htmlFile) throw new Error('HTML file not found');

      await this.addFile({
        ...htmlFile,
        associatedFiles: (htmlFile.associatedFiles || []).filter(id => id !== jsonFileId)
      });
    });
  }

  async getAssociatedFiles(fileId: string): Promise<FileEntry[]> {
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      
      const file = await this.getFile(fileId);
      if (!file?.associatedFiles) return [];
      
      const associatedFiles = await Promise.all(
        file.associatedFiles.map(id => this.getFile(id))
      );
      return associatedFiles.filter((f): f is FileEntry => f !== undefined);
    });
  }
}

export const fileDB = new FileDatabase();
