import { GoogleGenAI, Type } from "@google/genai";
import { RAW_BRANCH_DATA } from "../constants";
import { BranchResult, Branch } from "../types";

// --- 1. CONFIGURATION ---
const MODEL_NAME = "gemini-2.5-flash";

// --- 2. TỪ ĐIỂN ĐỊA LÝ & HÀM CHUẨN HÓA ---

const STOP_WORDS = [
  "thanh pho", "tinh", "quan", "huyen", "thi xa", "thi tran", "phuong", "xa", "ap", 
  "duong", "so", "nha", "ngo", "ngach", "hem", "khu pho", "to", "viet nam", "vn"
];

const CONFUSING_WORDS = ["hue", "ho chi minh", "thai binh", "nam dinh", "hung yen", "cao bang", "lang son"];

// MAPPING QUAN TRỌNG ĐỂ TỐI ƯU TỐC ĐỘ (ALIAS MAP)
const GEO_ALIASES: Record<string, string> = {
  // ==================== MIỀN NAM ====================
  "sai gon": "ho chi minh", "hcm": "ho chi minh", "tphcm": "ho chi minh",
  "thu duc": "ho chi minh", "go vap": "ho chi minh", "binh tan": "ho chi minh", "binh chanh": "ho chi minh",
  "hoc mon": "ho chi minh", "cu chi": "ho chi minh", "nha be": "nha be", "quan 1": "ho chi minh",
  "quan 2": "ho chi minh", "quan 3": "ho chi minh", "quan 4": "ho chi minh", "quan 5": "ho chi minh",
  "quan 6": "ho chi minh", "quan 9": "ho chi minh", "quan 10": "ho chi minh", "quan 11": "ho chi minh",
  "quan 12": "ho chi minh", "nguyen hue": "ho chi minh", "bui vien": "ho chi minh", "ben thanh": "ho chi minh",
  
  // Mapping Kho HCM Cụ Thể
  "binh thanh": "binh thanh", "hang xanh": "binh thanh", "thanh da": "binh thanh", "dien bien phu": "binh thanh",
  "xo viet nghe tinh": "binh thanh", "nguyen xi": "binh thanh", "pham van dong": "binh thanh", "ung van khiem": "binh thanh",
  "le quang dinh": "binh thanh", "no trang long": "binh thanh",
  "phu nhuan": "phu nhuan", "phan xich long": "phu nhuan", "nguyen van troi": "phu nhuan", "hoang van thu": "phu nhuan",
  "le van sy": "phu nhuan", "tran huy lieu": "phu nhuan", "nguyen kiem": "phu nhuan",
  "quan 7": "quan 7", "phu my hung": "quan 7", "tan thuan": "quan 7", "nguyen van linh": "quan 7",
  "nguyen thi thap": "quan 7", "huynh tan phat": "quan 7", "le van luong": "quan 7", "him lam": "quan 7",
  "quan 8": "quan 8", "pham the hien": "quan 8", "ta quang buu": "quan 8", "au duong lan": "quan 8", "duong ba trac": "quan 8", "hung phu": "quan 8",
  "tan phu": "tan phu", "tan son nhi": "tan phu", "tay thanh": "tan phu", "luy ban bich": "tan phu", "tan ky tan quy": "tan phu",
  "vuon lai": "tan phu", "duong hoa binh": "tan phu", "le trong tan": "tan phu",

  // Các tỉnh Miền Nam
  "di an": "binh duong", "thuan an": "binh duong", "ben cat": "binh duong", "tan uyen": "binh duong", "bau bang": "binh duong",
  "thu dau mot": "thu dau mot", "dai lo binh duong": "thu dau mot", "thanh pho moi": "thu dau mot",
  "bien hoa": "bien hoa", "nga 3 vung tau": "bien hoa", "amata": "bien hoa", "tam hiep": "bien hoa", "tan mai": "bien hoa",
  "trang bom": "bien hoa", "long khanh": "long khanh", "dinh quan": "dinh quan", "la nga": "dinh quan", "tan phu dong nai": "dinh quan",
  "long thanh": "bien hoa", "nhon trach": "bien hoa",
  "vung tau": "vung tau", "ba ria": "vung tau", "phu my": "vung tau", "long hai": "vung tau", "chau duc": "vung tau", "xuyen moc": "vung tau",
  "bai truoc": "vung tau", "bai sau": "vung tau", "thuy van": "vung tau",
  "tay ninh": "tay ninh", "hoa thanh": "tay ninh", "trang bang": "tay ninh", "go dau": "tay ninh",
  "moc bai": "moc bai", "ben cau": "moc bai", "tan chau": "tan chau",
  
  // Miền Tây
  "can tho": "can tho", "ninh kieu": "can tho", "cai rang": "can tho", "binh thuy": "can tho", "o mon": "can tho",
  "ben ninh kieu": "can tho", "dai lo hoa binh": "can tho",
  "tien giang": "my tho", "my tho": "my tho", "cai lay": "cai lay", "cai be": "cai lay", "cho gao": "my tho", "go cong": "tien giang",
  "ben tre": "ben tre", "chau thanh ben tre": "ben tre", "mo cay": "ben tre",
  "vinh long": "vinh long", "tra vinh": "tra vinh",
  "dong thap": "cao lanh", "cao lanh": "cao lanh", "sa dec": "sa dec", "hong ngu": "hong ngu",
  "an giang": "long xuyen", "long xuyen": "long xuyen", "chau doc": "long xuyen",
  "kien giang": "rach gia", "rach gia": "rach gia", "ha tien": "rach gia", "phu quoc": "rach gia",
  "ca mau": "ca mau", "nam can": "ca mau", "bac lieu": "ca mau", "soc trang": "soc trang",
  "hau giang": "vi thanh", "vi thanh": "vi thanh", "nga bay": "vi thanh",

  // ==================== MIỀN TRUNG & TÂY NGUYÊN ====================
  "da nang": "da nang", "hai chau": "da nang", "son tra": "da nang", "ngu hanh son": "da nang",
  // Mapping ĐN chi tiết
  "thanh khe": "lien chieu", "lien chieu": "lien chieu", "nguyen sinh sac": "lien chieu", "hoang thi loan": "lien chieu", 
  "ton duc thang": "lien chieu", "nguyen luong bang": "lien chieu", "au co": "lien chieu", "kinh duong vuong": "lien chieu",
  "cam le": "cam le", "truong chinh": "cam le", "cach mang thang 8": "cam le", "thang long": "cam le", 
  "nguyen huu tho": "cam le", "pham hung": "cam le",
  "hoa vang": "hoa vang", "hoa xuan": "hoa xuan", "vo chi cong": "hoa xuan",
  
  "thua thien hue": "hue", "hue": "hue", "vi da": "hue", "kim long": "hue", "phu hoi": "hue", "xuan phu": "hue",
  "quang nam": "tam ky", "tam ky": "tam ky", "hoi an": "tam ky", "dien ban": "tam ky",
  "quang ngai": "quang ngai",
  "binh dinh": "quy nhon", "quy nhon": "quy nhon", "an nhon": "quy nhon",
  "phu yen": "tuy hoa", "tuy hoa": "tuy hoa",
  "khanh hoa": "nha trang", "nha trang": "nha trang", "cam ranh": "cam ranh", "dien khanh": "nha trang", "tran phu nha trang": "nha trang",
  "ninh thuan": "phan rang", "phan rang": "phan rang", "thap cham": "phan rang",
  "binh thuan": "phan thiet", "phan thiet": "phan thiet", "mui ne": "phan thiet", "lagi": "phan thiet",
  "quang tri": "dong ha", "dong ha": "dong ha", "quang binh": "dong ha", "dong hoi": "dong ha",
  "nghe an": "vinh", "vinh": "vinh", "cua lo": "vinh",
  "thanh hoa": "thanh hoa", "sam son": "thanh hoa",

  // Tây Nguyên
  "lam dong": "da lat", "da lat": "da lat", "bao loc": "bao loc", "duc trong": "da lat", "lam ha": "da lat", "ho xuan huong": "da lat",
  "dak lak": "buon ma thuot", "buon ma thuot": "buon ma thuot", "bmt": "buon ma thuot", "nga sau": "buon ma thuot",
  "gia lai": "pleiku", "pleiku": "pleiku", "kon tum": "kon tum", "dak nong": "buon ma thuot",

  // ==================== MIỀN BẮC ====================
  "ha noi": "ha noi", "cau giay": "ha noi", "thanh xuan": "ha noi", "dong da": "ha noi", "ba dinh": "ha noi",
  "hoan kiem": "ha noi", "hai ba trung": "ha noi", "hoang mai": "ha noi", "long bien": "ha noi", "tay ho": "ha noi",
  "bac tu liem": "ha noi", "nam tu liem": "ha noi", "ha dong": "ha noi", "son tay": "ha noi",
  "lang ha": "ha noi", "nguyen chi thanh": "ha noi", "xuan thuy": "ha noi", "ho tung mau": "ha noi", 
  "kim ma": "ha noi", "xa dan": "ha noi", "pho hue": "ha noi",

  "hai phong": "hai phong", "hong bang": "hai phong", "ngo quyen": "hai phong", "le chan": "hai phong",
  "hai an": "hai phong", "kien an": "hai phong", "do son": "hai phong", "thuy nguyen": "hai phong", 
  "lach tray": "hai phong", "le hong phong hai phong": "hai phong",

  "quang ninh": "ha long", "ha long": "ha long", "bai chay": "ha long", "hon gai": "ha long",
  "cam pha": "ha long", "uong bi": "uong bi", "mong cai": "mong cai",
  "hai duong": "hai duong", "hung yen": "hung yen", "ecopark": "hung yen",
  "bac ninh": "bac ninh", "tu son": "tu son", "yen phong": "bac ninh",
  "vinh phuc": "vinh yen", "vinh yen": "vinh yen", "phuc yen": "vinh yen", "tam dao": "vinh yen",
  "thai nguyen": "thai nguyen", "song cong": "thai nguyen", "bac giang": "bac ninh",
  "thai binh": "thai binh", "nam dinh": "nam dinh", "ninh binh": "hoa lu", "hoa lu": "hoa lu", "tam diep": "hoa lu",
  "lao cai": "lao cai", "sapa": "lao cai", "yen bai": "yen bai", "tuyen quang": "tuyen quang",
  "son la": "son la", "moc chau": "son la", "lang son": "lang son", "hoa binh": "hoa binh",
  "ha nam": "nam dinh", "phu tho": "vinh yen"
};

