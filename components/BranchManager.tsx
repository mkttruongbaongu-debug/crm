import React, { useState, useRef, useEffect } from 'react';
import { Branch, HolidaySchedule } from '../types';
import { normalizeString } from '../services/geminiService';
import { sheetAPI } from '../services/sheetService';

interface BranchManagerProps {
  branches: Branch[];
  setBranches: (branches: Branch[]) => void;
  onClose: () => void;
  onReload: () => void; // Callback để reload dữ liệu app
}

const ADMIN_PASSWORD = "TruongBaoNgu2026";

const getTodayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return (new Date(now.getTime() - offset)).toISOString().split('T')[0];
};

// Hàm tính toán thống kê lịch sử nghỉ
const calculateStats = (history: HolidaySchedule[]) => {
  const stats: Record<string, { total: number; months: Record<number, number> }> = {};
  if (!Array.isArray(history)) return stats;
  history.forEach(item => {
    // Chỉ tính các lịch nghỉ hợp lệ (có startTime)
    if (!item.startTime) return;
    const date = new Date(item.startTime);
    if (isNaN(date.getTime())) return;
    
    const year = date.getFullYear().toString();
    const month = date.getMonth() + 1; 
    
    if (!stats[year]) stats[year] = { total: 0, months: {} };
    stats[year].total += 1;
    stats[year].months[month] = (stats[year].months[month] || 0) + 1;
  });
  return stats;
};

// Component con: Bộ chọn giờ 24h
const TimePicker24h = ({ value, onChange, disabled }: { value: string, onChange: (val: string) => void, disabled?: boolean }) => {
  const [hStr, mStr] = value ? value.split(':') : ['00', '00'];
  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 2) val = val.slice(0, 2);
    if (!/^\d*$/.test(val)) return;
    const num = parseInt(val);
    if (num > 23) val = '23';
    onChange(`${val}:${mStr}`);
  };
  const handleHourBlur = () => {
    let num = parseInt(hStr || '0');
    if (isNaN(num)) num = 0; if (num > 23) num = 23;
    onChange(`${num.toString().padStart(2, '0')}:${mStr}`);
  };
  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 2) val = val.slice(0, 2);
    if (!/^\d*$/.test(val)) return;
    const num = parseInt(val);
    if (num > 59) val = '59';
    onChange(`${hStr}:${val}`);
  };
  const handleMinuteBlur = () => {
    let num = parseInt(mStr || '0');
    if (isNaN(num)) num = 0; if (num > 59) num = 59;
    onChange(`${hStr}:${num.toString().padStart(2, '0')}`);
  };

  return (
    <div className={`flex items-center border border-gray-300 rounded bg-white px-2 py-2 gap-1 focus-within:border-red-500 w-fit ${disabled ? 'bg-gray-100' : ''}`}>
       <input type="text" inputMode="numeric" value={hStr} onChange={handleHourChange} onBlur={handleHourBlur} disabled={disabled} className="w-8 text-center text-base font-bold outline-none bg-transparent p-0" placeholder="HH" />
       <span className="text-gray-400 font-bold mb-0.5">:</span>
       <input type="text" inputMode="numeric" value={mStr} onChange={handleMinuteChange} onBlur={handleMinuteBlur} disabled={disabled} className="w-8 text-center text-base font-bold outline-none bg-transparent p-0" placeholder="MM" />
    </div>
  );
};

