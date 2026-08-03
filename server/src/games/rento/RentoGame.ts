import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

interface Property {
  id: number;
  name: string;
  nameAr: string;
  color: string;
  price: number;
  rent: number[];
  type: "property" | "tax" | "chest" | "chance" | "start" | "jail" | "go" | "parking" | "utility";
  flag?: string;
}

interface TradeProposal {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerProperties: number[];
  offerMoney: number;
  requestProperties: number[];
  requestMoney: number;
  status: "pending" | "accepted" | "rejected";
}

export type MapId = "middle_east" | "europe" | "americas";

export const BACKGROUND_IDS = ["nebula", "ocean", "sunset", "emerald"] as const;

// 40-tile rectangular perimeter board with Middle Eastern cities
const MIDDLE_EAST_BOARD: Property[] = [
  // Bottom row (left → right): positions 0-10
  { id: 0,  name: "GO",            nameAr: "ابدأ",           color: "#22c55e", price: 0,   rent: [],                          type: "start" },
  { id: 1,  name: "Riyadh",        nameAr: "الرياض",         color: "#92400e", price: 60,  rent: [2, 10, 30, 90, 160, 250],   type: "property", flag: "SA" },
  { id: 2,  name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                          type: "chest" },
  { id: 3,  name: "Jeddah",        nameAr: "جدة",            color: "#92400e", price: 60,  rent: [4, 20, 60, 180, 320, 450],  type: "property", flag: "SA" },
  { id: 4,  name: "Income Tax",    nameAr: "ضريبة الدخل",    color: "#ef4444", price: 0,   rent: [],                          type: "tax" },
  { id: 5,  name: "Riyadh Station",nameAr: "محطة الرياض",    color: "#6b7280", price: 200, rent: [25, 50, 100, 200],          type: "property" },
  { id: 6,  name: "Cairo",         nameAr: "القاهرة",         color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "EG" },
  { id: 7,  name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                          type: "chance" },
  { id: 8,  name: "Alexandria",    nameAr: "الإسكندرية",      color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "EG" },
  { id: 9,  name: "Luxor",         nameAr: "الأقصر",          color: "#2563eb", price: 120, rent: [8, 40, 100, 300, 450, 600], type: "property", flag: "EG" },
  { id: 10, name: "Jail",          nameAr: "سجن",            color: "#6b7280", price: 0,   rent: [],                          type: "jail" },

  // Right column (bottom → top): positions 11-19
  { id: 11, name: "Dubai",         nameAr: "دبي",            color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "AE" },
  { id: 12, name: "Abu Dhabi",     nameAr: "أبو ظبي",        color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "AE" },
  { id: 13, name: "Water Works",   nameAr: "المياه",          color: "#06b6d4", price: 150, rent: [4, 10],                       type: "utility" },
  { id: 14, name: "Istanbul",      nameAr: "إسطنبول",         color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "TR" },
  { id: 15, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                            type: "chance" },
  { id: 16, name: "Ankara",        nameAr: "أنقرة",           color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "TR" },
  { id: 17, name: "Antalya",       nameAr: "أنطاليا",         color: "#ea580c", price: 200, rent: [16, 80, 220, 600, 800, 1000], type: "property", flag: "TR" },
  { id: 18, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                            type: "chest" },
  { id: 19, name: "Baghdad",       nameAr: "بغداد",           color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "IQ" },

  // Top row (right → left): positions 20-30
  { id: 20, name: "Free Parking",  nameAr: "وقوف مجاني",     color: "#8b5cf6", price: 0,   rent: [],                            type: "parking" },
  { id: 21, name: "Basra",         nameAr: "البصرة",          color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "IQ" },
  { id: 22, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                             type: "chest" },
  { id: 23, name: "Istanbul Airport", nameAr: "مطار إسطنبول", color: "#6b7280", price: 200, rent: [25, 50, 100, 200],             type: "property" },
  { id: 24, name: "Casablanca",    nameAr: "الدار البيضاء",   color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "MA" },
  { id: 25, name: "Marrakech",     nameAr: "مراكش",           color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "MA" },
  { id: 26, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                             type: "chance" },
  { id: 27, name: "Fez",           nameAr: "فاس",             color: "#eab308", price: 280, rent: [24, 120, 360, 850, 1025, 1200],type: "property", flag: "MA" },
  { id: 28, name: "Doha",          nameAr: "الدوحة",          color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "QA" },
  { id: 29, name: "Kuwait City",   nameAr: "الكويت",          color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "KW" },
  { id: 30, name: "Go To Jail",    nameAr: "اذهب للسجن",      color: "#6b7280", price: 0,   rent: [],                             type: "jail" },

  // Left column (top → bottom): positions 31-39
  { id: 31, name: "Muscat",        nameAr: "مسقط",            color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "OM" },
  { id: 32, name: "Amman",         nameAr: "عمّان",            color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "JO" },
  { id: 33, name: "Electric Company", nameAr: "الكهرباء",     color: "#06b6d4", price: 150, rent: [4, 10],                          type: "utility" },
  { id: 34, name: "Beirut",        nameAr: "بيروت",           color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "LB" },
  { id: 35, name: "Tripoli",       nameAr: "طرابلس",          color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "LY" },
  { id: 36, name: "Chance",        nameAr: "فرصة",             color: "#f59e0b", price: 0,   rent: [],                                type: "chance" },
  { id: 37, name: "Tunis",         nameAr: "تونس",             color: "#a855f7", price: 420, rent: [32, 170, 480, 1050, 1250, 1500], type: "property", flag: "TN" },
  { id: 38, name: "Chest",         nameAr: "صندوق",           color: "#3b82f6", price: 0,   rent: [],                                type: "chest" },
  { id: 39, name: "Algiers",       nameAr: "الجزائر",          color: "#a855f7", price: 450, rent: [35, 180, 500, 1100, 1300, 1550], type: "property", flag: "DZ" },
];

