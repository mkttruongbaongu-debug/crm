import { Branch, SearchLog } from "../types";

// URL Mặc định (Updated)
const DEMO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwu99wlZZ1gyIxaoHyQvmkemxbW0D7xr-zOZrF3yAjFCU85NCT8T6owgWr2ryVaL2m4Ow/exec";
const STORAGE_KEY_URL = "MY_GOOGLE_SHEET_SCRIPT_URL";

// Cấu trúc payload mở rộng để hỗ trợ nhiều action và routing sheet
interface SheetPayload {
  action: 'create' | 'update' | 'delete' | 'add_column' | 'rename_sheet' | 'log_search' | 'get_logs' | 'read' | 'init_schema';
  sheetName?: 'Branches' | 'Products' | 'Logs' | 'Orders'; // Routing rõ ràng cho backend mới
  data: any; 
}

// Hàm lấy URL hiện tại
const getScriptUrl = () => {
  const customUrl = localStorage.getItem(STORAGE_KEY_URL);
  return customUrl && customUrl.trim() !== "" ? customUrl : DEMO_SCRIPT_URL;
};

export const sheetAPI = {
  // Lưu URL Script mới của người dùng
  setScriptUrl: (url: string) => {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
  },

  getCurrentUrl: () => getScriptUrl(),

  // 1. Lấy toàn bộ danh sách chi nhánh
  getAllBranches: async (customUrl?: string): Promise<Branch[]> => {
    try {
      const url = customUrl || getScriptUrl();
      // Gửi POST request với action read cho sheet Branches để đảm bảo routing đúng
      // (GET mặc định backend mới trả về Branches, nhưng POST an toàn hơn)
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ action: 'read', sheetName: 'Branches' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      
      if (!response.ok) {
        throw new Error("Không thể kết nối đến Google Sheet");
      }

      const result = await response.json();
      if (result.status === 'success' && Array.isArray(result.data)) {
        return result.data;
      }
      return Array.isArray(result) ? result : []; // Fallback logic cũ
    } catch (error) {
      console.error("Error fetching branches:", error);
      throw error;
    }
  },

  // 2. Hàm lõi gửi request (Sync)
  syncBranch: async (payload: SheetPayload): Promise<any> => {
    const url = getScriptUrl();

    const requestOptions: RequestInit = {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    };

    try {
      const response = await fetch(url, {
        ...requestOptions,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'error') {
        throw new Error(result.message);
      }
      return result;

    } catch (error) {
      console.warn("Standard sync failed, attempting no-cors fallback...", error);
      try {
        await fetch(url, {
          ...requestOptions,
          mode: 'no-cors'
        });
        return { status: 'success', message: 'Request sent via no-cors (Backup mode)' };
      } catch (retryError) {
        console.error("Sync totally failed:", retryError);
        throw retryError;
      }
    }
  },

  // --- CÁC HÀM GỌI CỤ THỂ ---

  create: async (branch: Branch) => {
    return sheetAPI.syncBranch({ action: 'create', sheetName: 'Branches', data: branch });
  },

  update: async (branch: Branch) => {
    if (!branch.id) throw new Error("Update failed: Missing Branch ID");
    return sheetAPI.syncBranch({ action: 'update', sheetName: 'Branches', data: branch });
  },

  delete: async (id: string) => {
    return sheetAPI.syncBranch({ action: 'delete', sheetName: 'Branches', data: { id } });
  },

  // Log hệ thống
  logSearch: async (log: SearchLog) => {
    return sheetAPI.syncBranch({ action: 'log_search', sheetName: 'Logs', data: log }).catch(err => console.error("Log failed:", err));
  },
  
  getLogs: async (limit: number = 100): Promise<SearchLog[]> => {
    try {
      const res = await sheetAPI.syncBranch({ action: 'get_logs', sheetName: 'Logs', data: { limit } });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.warn("Could not fetch logs.", e);
      return [];
    }
  },

  setupInitialColumns: async () => {
    // Chỉ là helper gọi init_schema
    const columns = [
      'id', 'name', 'manager', 'address', 'phoneNumber', 
      'searchStr', 'holidaySchedule', 'holidayHistory', 
      'isActive', 'note', 'updatedAt'
    ];
    return sheetAPI.syncBranch({ 
        action: 'init_schema', 
        sheetName: 'Branches',
        data: { headers: columns } 
    });
  }
};