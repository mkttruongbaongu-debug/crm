import React, { useState, useEffect, useCallback } from 'react';
import { BranchManager } from './components/BranchManager';
import { parseInitialBranchData, generateBranchSearchStr, normalizePhoneNumber } from './services/geminiService';
import { sheetAPI } from './services/sheetService';
import { Branch, HolidaySchedule } from './types';

function App() {
  const [branches, setBranches] = useState<Branch[]>([]);

  // Helper an toàn để parse JSON
  const safeJsonParse = (input: any, fallback: any) => {
    if (!input) return fallback;
    if (typeof input === 'object') return input;
    try {
      return JSON.parse(input);
    } catch (e) {
      return fallback;
    }
  };

  // --- HÀM QUAN TRỌNG: LỌC TRÙNG LẶP LỊCH SỬ ---
  // Giúp xử lý vụ "1880 lần" bằng cách chỉ giữ lại các cặp (startTime - endTime) duy nhất
  const deduplicateHistory = (history: any[]): HolidaySchedule[] => {
    if (!Array.isArray(history) || history.length === 0) return [];
    
    const uniqueMap = new Map<string, HolidaySchedule>();
    
    history.forEach(h => {
       // Chỉ chấp nhận dữ liệu có đủ thời gian
       if (h && h.startTime && h.endTime) {
          // Tạo key duy nhất. Ví dụ: "2024-01-01T00:00..._2024-01-02T..."
          const key = `${h.startTime}_${h.endTime}`;
          // Nếu trùng key, cái sau sẽ đè cái trước (lấy dữ liệu mới nhất)
          uniqueMap.set(key, {
            isEnabled: h.isEnabled, // Thường lịch sử thì isEnabled không quan trọng, nhưng cứ giữ
            startTime: h.startTime,
            endTime: h.endTime,
            reason: h.reason || ""
          });
       }
    });

    // Trả về mảng đã lọc sạch và sort mới nhất lên đầu
    return Array.from(uniqueMap.values()).sort((a, b) => 
       new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  };

  // Helper chuẩn hóa dữ liệu đầu vào
  const processBranchData = (rawList: any[]): Branch[] => {
     return rawList.map((b: any) => {
        const rawId = b.id || b.ID || b.Id || b.iD || b._id;
        const validId = (rawId && String(rawId).trim() !== "") ? String(rawId) : `gen-${Math.random()}`;
        const name = b.name || "";
        const address = b.address || "";
        const phone = normalizePhoneNumber(b.phoneNumber);

        // Parse JSON
        const parsedSchedule = safeJsonParse(b.holidaySchedule, { isEnabled: false });
        let parsedHistory = safeJsonParse(b.holidayHistory, []);
        
        // --- CLEAN DATA NGAY TẠI ĐÂY ---
        parsedHistory = deduplicateHistory(parsedHistory);

        return {
          ...b,
          id: validId,
          name: name,
          manager: b.manager || "",
          address: address,
          phoneNumber: phone,
          searchStr: b.searchStr || generateBranchSearchStr(name, address, phone),
          holidaySchedule: parsedSchedule,
          holidayHistory: parsedHistory, // Dữ liệu sạch sẽ
          isActive: b.isActive !== undefined ? b.isActive : true,
          note: b.note || "",
          updatedAt: b.updatedAt || "",
          originalName: b.name || ""
        };
      });
  };

  // Hàm load dữ liệu
  const loadBranchData = useCallback(async (): Promise<boolean> => {
      let isSuccess = false;
      
      try {
        const cached = localStorage.getItem('branches');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBranches(parsed);
          } else {
             setBranches(parseInitialBranchData());
          }
        } else {
           setBranches(parseInitialBranchData());
        }
      } catch (e) {
        setBranches(parseInitialBranchData());
      }

      try {
        const data = await sheetAPI.getAllBranches();
        if (data && Array.isArray(data) && data.length > 0) {
          const normalizedData = processBranchData(data);
          setBranches(normalizedData);
          localStorage.setItem('branches', JSON.stringify(normalizedData));
          isSuccess = true;
        }
      } catch (err) {
        console.warn("Background fetch failed.", err);
        isSuccess = false;
      }
      return isSuccess;
  }, []);

  useEffect(() => {
    loadBranchData();
  }, [loadBranchData]);

  return (
    <BranchManager 
      branches={branches} 
      setBranches={(newBranches) => {
         setBranches(newBranches);
         localStorage.setItem('branches', JSON.stringify(newBranches));
      }} 
      onReload={loadBranchData}
    />
  );
}

export default App;