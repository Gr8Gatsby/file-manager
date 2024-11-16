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
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  private upgradeLock = false;

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
    if (this.initialized && this.db && !this.upgradeLock) {
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

  private async waitForUpgrade(): Promise<void> {
    if (!this.upgradeLock) return;
    
    const checkLock = async (resolve: () => void) => {
      if (!this.upgradeLock) {
        resolve();
      } else {
        setTimeout(() => checkLock(resolve), 100);
      }
    };

    return new Promise(resolve => checkLock(resolve));
  }

  private async initWithRetry(): Promise<void> {
    try {
      this.upgradeLock = true;
      this.db = await openDB(this.dbName, this.version, {
        blocking: () => {
          // Close the database if another version is trying to upgrade
          if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
          }
        },
        terminated: () => {
          this.db = null;
          this.initialized = false;
        },
        upgrade: async (db, oldVersion, newVersion, transaction) => {
          try {
            if (!db.objectStoreNames.contains('files')) {
              const store = db.createObjectStore('files', { keyPath: 'id' });
              store.createIndex('name', 'name');
              store.createIndex('type', 'type');
              store.createIndex('createdAt', 'createdAt');
              store.createIndex('associatedFiles', 'associatedFiles', { multiEntry: true });
            }
            
            // Wait for the transaction to complete
            await new Promise((resolve, reject) => {
              transaction.addEventListener('complete', resolve);
              transaction.addEventListener('error', reject);
              transaction.addEventListener('abort', () => reject(new Error('Upgrade transaction aborted')));
            });
          } catch (error) {
            console.error('Error during upgrade:', error);
            throw error;
          }
        },
      });
      
      this.initialized = true;
      this.retryCount = 0;
    } catch (error) {
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.initWithRetry();
      }
      throw error;
    } finally {
      this.upgradeLock = false;
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.isInitializing) {
      await this.initPromise;
      return;
    }

    this.isInitializing = true;
    this.initPromise = new Promise<void>(async (resolve, reject) => {
      try {
        await this.initWithRetry();
        await this.executeQueuedOperations();
        resolve();
      } catch (error) {
        this.db = null;
        this.initialized = false;
        reject(error instanceof Error ? error : new Error('Failed to initialize database'));
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    });

    return this.initPromise;
  }

  async addFile(file: FileEntry): Promise<void> {
    await this.waitForUpgrade();
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      await this.db.put('files', file);
    });
  }

  async getFile(id: string): Promise<FileEntry | undefined> {
    await this.waitForUpgrade();
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await this.db.get('files', id);
    });
  }

  async getAllFiles(): Promise<FileEntry[]> {
    await this.waitForUpgrade();
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      return await this.db.getAll('files');
    });
  }

  async deleteFile(id: string): Promise<void> {
    await this.waitForUpgrade();
    return this.queueOperation(async () => {
      if (!this.db) throw new Error('Database not initialized');
      
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
    await this.waitForUpgrade();
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
    await this.waitForUpgrade();
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
    await this.waitForUpgrade();
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
    await this.waitForUpgrade();
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