// Sort sẵn keys để dùng nhiều lần, tối ưu perf
const SORTED_ALIAS_KEYS = Object.keys(GEO_ALIASES).sort((a, b) => b.length - a.length);

// THUẬT TOÁN LEVENSHTEIN (Tính khoảng cách chỉnh sửa giữa 2 chuỗi)
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

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

const removeStopWords = (text: string): string => {
  let processed = text;
  STOP_WORDS.forEach(word => {
    processed = processed.replace(new RegExp(`\\b${word}\\b`, 'g'), " ");
  });
  return processed.replace(/\s+/g, " ").trim();
};

const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

export const generateBranchSearchStr = (name: string, address: string, phone: string): string => {
  return normalizeString(`${name} ${address} ${phone}`);
};

// --- 3. PARSE DỮ LIỆU ---

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
        name,
        manager: manager || "Quản lý kho",
        address,
        phoneNumber: "",
        searchStr: normalizeString(`${name} ${address}`),
        // KHỞI TẠO ĐẦY ĐỦ CÁC TRƯỜNG, BAO GỒM LỊCH SỬ NGHỈ
        holidaySchedule: { isEnabled: false, startTime: "", endTime: "" },
        holidayHistory: [], 
        isActive: true,
        note: "",
        updatedAt: new Date().toISOString()
      });
    }
  });
  return branches;
};