export const BranchManager: React.FC<BranchManagerProps> = ({ branches, setBranches, onClose, onReload }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  // State quản lý thời gian thực để UI list cập nhật tự động
  const [now, setNow] = useState(new Date());

  // State thông báo trạng thái check URL
  const [urlCheckStatus, setUrlCheckStatus] = useState<{type: 'success' | 'error' | null, msg: string}>({ type: null, msg: '' });
  
  const [formData, setFormData] = useState({ 
    id: '', name: '', manager: '', address: '', phoneNumber: '', isActive: true, note: '' 
  });
  
  const [holidayUI, setHolidayUI] = useState({
    isEnabled: false, startDate: '', startTime: '00:00', endDate: '', endTime: '23:59', reason: ''
  });

  const [authPassword, setAuthPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setScriptUrl(sheetAPI.getCurrentUrl()); }, []);

  // Update real-time clock mỗi giây
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentEditingBranch = branches.find(b => b.id === editingId);
  const editingStats = currentEditingBranch && currentEditingBranch.holidayHistory 
    ? calculateStats(currentEditingBranch.holidayHistory) 
    : {};

  const handleToggleHoliday = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const today = getTodayString();
      setHolidayUI({ ...holidayUI, isEnabled: true, startDate: holidayUI.startDate || today, endDate: holidayUI.endDate || today });
    } else {
      setHolidayUI({ ...holidayUI, isEnabled: false });
    }
  };

  const handleEdit = (e: React.MouseEvent, branch: Branch) => {
    e.stopPropagation();
    setEditingId(branch.id);
    const isTempId = branch.id.startsWith('gen-') || branch.id.startsWith('init-');
    
    setFormData({
      id: isTempId ? `(Chưa có ID - ${branch.id})` : branch.id,
      name: branch.name || '', manager: branch.manager || '', address: branch.address || '',
      phoneNumber: branch.phoneNumber ? String(branch.phoneNumber) : '',
      isActive: branch.isActive !== undefined ? branch.isActive : true, note: branch.note || ''
    });
    
    if (branch.holidaySchedule?.isEnabled) {
      const startObj = new Date(branch.holidaySchedule.startTime);
      const endObj = new Date(branch.holidaySchedule.endTime);
      const startOffset = startObj.getTimezoneOffset() * 60000;
      const endOffset = endObj.getTimezoneOffset() * 60000;
      const startIso = (new Date(startObj.getTime() - startOffset)).toISOString();
      const endIso = (new Date(endObj.getTime() - endOffset)).toISOString();

      setHolidayUI({
        isEnabled: true, startDate: startIso.split('T')[0], startTime: startIso.split('T')[1].slice(0, 5),
        endDate: endIso.split('T')[0], endTime: endIso.split('T')[1].slice(0, 5), reason: branch.holidaySchedule.reason || ''
      });
    } else {
      setHolidayUI({ isEnabled: false, startDate: '', startTime: '00:00', endDate: '', endTime: '23:59', reason: '' });
    }
    setAuthPassword('');
    // Mobile UX: Scroll to top of form when editing
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- LOGIC XÓA (OPTIMISTIC) ---
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.prompt(`CẢNH BÁO XÓA:\nNhập mật khẩu quản trị:`) !== ADMIN_PASSWORD) {
      alert("Sai mật khẩu!"); return;
    }
    if (!window.confirm("Xác nhận xóa?")) return;

    // 1. Optimistic Update: Xóa ngay lập tức khỏi UI
    const previousBranches = [...branches];
    const newBranches = branches.filter(b => b.id !== id);
    setBranches(newBranches);
    
    // Nếu đang edit thằng bị xóa thì reset form
    if (editingId === id) handleCancelEdit();

    // 2. Gửi request xóa dưới background
    try {
      await sheetAPI.delete(id);
    } catch (error) {
      console.error("Delete failed", error);
      alert("Lỗi khi xóa trên Server. Dữ liệu sẽ được khôi phục.");
      setBranches(previousBranches); // Rollback nếu lỗi
    }
  };
  
  // Nút Lưu Link Script mới - có kiểm tra kết nối
  const handleCheckAndSaveUrl = async () => {
     setUrlCheckStatus({ type: null, msg: '' });
     const urlToTest = scriptUrl.trim();
     if (!urlToTest.startsWith("https://script.google.com/")) {
       setUrlCheckStatus({ type: 'error', msg: 'Link không hợp lệ (phải bắt đầu bằng https://script.google.com/...)' });
       return;
     }

     setIsCheckingUrl(true);
     try {
       // Test connection với URL mới nhập
       const data = await sheetAPI.getAllBranches(urlToTest);
       
       if (Array.isArray(data) && data.length > 0) {
          // Thành công & Có dữ liệu
          sheetAPI.setScriptUrl(urlToTest);
          setUrlCheckStatus({ type: 'success', msg: `✅ Kết nối thành công! (${data.length} dòng). Đã lưu & cập nhật dữ liệu.` });
          
          // Gọi hàm reload từ App component để refresh dữ liệu mà KHÔNG reload trang
          onReload(); 
       } else {
          // Thành công nhưng dữ liệu rỗng
          setUrlCheckStatus({ type: 'error', msg: '⚠️ Kết nối được nhưng KHÔNG CÓ DỮ LIỆU (0 dòng). Link chưa được lưu.' });
       }
     } catch (err: any) {
        setUrlCheckStatus({ type: 'error', msg: '❌ Kết nối thất bại: ' + err.message + '. Kiểm tra quyền truy cập Script.' });
     } finally {
        setIsCheckingUrl(false);
     }
  };

  // --- LOGIC LƯU (OPTIMISTIC UI) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) { alert('Thiếu Tên hoặc Địa chỉ.'); return; }

    if (authPassword.trim() !== ADMIN_PASSWORD) { alert("Sai mật khẩu!"); return; }

    let finalSchedule: HolidaySchedule = { isEnabled: false, startTime: '', endTime: '', reason: '' };
    if (holidayUI.isEnabled) {
      if (!holidayUI.startDate || !holidayUI.endDate) { alert('Thiếu ngày nghỉ.'); return; }
      const start = new Date(`${holidayUI.startDate}T${holidayUI.startTime || '00:00'}:00`);
      const end = new Date(`${holidayUI.endDate}T${holidayUI.endTime || '23:59'}:00`);
      if (start >= end) { alert('Ngày kết thúc phải sau ngày bắt đầu.'); return; }
      finalSchedule = { isEnabled: true, startTime: start.toISOString(), endTime: end.toISOString(), reason: holidayUI.reason };
    }

    const searchStr = normalizeString(`${formData.name} ${formData.address} ${formData.phoneNumber || ''}`);
    const updatedAt = new Date().toISOString(); 
    
    // Snapshot dữ liệu cũ để rollback nếu lỗi
    const previousBranches = [...branches];

    // --- XỬ LÝ DỮ LIỆU ---
    let newBranchData: Branch;
    let isUpdate = false;
    let isTempId = false;

    if (editingId) {
      isUpdate = true;
      const oldBranch = branches.find(b => b.id === editingId)!;
      isTempId = editingId.startsWith('init-') || editingId.startsWith('gen-');
      
      const currentHistory = oldBranch.holidayHistory || [];
      const newHistory = [...currentHistory];
      
      // LOGIC FIX: Thêm ngay vào lịch sử nếu lịch nghỉ ĐƯỢC BẬT (để tính thống kê ngay lập tức)
      if (finalSchedule.isEnabled) {
         // Tránh duplicate nếu click save nhiều lần cùng 1 khoảng thời gian
         const isDuplicate = newHistory.some(h => 
           h.startTime === finalSchedule.startTime && h.endTime === finalSchedule.endTime
         );
         if (!isDuplicate) {
             newHistory.push(finalSchedule);
         }
      }

      newBranchData = {
        ...oldBranch,
        id: isTempId ? `br-${Date.now()}` : oldBranch.id, // Cấp ID mới ngay lập tức nếu là temp
        name: formData.name, manager: formData.manager, address: formData.address,
        phoneNumber: formData.phoneNumber, isActive: formData.isActive, note: formData.note,
        searchStr, holidaySchedule: finalSchedule, holidayHistory: newHistory, updatedAt
      };
    } else {
      // Thêm mới
      newBranchData = {
        id: `br-${Date.now()}`, // Generate ID tạm thời (khá an toàn vì timestamp)
        name: formData.name, manager: formData.manager, address: formData.address,
        phoneNumber: formData.phoneNumber, isActive: formData.isActive, note: formData.note,
        searchStr, holidaySchedule: finalSchedule, holidayHistory: finalSchedule.isEnabled ? [finalSchedule] : [],
        updatedAt, originalName: formData.name
      };
    }

    // --- 1. OPTIMISTIC UPDATE: Cập nhật UI Ngay Lập Tức ---
    if (isUpdate) {
      setBranches(branches.map(b => b.id === editingId ? newBranchData : b));
    } else {
      setBranches([newBranchData, ...branches]);
    }
    
    // Reset Form & Đóng Modal (Tạo cảm giác xong ngay lập tức)
    handleCancelEdit(); 

    // --- 2. BACKGROUND SYNC: Gửi lên Server ---
    const payload = (isUpdate && isTempId) 
        ? { ...newBranchData, originalName: previousBranches.find(b => b.id === editingId)?.originalName } // Trường hợp update ID tạm
        : newBranchData;

    const apiCall = isUpdate ? sheetAPI.update(payload) : sheetAPI.create(payload);

    apiCall
      .then(() => {
         console.log("Synced to Sheet successfully");
      })
      .catch((err) => {
         console.error("Sync failed", err);
         alert("⚠️ Lỗi đồng bộ Google Sheet! Dữ liệu của bạn chỉ được lưu tạm trên máy này.\nChi tiết: " + err.message);
      });
  };

  const resetForm = () => {
    setFormData({ id: '', name: '', manager: '', address: '', phoneNumber: '', isActive: true, note: '' });
    setHolidayUI({ isEnabled: false, startDate: '', startTime: '00:00', endDate: '', endTime: '23:59', reason: '' });
    setAuthPassword('');
  };

  const handleCancelEdit = () => { setEditingId(null); resetForm(); };

  const filteredBranches = branches.filter(b => {
    const s = searchTerm.toLowerCase();
    return (b.name||"").toLowerCase().includes(s) || (b.address||"").toLowerCase().includes(s) || (b.manager||"").toLowerCase().includes(s);
  });

  return (
    <div className="bg-white md:rounded-xl shadow-2xl overflow-hidden border border-gray-200 animate-fade-in w-full h-full md:h-[90vh] md:max-w-6xl flex flex-col relative">
      <div className="bg-[#8B1E1E] px-4 py-3 md:px-6 md:py-4 flex justify-between items-center text-white flex-shrink-0 sticky top-0 z-50">
        <h2 className="text-lg md:text-xl font-bold font-brand uppercase tracking-wider truncate">Quản Lý Nhanh (Realtime)</h2>
        <div className="flex gap-2">
          {/* Nút Cấu hình URL */}
          <button 
             onClick={() => setShowConfig(!showConfig)} 
             className={`p-2 rounded-full transition-all border ${showConfig ? 'bg-white text-[#8B1E1E] border-white' : 'bg-white/10 hover:bg-white/20 text-white border-transparent'}`}
             title="Cấu hình kết nối Sheet"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"/>
            </svg>
          </button>
          
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      </div>

      {showConfig && (
        <div className="bg-gray-800 text-white p-4 border-b border-gray-600 animate-fade-in shadow-inner flex-shrink-0">
           <p className="text-xs text-gray-400 mb-1 uppercase font-bold">Google Apps Script URL (Exec Link):</p>
           <div className="flex flex-col gap-2">
             <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  value={scriptUrl} 
                  onChange={(e) => setScriptUrl(e.target.value)} 
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-[#D4AF37] outline-none" 
                  placeholder="https://script.google.com/macros/s/.../exec" 
                />
                <button 
                  onClick={handleCheckAndSaveUrl} 
                  disabled={isCheckingUrl}
                  className={`bg-[#D4AF37] hover:bg-[#b8962e] text-[#8B1E1E] font-bold px-4 py-2 rounded text-sm flex items-center gap-2 transition-all whitespace-nowrap ${isCheckingUrl ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {isCheckingUrl ? 'Test...' : 'Lưu'}
                </button>
             </div>
             {/* Status Message */}
             {urlCheckStatus.msg && (
                <div className={`text-xs font-bold p-2 rounded ${urlCheckStatus.type === 'success' ? 'bg-green-800 text-green-100' : 'bg-red-900 text-red-100'}`}>
                   {urlCheckStatus.msg}
                </div>
             )}
           </div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 md:gap-8 bg-gray-100 md:bg-white">
        
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-4 overflow-y-auto pr-0 md:pr-2 custom-scrollbar border-b md:border-b-0 md:border-r border-gray-200 bg-white order-2 lg:order-1" ref={formRef}>
           <div className={`p-4 md:p-5 relative transition-colors duration-300 ${editingId ? 'bg-amber-50' : 'bg-white'}`}>
              <h3 className={`text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2 ${editingId ? 'text-[#D4AF37]' : 'text-[#8B1E1E]'}`}>
                {editingId ? <span>✏️ Cập Nhật Chi Nhánh</span> : <span>➕ Thêm Chi Nhánh Mới</span>}
              </h3>
              
              <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200">
                  <span className="text-sm font-bold text-gray-700 uppercase">Hiển thị trên Web?</span>
                  <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-[#8B1E1E]"/>
                    <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.isActive ? 'bg-[#8B1E1E]' : 'bg-gray-300'}`}></label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên Chi Nhánh <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#8B1E1E]/20 outline-none text-base" required placeholder="VD: CN Đống Đa" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quản Lý</label>
                    <input type="text" value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="Tên QL"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SĐT</label>
                    <input type="tel" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="09xxxx"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Địa Chỉ <span className="text-red-500">*</span></label>
                  <textarea rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-[#8B1E1E]/20 outline-none text-base" required placeholder="Số nhà, đường, phường, quận..." />
                </div>

                {/* --- LỊCH NGHỈ --- */}
                <div className={`border rounded-lg p-3 ${holidayUI.isEnabled ? 'bg-red-50 border-red-200' : 'bg-white border-dashed border-gray-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#8B1E1E] uppercase flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Bếp nghỉ
                    </label>
                    <input type="checkbox" checked={holidayUI.isEnabled} onChange={handleToggleHoliday} className="w-5 h-5 accent-[#8B1E1E]" />
                  </div>
                  {holidayUI.isEnabled && (
                    <div className="space-y-3 text-sm animate-fade-in">
                       <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-500">Bắt đầu:</span> 
                          <div className="flex gap-2">
                             <input type="date" value={holidayUI.startDate} onChange={e => setHolidayUI({...holidayUI, startDate: e.target.value})} className="border p-2 rounded flex-1 bg-white"/> 
                             <TimePicker24h value={holidayUI.startTime} onChange={v => setHolidayUI({...holidayUI, startTime: v})}/>
                          </div>
                       </div>
                       <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-500">Kết thúc:</span>
                          <div className="flex gap-2">
                             <input type="date" value={holidayUI.endDate} onChange={e => setHolidayUI({...holidayUI, endDate: e.target.value})} className="border p-2 rounded flex-1 bg-white"/> 
                             <TimePicker24h value={holidayUI.endTime} onChange={v => setHolidayUI({...holidayUI, endTime: v})}/>
                          </div>
                       </div>
                       <input type="text" value={holidayUI.reason} onChange={e => setHolidayUI({...holidayUI, reason: e.target.value})} placeholder="Lý do nghỉ (VD: Sự cố điện)..." className="w-full border p-2 rounded bg-white"/>
                    </div>
                  )}
                </div>

                {/* --- THỐNG KÊ LỊCH SỬ (ĐÃ FIX: HIỂN THỊ RA UI) --- */}
                {editingId && Object.keys(editingStats).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Thống kê nghỉ phép:</label>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {Object.entries(editingStats).sort((a,b) => Number(b[0]) - Number(a[0])).map(([year, stat]: any) => (
                         <div key={year} className="bg-gray-50 rounded border border-gray-200 p-2 text-xs">
                            <div className="flex justify-between font-bold text-[#8B1E1E] mb-1">
                               <span>Năm {year}</span>
                               <span>Tổng: {stat.total} lần</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                               {Object.entries(stat.months).map(([m, c]) => (
                                  <span key={m} className="bg-white border px-1.5 rounded text-gray-600 font-medium">
                                    Tháng {m}: <span className="text-black">{c as any}</span>
                                  </span>
                               ))}
                            </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                 <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú (Nội bộ)</label>
                  <input type="text" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full p-2 border bg-yellow-50 rounded text-sm" placeholder="Ghi chú admin..." />
                </div>

                <div className="bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
                  <label className="block text-xs font-bold text-red-800 uppercase mb-1">Mật khẩu quản trị <span className="text-red-600">*</span></label>
                  <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Nhập pass để lưu..." className="w-full p-3 border border-red-200 rounded text-base font-bold" required />
                </div>

                <div className="flex gap-3 pt-2 pb-6 md:pb-0">
                   <button type="submit" className={`flex-1 text-white font-bold py-3.5 rounded-lg shadow-md transition-transform active:scale-95 text-sm uppercase flex items-center justify-center gap-2 ${editingId ? 'bg-[#D4AF37]' : 'bg-[#8B1E1E]'}`}>
                     {editingId ? <span>💾 Lưu Thay Đổi</span> : <span>➕ Thêm Mới</span>}
                   </button>
                   {editingId && <button type="button" onClick={handleCancelEdit} className="px-5 bg-gray-200 font-bold rounded-lg hover:bg-gray-300 text-sm">Hủy</button>}
                </div>
              </form>
           </div>
        </div>

        {/* RIGHT COLUMN: LIST */}
        <div className="lg:col-span-8 flex flex-col h-full overflow-hidden order-1 lg:order-2 bg-gray-50">
          <div className="p-3 md:p-4 bg-white border-b border-gray-200 flex gap-2 flex-shrink-0 sticky top-0 z-20 shadow-sm">
             <input type="text" placeholder="Tìm kiếm nhanh..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:border-[#8B1E1E] bg-gray-50 text-base" />
             <div className="bg-[#8B1E1E] text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center">{filteredBranches.length}</div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-0">
             {/* --- MOBILE VIEW: CARDS --- */}
             <div className="md:hidden space-y-3 pb-4">
               {filteredBranches.map(branch => {
                 // LOGIC HIỂN THỊ REALTIME: Nếu đã qua giờ nghỉ thì hiển thị Hoạt động
                 const isActuallyClosed = branch.holidaySchedule?.isEnabled 
                    && branch.holidaySchedule.endTime 
                    && (new Date(branch.holidaySchedule.endTime) > now); // So sánh với thời gian thực (now state)
                 
                 const isHidden = branch.isActive === false;

                 return (
                   <div key={branch.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.99] transition-transform ${isHidden ? 'opacity-60' : ''} ${editingId === branch.id ? 'ring-2 ring-[#D4AF37]' : ''}`} onClick={(e) => handleEdit(e, branch)}>
                     <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-[#8B1E1E] text-lg">{branch.name}</h4>
                        {isHidden ? <span className="bg-gray-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Đã Ẩn</span> : 
                         isActuallyClosed ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Đang Nghỉ</span> : 
                         <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Hoạt động</span>}
                     </div>
                     <p className="text-gray-600 text-sm mb-1 leading-snug">{branch.address}</p>
                     <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 font-medium">
                          {branch.manager} {branch.phoneNumber && `• ${branch.phoneNumber}`}
                        </div>
                        <div className="flex gap-3">
                           <button onClick={(e) => handleEdit(e, branch)} className="text-blue-600 font-bold text-xs uppercase px-2 py-1 bg-blue-50 rounded">Sửa</button>
                           <button onClick={(e) => handleDelete(e, branch.id)} className="text-red-600 font-bold text-xs uppercase px-2 py-1 bg-red-50 rounded">Xóa</button>
                        </div>
                     </div>
                   </div>
                 )
               })}
             </div>

             {/* --- DESKTOP VIEW: TABLE --- */}
             <table className="w-full text-sm text-left border-collapse table-fixed hidden md:table">
                 <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs sticky top-0 shadow-sm z-10">
                   <tr>
                     <th className="px-4 py-3 border-b w-[30%]">Tên / Quản Lý</th>
                     <th className="px-4 py-3 border-b w-[40%]">Địa Chỉ</th>
                     <th className="px-4 py-3 border-b text-center w-[15%]">TT</th>
                     <th className="px-4 py-3 border-b text-right w-[15%]">#</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white">
                   {filteredBranches.map(branch => {
                     // LOGIC HIỂN THỊ REALTIME
                     const isActuallyClosed = branch.holidaySchedule?.isEnabled 
                        && branch.holidaySchedule.endTime 
                        && (new Date(branch.holidaySchedule.endTime) > now);

                     const isHidden = branch.isActive === false;
                     return (
                       <tr key={branch.id} className={`hover:bg-amber-50 group cursor-pointer ${editingId === branch.id ? 'bg-amber-100' : ''} ${isHidden ? 'opacity-50' : ''}`} onClick={(e) => handleEdit(e, branch)}>
                         <td className="px-4 py-3 align-top">
                           <div className="font-bold text-[#8B1E1E] text-base">{branch.name}</div>
                           <div className="text-xs text-gray-500 mt-1">{branch.manager} - {branch.phoneNumber}</div>
                         </td>
                         <td className="px-4 py-3 text-sm text-gray-600 align-top">{branch.address}</td>
                         <td className="px-4 py-3 text-center align-top">
                           {isHidden ? <span className="bg-gray-200 px-2 py-1 rounded text-[10px] font-bold">ẨN</span> : 
                            isActuallyClosed ? <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold">NGHỈ</span> : 
                            <span className="text-green-600 text-[10px] font-bold border border-green-200 px-2 py-1 rounded">BẬT</span>}
                         </td>
                         <td className="px-4 py-3 text-right align-top">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => handleEdit(e, branch)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Sửa"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <button onClick={(e) => handleDelete(e, branch.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Xóa"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                         </td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
          </div>
        </div>
      </div>
    </div>
  );
};