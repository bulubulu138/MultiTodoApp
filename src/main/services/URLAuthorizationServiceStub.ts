// 临时服务存根
export interface URLAuthorizationRecord {
  id: number;
  url: string;
  domain: string;
  title: string | null;
  first_authorized_at: string;
  last_refreshed_at: string;
  refresh_count: number;
  status: 'active' | 'expired' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class URLAuthorizationService {
  private fileStorageManager: any;

  constructor(fileStorageManager: any) {
    this.fileStorageManager = fileStorageManager;
  }

  public getAllAuthorizations(): URLAuthorizationRecord[] {
    return [];
  }

  public async batchRefreshAuthorizations() {
    return { success: true, successCount: 0, failedCount: 0 };
  }

  public async cleanupExpiredAuthorizations() {
    return { success: true, count: 0 };
  }

  public async deleteAuthorization(url: string) {
    return true;
  }

  public getAuthorizationsByUrls(urls: string[]): Map<string, URLAuthorizationRecord> {
    return new Map();
  }

  public async initializeFromExistingTodos() {
    return { success: true, count: 0 };
  }

  public getDb(): any {
    return null;
  }
}