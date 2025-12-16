export interface HolidaySchedule {
  isEnabled: boolean;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  reason?: string;
}

// Interface chính cho đối tượng Chi nhánh được quản lý trong App
export interface Branch {
  id: string; // Unique ID
  name: string;
  manager: string;
  address: string;
  phoneNumber?: string; // Thêm SĐT vào dữ liệu gốc
  searchStr: string; // Chuỗi đã chuẩn hóa để tối ưu tìm kiếm
  holidaySchedule?: HolidaySchedule; // Cấu hình nghỉ hiện tại/sắp tới
  holidayHistory?: HolidaySchedule[]; // Lịch sử các lần nghỉ để thống kê
  
  // --- CÁC TRƯỜNG MỚI BỔ SUNG ---
  isActive?: boolean; // Cho phép tạm ẩn chi nhánh mà không cần xóa
  note?: string; // Ghi chú nội bộ (không hiện ra cho khách)
  updatedAt?: string; // Thời gian cập nhật lần cuối
  
  // --- HỖ TRỢ UPDATE THÔNG MINH ---
  originalName?: string; // Tên gốc (trước khi sửa) để tìm kiếm fallback
}

// --- LOGGING INTERFACE ---
export interface SearchLog {
  id: string;
  timestamp: string; // ISO String
  query: string; // Nội dung khách tìm
  resultBranch?: string; // Kết quả trả về (Tên chi nhánh)
  isSuccess: boolean; // Tìm thấy hay không
  source: 'INSTANT' | 'AI' | 'FAIL'; // Nguồn
  userAgent?: string; // Thiết bị (Mobile/Desktop)
}

// --- SEARCH RESULT INTERFACE ---
export interface BranchResult {
  branchId: string;
  branchName: string;
  branchAddress: string;
  managerName: string;
  phoneNumber?: string;
  customerAddressOriginal?: string;
  estimatedDistance?: string;
  reasoning?: string;
  holidaySchedule?: HolidaySchedule;
  searchSource: 'INSTANT' | 'AI' | 'FAIL';
}