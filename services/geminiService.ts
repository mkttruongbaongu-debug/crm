import { RAW_BRANCH_DATA } from "../constants";
import { Branch } from "../types";

// --- STRING UTILITIES ---

export const normalizeString = (str: string): string => {
  if (!str) return "";
  let result = str.toLowerCase().trim();
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  result = result.replace(/đ/g, "d");
  result = result.replace(/[^a-z0-9\s]/g, " ");
  return result.replace(/\s+/g, " ").trim();
};

export const normalizePhoneNumber = (phone: any): string => {
  if (!phone) return "";
  let str = String(phone).trim();
  str = str.replace(/[^\d]/g, '');
  if (str.length === 9 && !str.startsWith('0')) return '0' + str;
  if (str.startsWith('84') && str.length > 9) return '0' + str.substring(2);
  return str;
};

export const generateBranchSearchStr = (name: string, address: string, phone: string): string => {
  return normalizeString(`${name} ${address} ${phone}`);
};

export const parseInitialBranchData = (): Branch[] => {
  const lines = RAW_BRANCH_DATA.split('\n').filter(line => line.trim() !== '');
  const branches: Branch[] = [];
  lines.forEach((line, index) => {
    let parts = line.split('\t');
    if (parts.length < 3) {
      const match = line.match(/^(.+?)\s+((?:Chị|Anh|Cô|Chú|Thúy|Thu|Linh|Hoàng|Tổ|Kho|Nhà xe).+?)\s+(.+)$/);
      if (match) parts = [match[1], match[2], match[3]];
      else return; 
    }
    const name = parts[0]?.trim();
    const manager = parts[1]?.trim();
    let address = parts[2]?.trim();
    if (address?.startsWith('"') && address?.endsWith('"')) address = address.slice(1, -1);
    if (name && address) {
      branches.push({
        id: `init-${index}-${Date.now()}`,
        name, manager: manager || "Quản lý kho", address,
        phoneNumber: "",
        searchStr: normalizeString(`${name} ${address}`),
        holidaySchedule: { isEnabled: false, startTime: "", endTime: "" },
        holidayHistory: [], isActive: true, note: "", updatedAt: new Date().toISOString()
      });
    }
  });
  return branches;
};