// --- 4. TÌM KIẾM CỤC BỘ (TỐC ĐỘ CAO - HYBRID ALIAS + FUZZY) ---

const findLocalMatch = (customerAddress: string, activeBranches: Branch[]): { branch: Branch, score: number, reason: string } | null => {
  const normalizedQuery = normalizeString(customerAddress);
  
  // Mở rộng truy vấn bằng Alias (VD: Go Cong -> Go Cong Tien Giang)
  let expandedQuery = normalizedQuery;
  let aliasMatch = "";
  let aliasKeyword = ""; 

  // Dùng danh sách key đã sort sẵn
  for (const key of SORTED_ALIAS_KEYS) {
    if (normalizedQuery.includes(key)) {
      const mappedValue = GEO_ALIASES[key];
      expandedQuery += " " + mappedValue;
      aliasMatch = mappedValue;
      aliasKeyword = key;
      break; // Chỉ lấy 1 alias quan trọng nhất (Longest Match)
    }
  }

  const queryTokens = removeStopWords(expandedQuery).split(" ");
  
  let bestBranch: Branch | null = null;
  let maxScore = 0;

  for (const branch of activeBranches) {
    let score = 0;
    const branchStr = branch.searchStr;
    const branchWords = branchStr.split(" "); // Tách từ trong chuỗi tìm kiếm của chi nhánh

    // Alias Match -> Điểm siêu cao (Chốt đơn ngay)
    if (aliasMatch && branchStr.includes(aliasMatch)) {
      score += 500;
    }

    // Token Match (Kết hợp Exact + Fuzzy)
    for (const token of queryTokens) {
      if (token.length < 2) continue; 
      
      // 1. Exact Match (Nhanh và Chính xác nhất)
      if (branchStr.includes(token)) {
        score += CONFUSING_WORDS.includes(token) ? 5 : 10;
        continue;
      }

      // 2. Fuzzy Match (Chỉ áp dụng cho từ có độ dài >= 4 để tránh nhiễu)
      if (token.length >= 4) {
         for (const word of branchWords) {
             // Tối ưu: Nếu độ dài chênh lệch > 2 ký tự thì bỏ qua luôn (khỏi tính Levenshtein tốn kém)
             if (Math.abs(word.length - token.length) > 2) continue;
             
             const dist = getLevenshteinDistance(token, word);
             // Cho phép sai 1 ký tự với từ < 6 ký tự, sai 2 ký tự với từ dài hơn
             const allowedErrors = token.length > 6 ? 2 : 1;
             
             if (dist <= allowedErrors) {
                 score += 7; // Điểm thấp hơn Exact match (10) nhưng vẫn cao
                 break; // Chỉ cộng 1 lần cho mỗi token
             }
         }
      }
    }
    
    // Phrase Match (2 từ liên tiếp - Exact)
    for (let i = 0; i < queryTokens.length - 1; i++) {
        const phrase = queryTokens[i] + " " + queryTokens[i+1];
        if (branchStr.includes(phrase)) {
            score += 30;
        }
    }

    if (score > maxScore) {
      maxScore = score;
      bestBranch = branch;
    }
  }
  
  // Logic chặn Local (Force AI) nếu cần thiết
  const threshold = aliasMatch ? 100 : 35; // Giảm threshold một chút vì Fuzzy match điểm thấp hơn Exact

  if (bestBranch && maxScore >= threshold) {
     const hasNumber = /\d/.test(customerAddress);
     const inputMeaningfulTokens = queryTokens.filter(t => t.length > 2);
     
     let matchedCount = 0;
     inputMeaningfulTokens.forEach(t => {
       // Check lỏng hơn một chút cho matchedCount (chấp nhận cả fuzzy)
       const isExact = bestBranch!.searchStr.includes(t);
       if (isExact) {
          matchedCount++;
       } else if (t.length >= 4) {
          const branchWords = bestBranch!.searchStr.split(" ");
          for (const word of branchWords) {
             if (Math.abs(word.length - t.length) <= 2 && getLevenshteinDistance(t, word) <= (t.length > 6 ? 2 : 1)) {
               matchedCount++; break;
             }
          }
       }
     });
     
     const matchRatio = inputMeaningfulTokens.length > 0 ? (matchedCount / inputMeaningfulTokens.length) : 0;

     // Chỉ Force AI nếu có số nhà cụ thể mà tỷ lệ khớp từ quá thấp VÀ không có Alias
     if (hasNumber && matchRatio < 0.4 && !aliasMatch) {
        console.log("Local match rejected (Force AI). Score:", maxScore, "Ratio:", matchRatio);
        return null; 
     }

     const reason = aliasMatch 
        ? `Đã tìm thấy kho tại khu vực ${aliasMatch.toUpperCase()} (Khớp từ khóa: ${aliasKeyword})`
        : `Tìm thấy kho có địa chỉ trùng khớp với từ khóa bạn nhập.`;
     
     return { branch: bestBranch, score: maxScore, reason };
  }

  return null;
};