// 40-tile rectangular perimeter board with European cities
const EUROPE_BOARD: Property[] = [
  { id: 0,  name: "GO",            nameAr: "ابدأ",           color: "#22c55e", price: 0,   rent: [],                          type: "start" },
  { id: 1,  name: "Moscow",        nameAr: "موسكو",          color: "#92400e", price: 60,  rent: [2, 10, 30, 90, 160, 250],   type: "property", flag: "RU" },
  { id: 2,  name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                          type: "chest" },
  { id: 3,  name: "St. Petersburg",nameAr: "سانت بطرسبرغ",    color: "#92400e", price: 60,  rent: [4, 20, 60, 180, 320, 450],  type: "property", flag: "RU" },
  { id: 4,  name: "Income Tax",    nameAr: "ضريبة الدخل",    color: "#ef4444", price: 0,   rent: [],                          type: "tax" },
  { id: 5,  name: "Gare du Nord",  nameAr: "محطة الشمال",    color: "#6b7280", price: 200, rent: [25, 50, 100, 200],          type: "property" },
  { id: 6,  name: "Madrid",        nameAr: "مدريد",          color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "ES" },
  { id: 7,  name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                          type: "chance" },
  { id: 8,  name: "Barcelona",     nameAr: "برشلونة",         color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "ES" },
  { id: 9,  name: "Seville",       nameAr: "إشبيلية",         color: "#2563eb", price: 120, rent: [8, 40, 100, 300, 450, 600], type: "property", flag: "ES" },
  { id: 10, name: "Jail",          nameAr: "سجن",            color: "#6b7280", price: 0,   rent: [],                          type: "jail" },

  { id: 11, name: "Amsterdam",     nameAr: "أمستردام",        color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "NL" },
  { id: 12, name: "Rotterdam",     nameAr: "روتردام",         color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "NL" },
  { id: 13, name: "Rhine Water Co.", nameAr: "مياه الراين",   color: "#06b6d4", price: 150, rent: [4, 10],                       type: "utility" },
  { id: 14, name: "Berlin",        nameAr: "برلين",           color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "DE" },
  { id: 15, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                            type: "chance" },
  { id: 16, name: "Munich",        nameAr: "ميونخ",           color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "DE" },
  { id: 17, name: "Hamburg",       nameAr: "هامبورغ",         color: "#ea580c", price: 200, rent: [16, 80, 220, 600, 800, 1000], type: "property", flag: "DE" },
  { id: 18, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                            type: "chest" },
  { id: 19, name: "Rome",          nameAr: "روما",            color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "IT" },

  { id: 20, name: "Free Parking",  nameAr: "وقوف مجاني",     color: "#8b5cf6", price: 0,   rent: [],                            type: "parking" },
  { id: 21, name: "Milan",         nameAr: "ميلانو",          color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "IT" },
  { id: 22, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                             type: "chest" },
  { id: 23, name: "Heathrow",      nameAr: "مطار هيثرو",      color: "#6b7280", price: 200, rent: [25, 50, 100, 200],             type: "property" },
  { id: 24, name: "Paris",         nameAr: "باريس",           color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "FR" },
  { id: 25, name: "Lyon",          nameAr: "ليون",            color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "FR" },
  { id: 26, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                             type: "chance" },
  { id: 27, name: "Marseille",     nameAr: "مرسيليا",         color: "#eab308", price: 280, rent: [24, 120, 360, 850, 1025, 1200],type: "property", flag: "FR" },
  { id: 28, name: "London",        nameAr: "لندن",            color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "GB" },
  { id: 29, name: "Manchester",    nameAr: "مانشستر",         color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "GB" },
  { id: 30, name: "Go To Jail",    nameAr: "اذهب للسجن",      color: "#6b7280", price: 0,   rent: [],                             type: "jail" },

  { id: 31, name: "Athens",        nameAr: "أثينا",           color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "GR" },
  { id: 32, name: "Thessaloniki",  nameAr: "سالونيك",         color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "GR" },
  { id: 33, name: "EuroGrid Electric", nameAr: "كهرباء أوروبا", color: "#06b6d4", price: 150, rent: [4, 10],                        type: "utility" },
  { id: 34, name: "Dublin",        nameAr: "دبلن",            color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "IE" },
  { id: 35, name: "Frankfurt",     nameAr: "فرانكفورت",       color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "DE" },
  { id: 36, name: "Chance",        nameAr: "فرصة",             color: "#f59e0b", price: 0,   rent: [],                                type: "chance" },
  { id: 37, name: "Valencia",      nameAr: "فالنسيا",         color: "#a855f7", price: 420, rent: [32, 170, 480, 1050, 1250, 1500], type: "property", flag: "ES" },
  { id: 38, name: "Chest",         nameAr: "صندوق",           color: "#3b82f6", price: 0,   rent: [],                                type: "chest" },
  { id: 39, name: "Naples",        nameAr: "نابولي",          color: "#a855f7", price: 450, rent: [35, 180, 500, 1100, 1300, 1550], type: "property", flag: "IT" },
];