// --- 5. TÌM KIẾM CHÍNH (HYBRID) ---

export const findNearestBranch = async (customerAddress: string, branches: Branch[]): Promise<BranchResult> => {
  if (!branches?.length) throw new Error("Chưa có dữ liệu chi nhánh.");
  const activeBranches = branches.filter(b => b.isActive !== false);
  if (!activeBranches.length) throw new Error("Không có chi nhánh nào đang hoạt động.");

  // --- BƯỚC 1: TRA CỨU CỤC BỘ (SIÊU TỐC - CÓ FUZZY SEARCH) ---
  const localResult = findLocalMatch(customerAddress, activeBranches);

  if (localResult) {
    console.log("Local match used (FAST):", localResult.branch.name);
    return {
        branchName: localResult.branch.name,
        managerName: localResult.branch.manager,
        branchAddress: localResult.branch.address,
        phoneNumber: localResult.branch.phoneNumber, 
        reasoning: localResult.reason,
        estimatedDistance: "Gần nhất (Tra cứu nhanh)", 
        customerAddressOriginal: customerAddress,
        holidaySchedule: localResult.branch.holidaySchedule,
        searchSource: 'INSTANT'
    };
  }

  // --- BƯỚC 2: AI FALLBACK ---
  if (!process.env.API_KEY) {
    throw new Error("Không tìm thấy địa chỉ phù hợp (Và thiếu API Key để tra cứu nâng cao).");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // FIX: SỬ DỤNG SHORT ID MAPPING
  // Map các ID phức tạp thành số thứ tự đơn giản (1, 2, 3...) để AI dễ xử lý
  const shortIdMap = new Map<string, Branch>();
  const branchesListText = activeBranches.map((b, idx) => {
    const shortId = String(idx + 1);
    shortIdMap.set(shortId, b);
    return `ID: ${shortId} | Name: ${b.name} | Address: ${b.address}`;
  }).join("\n");

  const prompt = `
    Find the closest warehouse for: "${customerAddress}"
    List:
    ${branchesListText}
    
    Instructions:
    1. Identify the location of the user address.
    2. Identify the location of each warehouse.
    3. Calculate approximated driving distance.
    4. Select the warehouse with the SHORTEST distance.
    5. VERY IMPORTANT: If the user provides a specific street address, prioritize physical proximity over name matching.
    
    Return JSON:
    {
      "selectedBranchId": "string (MUST be the exact ID number from the list above, e.g. '1', '10')",
      "estimatedDistance": "string",
      "reasoning": "string (Vietnamese)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedBranchId: { type: Type.STRING },
            estimatedDistance: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
        },
      },
    });

    const resultJson = JSON.parse(cleanJsonString(response.text || "{}"));
    
    // Tìm branch dựa trên Short ID map thay vì ID gốc
    const bestBranch = shortIdMap.get(String(resultJson.selectedBranchId));

    if (!bestBranch) {
        console.error("AI returned invalid ID:", resultJson.selectedBranchId);
        throw new Error("AI không thể xác định chi nhánh cụ thể.");
    }

    return {
      branchName: bestBranch.name,
      managerName: bestBranch.manager,
      branchAddress: bestBranch.address,
      phoneNumber: bestBranch.phoneNumber, 
      reasoning: resultJson.reasoning || "Đề xuất bởi AI.",
      estimatedDistance: resultJson.estimatedDistance,
      customerAddressOriginal: customerAddress,
      holidaySchedule: bestBranch.holidaySchedule,
      searchSource: 'AI'
    };

  } catch (error: any) {
    console.error("AI Error:", error);
    // Thông báo lỗi thân thiện hơn
    throw new Error("Không tìm thấy kho phù hợp. Vui lòng nhập rõ Quận/Huyện, Tỉnh/Thành phố.");
  }
};