// 40-tile rectangular perimeter board with cities of the Americas
const AMERICAS_BOARD: Property[] = [
  { id: 0,  name: "GO",            nameAr: "ابدأ",           color: "#22c55e", price: 0,   rent: [],                          type: "start" },
  { id: 1,  name: "Bogotá",        nameAr: "بوغوتا",          color: "#92400e", price: 60,  rent: [2, 10, 30, 90, 160, 250],   type: "property", flag: "CO" },
  { id: 2,  name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                          type: "chest" },
  { id: 3,  name: "Lima",          nameAr: "ليما",            color: "#92400e", price: 60,  rent: [4, 20, 60, 180, 320, 450],  type: "property", flag: "PE" },
  { id: 4,  name: "Income Tax",    nameAr: "ضريبة الدخل",    color: "#ef4444", price: 0,   rent: [],                          type: "tax" },
  { id: 5,  name: "Union Station", nameAr: "محطة الاتحاد",    color: "#6b7280", price: 200, rent: [25, 50, 100, 200],          type: "property" },
  { id: 6,  name: "Mexico City",   nameAr: "مكسيكو سيتي",     color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "MX" },
  { id: 7,  name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                          type: "chance" },
  { id: 8,  name: "Guadalajara",   nameAr: "غوادالاخارا",      color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property", flag: "MX" },
  { id: 9,  name: "Monterrey",     nameAr: "مونتيري",         color: "#2563eb", price: 120, rent: [8, 40, 100, 300, 450, 600], type: "property", flag: "MX" },
  { id: 10, name: "Jail",          nameAr: "سجن",            color: "#6b7280", price: 0,   rent: [],                          type: "jail" },

  { id: 11, name: "Toronto",       nameAr: "تورنتو",           color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "CA" },
  { id: 12, name: "Vancouver",     nameAr: "فانكوفر",          color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property", flag: "CA" },
  { id: 13, name: "Amazon Water Co.", nameAr: "مياه الأمازون", color: "#06b6d4", price: 150, rent: [4, 10],                       type: "utility" },
  { id: 14, name: "Rio de Janeiro",nameAr: "ريو دي جانيرو",    color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "BR" },
  { id: 15, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                            type: "chance" },
  { id: 16, name: "São Paulo",     nameAr: "ساو باولو",        color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property", flag: "BR" },
  { id: 17, name: "Brasília",      nameAr: "برازيليا",         color: "#ea580c", price: 200, rent: [16, 80, 220, 600, 800, 1000], type: "property", flag: "BR" },
  { id: 18, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                            type: "chest" },
  { id: 19, name: "Buenos Aires",  nameAr: "بوينس آيرس",       color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "AR" },

  { id: 20, name: "Free Parking",  nameAr: "وقوف مجاني",     color: "#8b5cf6", price: 0,   rent: [],                            type: "parking" },
  { id: 21, name: "Córdoba",       nameAr: "قرطبة",            color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property", flag: "AR" },
  { id: 22, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                             type: "chest" },
  { id: 23, name: "JFK Airport",   nameAr: "مطار جيه إف كيه",  color: "#6b7280", price: 200, rent: [25, 50, 100, 200],             type: "property" },
  { id: 24, name: "Santiago",      nameAr: "سانتياغو",         color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "CL" },
  { id: 25, name: "Montevideo",    nameAr: "مونتيفيديو",       color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property", flag: "UY" },
  { id: 26, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                             type: "chance" },
  { id: 27, name: "Quito",         nameAr: "كيتو",             color: "#eab308", price: 280, rent: [24, 120, 360, 850, 1025, 1200],type: "property", flag: "EC" },
  { id: 28, name: "San Francisco", nameAr: "سان فرانسيسكو",    color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "US" },
  { id: 29, name: "Los Angeles",   nameAr: "لوس أنجلوس",       color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property", flag: "US" },
  { id: 30, name: "Go To Jail",    nameAr: "اذهب للسجن",      color: "#6b7280", price: 0,   rent: [],                             type: "jail" },

  { id: 31, name: "Ottawa",        nameAr: "أوتاوا",           color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "CA" },
  { id: 32, name: "Montreal",      nameAr: "مونتريال",         color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property", flag: "CA" },
  { id: 33, name: "Continental Power", nameAr: "كهرباء القارة", color: "#06b6d4", price: 150, rent: [4, 10],                        type: "utility" },
  { id: 34, name: "New York",      nameAr: "نيويورك",          color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "US" },
  { id: 35, name: "Toronto Bay",   nameAr: "تورنتو باي",       color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property", flag: "CA" },
  { id: 36, name: "Chance",        nameAr: "فرصة",             color: "#f59e0b", price: 0,   rent: [],                                type: "chance" },
  { id: 37, name: "São Paulo Ave", nameAr: "شارع ساو باولو",   color: "#a855f7", price: 420, rent: [32, 170, 480, 1050, 1250, 1500], type: "property", flag: "BR" },
  { id: 38, name: "Chest",         nameAr: "صندوق",           color: "#3b82f6", price: 0,   rent: [],                                type: "chest" },
  { id: 39, name: "Buenos Aires Sur", nameAr: "بوينس آيرس الجنوبية", color: "#a855f7", price: 450, rent: [35, 180, 500, 1100, 1300, 1550], type: "property", flag: "AR" },
];

const MAPS: Record<MapId, Property[]> = {
  middle_east: MIDDLE_EAST_BOARD,
  europe: EUROPE_BOARD,
  americas: AMERICAS_BOARD,
};

type Phase = "lobby" | "playing" | "finished";

interface PlayerState {
  id: string;
  position: number;
  money: number;
  properties: number[];
  upgradedColors: Set<string>;
  houses: Map<number, number>; // propertyId -> house count (0-5, 5 = hotel)
  jailTurns: number;
  bankrupt: boolean;
  token: string;
  inJail: boolean;
}

const TOKENS = ["🚗", "🎩", "👟", "🔑", "💎", "🎯"];

export class RentoGame implements GameRoom {
  readonly gameId = "rento";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: Phase = "lobby";
  playerStates: Map<string, PlayerState> = new Map();
  turnIndex = 0;
  dice: [number, number] = [0, 0];
  doublesCount = 0;
  lastAction = "";
  // Roll gating: a player may roll once per turn, plus one extra roll if they rolled doubles.
  private rolledThisTurn = 0;
  private pendingDoublesRoll = false;
  turnDeadline: number | null = null;
  winnerId: string | null = null;
  tradeProposals: Map<string, TradeProposal> = new Map();
  kickVotes: Map<string, Set<string>> = new Map();

  // Configurable options
  startingBalance: number;
  jailEnabled: boolean;
  freeParkingBonus: number;
  turnTimerMs: number;
  aiDifficulty: "easy" | "medium" | "hard";
  readonly mapId: MapId;
  readonly board: Property[];
  readonly backgroundId: string;

  private callbacks: GameRoomCallbacks;
  private turnTimer: NodeJS.Timeout | null = null;
  private moveLock = false;
  private botTimers: NodeJS.Timeout[] = [];

  constructor(
    roomId: string,
    options: { maxPlayers?: number; startingBalance?: number; jailEnabled?: boolean; freeParkingBonus?: number; turnTimer?: number; aiDifficulty?: "easy" | "medium" | "hard"; mapId?: string; backgroundId?: string },
    callbacks: GameRoomCallbacks,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(6, options?.maxPlayers || 4));
    this.startingBalance = Math.max(200, Math.min(10000, options?.startingBalance || 1500));
    this.jailEnabled = options?.jailEnabled !== false;
    this.freeParkingBonus = Math.max(0, options?.freeParkingBonus || 0);
    this.turnTimerMs = Math.max(30000, Math.min(120000, options?.turnTimer || 45000));
    this.aiDifficulty = options?.aiDifficulty || "medium";
    this.mapId = options?.mapId && options.mapId in MAPS ? (options.mapId as MapId) : "middle_east";
    this.board = MAPS[this.mapId];
    this.backgroundId = (BACKGROUND_IDS as readonly string[]).includes(options?.backgroundId ?? "") ? options!.backgroundId! : "nebula";
    this.callbacks = callbacks;
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string, flag?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    if (flag) player.flag = flag;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, _difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.lastActivityAt = Date.now();
    return true;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
      player.socketId = undefined;
      this.lastActivityAt = Date.now();
    }
    return player || null;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = true;
      player.socketId = socketId;
      this.lastActivityAt = Date.now();
    }
    return player || null;
  }

  canStart(): boolean {
    return this.players.length >= 2;
  }

  startGame(): unknown | null {
    this.phase = "playing";
    this.turnIndex = 0;
    this.doublesCount = 0;
    this.rolledThisTurn = 0;
    this.pendingDoublesRoll = false;
    this.winnerId = null;
    this.playerStates.clear();

    this.players.forEach((p, i) => {
      this.playerStates.set(p.id, {
        id: p.id,
        position: 0,
        money: this.startingBalance,
        properties: [],
        upgradedColors: new Set<string>(),
        houses: new Map<number, number>(),
        jailTurns: 0,
        bankrupt: false,
        token: TOKENS[i % TOKENS.length],
        inJail: false,
      });
    });

    this.lastAction = `${this.players[0].name}'s turn`;
    this.lastActivityAt = Date.now();
    this.startTurnTimer();
    this.broadcast();
    this.scheduleBotTurn();
    return null;
  }

  private startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnDeadline = Date.now() + this.turnTimerMs;
    this.turnTimer = setTimeout(() => {
      if (this.phase === "playing" && !this.moveLock) {
        this.lastAction = "AFK! Turn skipped.";
        this.doublesCount = 0;
        this.nextTurn();
      }
    }, this.turnTimerMs);
    this.turnTimer.unref?.();
  }

  private getCurrentPlayer(): PlayerState | null {
    const alive = this.players.filter((p) => {
      const ps = this.playerStates.get(p.id);
      return ps && !ps.bankrupt;
    });
    if (alive.length === 0) return null;
    const idx = this.turnIndex % alive.length;
    return this.playerStates.get(alive[idx].id) || null;
  }

  private getCurrentPlayerId(): string | null {
    const alive = this.players.filter((p) => {
      const ps = this.playerStates.get(p.id);
      return ps && !ps.bankrupt;
    });
    if (alive.length === 0) return null;
    const idx = this.turnIndex % alive.length;
    return alive[idx].id;
  }

  private getCurrentPlayerObj(): Player | null {
    const pid = this.getCurrentPlayerId();
    return pid ? this.getPlayer(pid) ?? null : null;
  }

  rollDice(playerId: string): { success: boolean; error?: string; dice?: [number, number] } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    if (this.moveLock) return { success: false, error: "Wait for current action" };

    const currentId = this.getCurrentPlayerId();
    if (currentId !== playerId) return { success: false, error: "Not your turn" };

    const ps = this.playerStates.get(playerId);
    if (!ps || ps.bankrupt) return { success: false, error: "You are bankrupt" };

    // A player may roll once per turn, plus one extra roll when they roll doubles.
    if (this.rolledThisTurn > 0 && !this.pendingDoublesRoll) {
      return { success: false, error: "You already rolled. End your turn." };
    }

    const name = this.getPlayerName(playerId);
    const wasInJail = ps.inJail;

    if (wasInJail && this.jailEnabled) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      this.dice = [d1, d2];
      this.rolledThisTurn++;
      if (d1 === d2) {
        ps.inJail = false;
        ps.jailTurns = 0;
        const passedGo = this.advance(ps, d1 + d2);
        if (passedGo) ps.money += 300;
        this.lastAction =
          `${name} rolled doubles and escaped jail!` + (passedGo ? ` Passed GO +$300!` : "");
        // Escaping jail counts as the turn's roll — no extra roll granted.
        this.pendingDoublesRoll = false;
      } else {
        ps.jailTurns++;
        if (ps.jailTurns >= 3) {
          ps.inJail = false;
          ps.jailTurns = 0;
          ps.money -= 50;
          this.lastAction = `${name} paid $50 and left jail.`;
          this.pendingDoublesRoll = false;
        } else {
          this.lastAction = `${name} is still in jail.`;
          this.broadcast();
          this.nextTurn();
          return { success: true, dice: this.dice };
        }
      }
    } else {
      if (wasInJail && !this.jailEnabled) {
        ps.inJail = false;
        ps.jailTurns = 0;
      }
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      this.dice = [d1, d2];
      this.rolledThisTurn++;

      if (d1 === d2) {
        this.doublesCount++;
        if (this.doublesCount >= 3 && this.jailEnabled) {
          ps.inJail = true;
          ps.position = 10;
          this.doublesCount = 0;
          this.lastAction = `${name} rolled 3 doubles and went to jail!`;
          this.rolledThisTurn = 0;
          this.pendingDoublesRoll = false;
          this.broadcast();
          this.nextTurn();
          return { success: true, dice: this.dice };
        }
        // Doubles: grant one extra roll.
        this.pendingDoublesRoll = true;
      } else {
        this.doublesCount = 0;
        this.pendingDoublesRoll = false;
      }

      const passedGo = this.advance(ps, d1 + d2);
      if (passedGo) {
        ps.money += 300;
        this.lastAction = `${name} passed GO and collected $300!`;
      }
    }

    this.moveLock = true;
    this.broadcast();

    setTimeout(() => {
      this.processLanding(playerId);
      this.moveLock = false;
    }, 800);

    return { success: true, dice: this.dice };
  }

  private advance(ps: PlayerState, total: number): boolean {
    const oldPos = ps.position;
    ps.position = (ps.position + total) % this.board.length;
    return ps.position < oldPos;
  }

  private processLanding(playerId: string) {
    const ps = this.playerStates.get(playerId);
    if (!ps) return;

    const cell = this.board[ps.position];
    const name = this.getPlayerName(playerId);

    switch (cell.type) {
      case "tax": {
        const tax = Math.min(200, Math.floor(ps.money * 0.1));
        ps.money -= tax;
        this.lastAction = `${name} paid $${tax} in taxes.`;
        break;
      }
      case "chest": {
        const amounts = [-100, -50, 50, 100, 150];
        const amt = amounts[Math.floor(Math.random() * amounts.length)];
        ps.money += amt;
        this.lastAction = `${name} drew a Chest card: ${amt >= 0 ? "+" : ""}$${amt}`;
        break;
      }
      case "chance": {
        const actions = [
          { msg: "Advance to GO (+$300)", pos: 0, money: 300 },
          { msg: "Go to Jail", pos: 10, money: 0 },
          { msg: "Bank error, collect $150", pos: -1, money: 150 },
          { msg: "Pay poor tax of $50", pos: -1, money: -50 },
          { msg: "Trip to Dubai, collect $100", pos: 11, money: 100 },
          { msg: "Elected chairman, pay $100 each", pos: -1, money: -100 },
        ];
        const act = actions[Math.floor(Math.random() * actions.length)];
        if (act.pos >= 0) {
          if (act.msg === "Go to Jail" && !this.jailEnabled) {
            this.lastAction = `${name}: avoided Jail (jail disabled).`;
          } else {
            ps.position = act.pos;
          }
        }
        ps.money += act.money;
        if (act.msg !== "Go to Jail" || this.jailEnabled) {
          this.lastAction = `${name}: ${act.msg}`;
        }
        break;
      }
      case "jail":
        if (this.jailEnabled && ps.position === 30) {
          ps.inJail = true;
          ps.position = 10;
          this.lastAction = `${name} was sent to Jail!`;
        }
        break;
      case "parking":
        if (this.freeParkingBonus > 0) {
          ps.money += this.freeParkingBonus;
          this.lastAction = `${name} landed on Free Parking and collected $${this.freeParkingBonus}!`;
        }
        break;
    }

    if ((cell.type === "property" || cell.type === "utility") && cell.rent.length > 0) {
      const owner = this.getPropertyOwner(cell.id);
      if (!owner) {
        this.lastAction = `${name} can buy ${cell.name} for $${cell.price}.`;
      } else if (owner !== playerId) {
        const ownerState = this.playerStates.get(owner);
        if (ownerState) {
          let rent: number;
          if (cell.type === "utility") {
            // Utilities don't get houses — unchanged tiered/doubling logic.
            const colorCount = this.board.filter(c => c.color === cell.color && (c.type === "property" || c.type === "utility")).length;
            const ownedCount = ownerState.properties.filter(pid => this.board[pid]?.color === cell.color).length;
            const tier = Math.floor(ownedCount / Math.max(1, colorCount));
            rent = cell.rent[Math.min(tier, cell.rent.length - 1)];
            if (ownerState.upgradedColors.has(cell.color)) rent *= 2;
          } else {
            // Properties: real house count drives the rent tier directly (the
            // rent array already assumes a completed set from tier 1 onward),
            // and only the un-improved (0-house) rent doubles for owning the set.
            const houseCount = ownerState.houses.get(cell.id) ?? 0;
            if (houseCount > 0) {
              rent = cell.rent[Math.min(houseCount, cell.rent.length - 1)];
            } else if (ownerState.upgradedColors.has(cell.color)) {
              rent = cell.rent[0] * 2;
            } else {
              rent = cell.rent[0];
            }
          }
          ps.money -= rent;
          ownerState.money += rent;
          this.lastAction = `${name} paid $${rent} rent to ${this.getPlayerName(owner)}.`;
        }
      }
    }

    if (ps.money < 0) {
      ps.bankrupt = true;
      this.lastAction = `${name} is bankrupt!`;
      this.checkWinner();
    }

    this.broadcast();

    // Always require player to press end turn (no auto-advance on doubles)
    this.startTurnTimer();
    this.scheduleBotTurn();
  }

  private getPropertyOwner(propertyId: number): string | null {
    for (const [pid, ps] of this.playerStates) {
      if (!ps.bankrupt && ps.properties.includes(propertyId)) return pid;
    }
    return null;
  }

  buyProperty(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const currentId = this.getCurrentPlayerId();
    if (currentId !== playerId) return { success: false, error: "Not your turn" };

    const ps = this.playerStates.get(playerId);
    if (!ps) return { success: false, error: "No player state" };

    const cell = this.board[ps.position];
    if (cell.type !== "property" && cell.type !== "utility") return { success: false, error: "Not a property" };
    if (this.getPropertyOwner(cell.id)) return { success: false, error: "Already owned" };
    if (ps.money < cell.price) return { success: false, error: "Not enough money" };

    ps.money -= cell.price;
    ps.properties.push(cell.id);

    const name = this.getPlayerName(playerId);
    this.lastAction = `${name} bought ${cell.name} for $${cell.price}!`;

    const color = cell.color;
    const allColorProps = this.board.filter(c => c.color === color && (c.type === "property" || c.type === "utility")).map(c => c.id);
    const ownedColorProps = ps.properties.filter(pid => allColorProps.includes(pid));
    if (ownedColorProps.length === allColorProps.length && !ps.upgradedColors.has(color)) {
      ps.upgradedColors.add(color);
      this.lastAction = `${name} bought ${cell.name} and completed the set — rent doubled!`;
    }

    this.lastActivityAt = Date.now();
    this.broadcast();
    return { success: true };
  }

  buildHouse(playerId: string, propertyId: number): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const ps = this.playerStates.get(playerId);
    if (!ps) return { success: false, error: "No player state" };
    if (!ps.properties.includes(propertyId)) return { success: false, error: "You don't own that property" };

    const cell = this.board[propertyId];
    if (!cell || cell.type !== "property") return { success: false, error: "Houses can only be built on properties" };
    if (!ps.upgradedColors.has(cell.color)) return { success: false, error: "You must own the full color set first" };

    const current = ps.houses.get(propertyId) ?? 0;
    if (current >= 5) return { success: false, error: "Already at a hotel" };

    const cost = Math.round(cell.price / 2);
    if (ps.money < cost) return { success: false, error: "Not enough money" };

    ps.money -= cost;
    const newCount = current + 1;
    ps.houses.set(propertyId, newCount);

    const name = this.getPlayerName(playerId);
    this.lastAction = newCount >= 5
      ? `${name} built a hotel on ${cell.name}!`
      : `${name} built a house on ${cell.name}! (${newCount}/5)`;

    this.lastActivityAt = Date.now();
    this.broadcast();
    return { success: true };
  }

  endTurn(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const currentId = this.getCurrentPlayerId();
    if (currentId !== playerId) return { success: false, error: "Not your turn" };

    this.doublesCount = 0;
    this.rolledThisTurn = 0;
    this.pendingDoublesRoll = false;
    this.nextTurn();
    return { success: true };
  }

  private nextTurn() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    const alive = this.players.filter((p) => {
      const ps = this.playerStates.get(p.id);
      return ps && !ps.bankrupt;
    });

    this.doublesCount = 0;
    this.rolledThisTurn = 0;
    this.pendingDoublesRoll = false;

    if (alive.length <= 1) {
      this.phase = "finished";
      this.winnerId = alive[0]?.id || null;
      this.lastAction = alive[0] ? `${this.getPlayerName(alive[0].id)} wins!` : "Game over!";
      this.broadcast();
      return;
    }

    this.turnIndex = (this.turnIndex + 1) % alive.length;
    const nextPid = this.getCurrentPlayerId();
    if (nextPid) {
      this.lastAction = `${this.getPlayerName(nextPid)}'s turn`;
    }
    this.startTurnTimer();
    this.broadcast();
    this.scheduleBotTurn();
  }

  private eliminatePlayer(playerId: string, message: string) {
    const ps = this.playerStates.get(playerId);
    if (!ps || ps.bankrupt) return;
    const wasCurrent = this.getCurrentPlayerId() === playerId;
    ps.properties = [];
    ps.houses.clear();
    ps.bankrupt = true;
    this.lastAction = message;
    this.kickVotes.delete(playerId);

    if (wasCurrent && this.phase === "playing") {
      this.doublesCount = 0;
      this.rolledThisTurn = 0;
      this.pendingDoublesRoll = false;
      this.nextTurn();
    } else {
      this.checkWinner();
      this.broadcast();
    }
  }

  declareBankrupt(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const ps = this.playerStates.get(playerId);
    if (!ps) return { success: false, error: "No player state" };
    if (ps.bankrupt) return { success: false, error: "Already bankrupt" };

    this.eliminatePlayer(playerId, `${this.getPlayerName(playerId)} declared bankruptcy!`);
    this.lastActivityAt = Date.now();
    return { success: true };
  }

  voteKick(voterId: string, targetPlayerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    if (voterId === targetPlayerId) return { success: false, error: "Cannot vote for yourself" };
    // Vote-kick needs a real group decision — in a 2-player room (human or bot) there's
    // no one left to out-vote the accuser, so a single vote could otherwise "win" the game.
    if (this.players.length <= 2) return { success: false, error: "Need more than 2 players to vote-kick" };

    const voter = this.getPlayer(voterId);
    const target = this.getPlayer(targetPlayerId);
    if (!voter || !target) return { success: false, error: "Invalid player" };

    const targetPs = this.playerStates.get(targetPlayerId);
    if (!targetPs || targetPs.bankrupt) return { success: false, error: "Player already out" };

    let votes = this.kickVotes.get(targetPlayerId);
    if (!votes) {
      votes = new Set();
      this.kickVotes.set(targetPlayerId, votes);
    }
    if (votes.has(voterId)) votes.delete(voterId);
    else votes.add(voterId);

    // Threshold is 60% of the WHOLE room (bots included), not just of the human
    // accusers — e.g. 2/3, 3/4. Only non-bot players (excluding the target) can
    // actually cast a vote, which is what keeps a lone human from clearing out bots.
    const totalPlayers = this.players.length;
    const eligible = this.players.filter((p) => !p.isBot && p.id !== targetPlayerId);
    const threshold = Math.ceil(totalPlayers * 0.6);

    if (eligible.length > 0 && votes.size >= threshold) {
      this.eliminatePlayer(targetPlayerId, `${this.getPlayerName(targetPlayerId)} was voted out!`);
    } else {
      this.lastActivityAt = Date.now();
      this.broadcast();
    }
    return { success: true };
  }

  proposeTrade(
    fromPlayerId: string,
    toPlayerId: string,
    offerProperties: number[],
    offerMoney: number,
    requestProperties: number[],
    requestMoney: number
  ): { success: boolean; error?: string; tradeId?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };

    const fromPs = this.playerStates.get(fromPlayerId);
    const toPs = this.playerStates.get(toPlayerId);
    if (!fromPs || !toPs) return { success: false, error: "Invalid player" };
    if (fromPs.bankrupt || toPs.bankrupt) return { success: false, error: "Player is bankrupt" };

    // Validate from player owns offered properties
    for (const pid of offerProperties) {
      if (!fromPs.properties.includes(pid)) return { success: false, error: "You don't own that property" };
    }

    // Validate to player owns requested properties
    for (const pid of requestProperties) {
      if (!toPs.properties.includes(pid)) return { success: false, error: "They don't own that property" };
    }

    // Validate money
    if (fromPs.money < offerMoney) return { success: false, error: "Not enough money" };
    if (toPs.money < requestMoney) return { success: false, error: "They don't have enough money" };

    // Cannot trade with yourself
    if (fromPlayerId === toPlayerId) return { success: false, error: "Cannot trade with yourself" };

    const tradeId = "trade_" + nanoid(6);
    const proposal: TradeProposal = {
      id: tradeId,
      fromPlayerId,
      toPlayerId,
      offerProperties,
      offerMoney,
      requestProperties,
      requestMoney,
      status: "pending",
    };

    this.tradeProposals.set(tradeId, proposal);
    this.lastAction = `${this.getPlayerName(fromPlayerId)} proposed a trade to ${this.getPlayerName(toPlayerId)}!`;
    this.broadcast();
    return { success: true, tradeId };
  }

  editTrade(
    playerId: string,
    tradeId: string,
    offerProperties: number[],
    offerMoney: number,
    requestProperties: number[],
    requestMoney: number
  ): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };

    const proposal = this.tradeProposals.get(tradeId);
    if (!proposal) return { success: false, error: "Trade not found" };
    if (proposal.status !== "pending") return { success: false, error: "Trade already resolved" };
    if (proposal.fromPlayerId !== playerId) return { success: false, error: "Only the sender can edit this trade" };

    const fromPs = this.playerStates.get(proposal.fromPlayerId);
    const toPs = this.playerStates.get(proposal.toPlayerId);
    if (!fromPs || !toPs) return { success: false, error: "Invalid player" };

    for (const pid of offerProperties) {
      if (!fromPs.properties.includes(pid)) return { success: false, error: "You don't own that property" };
    }
    for (const pid of requestProperties) {
      if (!toPs.properties.includes(pid)) return { success: false, error: "They don't own that property" };
    }
    if (fromPs.money < offerMoney) return { success: false, error: "Not enough money" };
    if (toPs.money < requestMoney) return { success: false, error: "They don't have enough money" };

    proposal.offerProperties = offerProperties;
    proposal.offerMoney = offerMoney;
    proposal.requestProperties = requestProperties;
    proposal.requestMoney = requestMoney;

    this.lastAction = `${this.getPlayerName(proposal.fromPlayerId)} updated their trade with ${this.getPlayerName(proposal.toPlayerId)}.`;
    this.broadcast();
    return { success: true };
  }

  acceptTrade(playerId: string, tradeId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };

    const proposal = this.tradeProposals.get(tradeId);
    if (!proposal) return { success: false, error: "Trade not found" };
    if (proposal.status !== "pending") return { success: false, error: "Trade already resolved" };
    if (proposal.toPlayerId !== playerId) return { success: false, error: "Not your trade" };

    const fromPs = this.playerStates.get(proposal.fromPlayerId);
    const toPs = this.playerStates.get(proposal.toPlayerId);
    if (!fromPs || !toPs) return { success: false, error: "Invalid player" };

    // Re-validate ownership (in case something changed)
    for (const pid of proposal.offerProperties) {
      if (!fromPs.properties.includes(pid)) return { success: false, error: "They no longer own that property" };
    }
    for (const pid of proposal.requestProperties) {
      if (!toPs.properties.includes(pid)) return { success: false, error: "You no longer own that property" };
    }
    if (fromPs.money < proposal.offerMoney) return { success: false, error: "They don't have enough money" };
    if (toPs.money < proposal.requestMoney) return { success: false, error: "You don't have enough money" };

    // Execute the trade
    // Transfer properties — houses don't carry over to the new owner
    for (const pid of proposal.offerProperties) {
      fromPs.properties = fromPs.properties.filter(p => p !== pid);
      fromPs.houses.delete(pid);
      toPs.properties.push(pid);
    }
    for (const pid of proposal.requestProperties) {
      toPs.properties = toPs.properties.filter(p => p !== pid);
      toPs.houses.delete(pid);
      fromPs.properties.push(pid);
    }

    // Transfer money
    fromPs.money -= proposal.offerMoney;
    toPs.money += proposal.offerMoney;
    toPs.money -= proposal.requestMoney;
    fromPs.money += proposal.requestMoney;

    // Update color upgrades
    this.updateColorUpgrades(fromPs);
    this.updateColorUpgrades(toPs);

    proposal.status = "accepted";
    this.tradeProposals.delete(tradeId);
    this.lastAction = `Trade completed: ${this.getPlayerName(proposal.fromPlayerId)} traded with ${this.getPlayerName(proposal.toPlayerId)}!`;
    this.broadcast();
    return { success: true };
  }

  rejectTrade(playerId: string, tradeId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };

    const proposal = this.tradeProposals.get(tradeId);
    if (!proposal) return { success: false, error: "Trade not found" };
    if (proposal.status !== "pending") return { success: false, error: "Trade already resolved" };
    if (proposal.toPlayerId !== playerId) return { success: false, error: "Not your trade" };

    proposal.status = "rejected";
    this.tradeProposals.delete(tradeId);
    this.lastAction = `${this.getPlayerName(playerId)} rejected the trade.`;
    this.broadcast();
    return { success: true };
  }

  private updateColorUpgrades(ps: PlayerState) {
    ps.upgradedColors.clear();
    const colorGroups = new Map<string, number[]>();
    for (const cell of this.board) {
      if (cell.type === "property" || cell.type === "utility") {
        if (!colorGroups.has(cell.color)) colorGroups.set(cell.color, []);
        colorGroups.get(cell.color)!.push(cell.id);
      }
    }
    for (const [color, colorProps] of colorGroups) {
      const ownedColorProps = ps.properties.filter(pid => colorProps.includes(pid));
      if (ownedColorProps.length === colorProps.length) {
        ps.upgradedColors.add(color);
      }
    }
  }

  cancelTrade(playerId: string, tradeId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };

    const proposal = this.tradeProposals.get(tradeId);
    if (!proposal) return { success: false, error: "Trade not found" };
    if (proposal.status !== "pending") return { success: false, error: "Trade already resolved" };
    if (proposal.fromPlayerId !== playerId) return { success: false, error: "Not your trade" };

    proposal.status = "rejected";
    this.tradeProposals.delete(tradeId);
    this.lastAction = `${this.getPlayerName(playerId)} cancelled the trade.`;
    this.broadcast();
    return { success: true };
  }

  private scheduleBotTurn() {
    const cp = this.getCurrentPlayerObj();
    if (!cp || !cp.isBot || this.phase !== "playing") return;

    const botTimer = setTimeout(() => {
      if (this.phase !== "playing") return;
      this.runBotTurn(cp.id);
    }, 1200);
    botTimer.unref?.();
    this.botTimers.push(botTimer);
  }

  private runBotTurn(botId: string) {
    if (this.phase !== "playing" || this.moveLock) return;
    const currentId = this.getCurrentPlayerId();
    if (currentId !== botId) return;

    const ps = this.playerStates.get(botId);
    if (!ps || ps.bankrupt) return;

    // Step 1: Roll dice
    const rollResult = this.rollDice(botId);
    if (!rollResult.success) return;

    // Step 2: After landing (800ms delay built into rollDice), decide to buy
    setTimeout(() => {
      if (this.phase !== "playing") return;
      const cell = this.board[ps.position];
      const isProperty = cell.type === "property" || cell.type === "utility";
      const isOwned = this.getPropertyOwner(cell.id) !== null;
      const canAfford = ps.money >= cell.price;

      // Bot strategy: buy if affordable and have enough reserve
      if (isProperty && !isOwned && canAfford && ps.money > cell.price * 2) {
        this.buyProperty(botId);
      }

      // Step 3: End turn or roll again if doubles
      setTimeout(() => {
        if (this.phase !== "playing") return;
        // If rolled doubles, bot gets another turn
        if (this.doublesCount > 0) {
          this.runBotTurn(botId);
        } else {
          this.endTurn(botId);
        }
      }, 600);
    }, 1000);
  }

  private checkWinner() {
    const alive = this.players.filter((p) => {
      const ps = this.playerStates.get(p.id);
      return ps && !ps.bankrupt;
    });
    if (alive.length <= 1) {
      this.phase = "finished";
      this.winnerId = alive[0]?.id || null;
      this.lastAction = alive[0] ? `${this.getPlayerName(alive[0].id)} wins!` : "Game over!";
      if (this.turnTimer) clearTimeout(this.turnTimer);
    }
  }

  private getPlayerName(id: string): string {
    return this.players.find((p) => p.id === id)?.name || id;
  }

  toState(): unknown {
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      maxPlayers: this.maxPlayers,
      mapId: this.mapId,
      backgroundId: this.backgroundId,
      board: this.board,
      players: this.players.map((p) => {
        const ps = this.playerStates.get(p.id);
        return {
          id: p.id,
          name: p.name,
          isBot: p.isBot,
          isHost: p.isHost,
          isConnected: p.isConnected,
          position: ps?.position ?? 0,
          money: ps?.money ?? 0,
          properties: ps?.properties ?? [],
          houses: ps ? Object.fromEntries(ps.houses) : {},
          inJail: ps?.inJail ?? false,
          bankrupt: ps?.bankrupt ?? false,
          token: ps?.token ?? "?",
          flag: p.flag ?? undefined,
        };
      }),
      currentPlayerId: this.getCurrentPlayerId(),
      dice: this.dice,
      lastAction: this.lastAction,
      hasRolled: this.rolledThisTurn > 0,
      canRoll: this.phase === "playing" && !this.moveLock && (this.rolledThisTurn === 0 || this.pendingDoublesRoll),
      turnDeadline: this.turnDeadline,
      winnerId: this.winnerId,
      tradeProposals: Array.from(this.tradeProposals.values()),
      kickVotes: Object.fromEntries(
        Array.from(this.kickVotes.entries()).map(([id, set]) => [id, Array.from(set)])
      ),
      jailEnabled: this.jailEnabled,
      freeParkingBonus: this.freeParkingBonus,
      turnTimerMs: this.turnTimerMs,
      startingBalance: this.startingBalance,
      aiDifficulty: this.aiDifficulty,
    };
  }

  toPlayerState(_playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers = [];
  }
}
