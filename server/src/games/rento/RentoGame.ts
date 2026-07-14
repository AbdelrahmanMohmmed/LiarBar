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

// 40-tile rectangular perimeter board with Middle Eastern cities
const BOARD: Property[] = [
  // Bottom row (left → right): positions 0-10
  { id: 0,  name: "GO",            nameAr: "ابدأ",           color: "#22c55e", price: 0,   rent: [],                          type: "start" },
  { id: 1,  name: "Riyadh",        nameAr: "الرياض",         color: "#92400e", price: 60,  rent: [2, 10, 30, 90, 160, 250],   type: "property" },
  { id: 2,  name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                          type: "chest" },
  { id: 3,  name: "Jeddah",        nameAr: "جدة",            color: "#92400e", price: 60,  rent: [4, 20, 60, 180, 320, 450],  type: "property" },
  { id: 4,  name: "Income Tax",    nameAr: "ضريبة الدخل",    color: "#ef4444", price: 0,   rent: [],                          type: "tax" },
  { id: 5,  name: "Riyadh Station",nameAr: "محطة الرياض",    color: "#6b7280", price: 200, rent: [25, 50, 100, 200],          type: "property" },
  { id: 6,  name: "Cairo",         nameAr: "القاهرة",         color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property" },
  { id: 7,  name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                          type: "chance" },
  { id: 8,  name: "Alexandria",    nameAr: "الإسكندرية",      color: "#2563eb", price: 100, rent: [6, 30, 90, 270, 400, 550],  type: "property" },
  { id: 9,  name: "Luxor",         nameAr: "الأقصر",          color: "#2563eb", price: 120, rent: [8, 40, 100, 300, 450, 600], type: "property" },
  { id: 10, name: "Jail",          nameAr: "سجن",            color: "#6b7280", price: 0,   rent: [],                          type: "jail" },

  // Right column (bottom → top): positions 11-19
  { id: 11, name: "Dubai",         nameAr: "دبي",            color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property" },
  { id: 12, name: "Abu Dhabi",     nameAr: "أبو ظبي",        color: "#ec4899", price: 140, rent: [10, 50, 150, 450, 625, 750],  type: "property" },
  { id: 13, name: "Water Works",   nameAr: "المياه",          color: "#06b6d4", price: 150, rent: [4, 10],                       type: "utility" },
  { id: 14, name: "Istanbul",      nameAr: "إسطنبول",         color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property" },
  { id: 15, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                            type: "chance" },
  { id: 16, name: "Ankara",        nameAr: "أنقرة",           color: "#ea580c", price: 180, rent: [14, 70, 200, 550, 750, 950],  type: "property" },
  { id: 17, name: "Antalya",       nameAr: "أنطاليا",         color: "#ea580c", price: 200, rent: [16, 80, 220, 600, 800, 1000], type: "property" },
  { id: 18, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                            type: "chest" },
  { id: 19, name: "Free Parking",  nameAr: "وقوف مجاني",     color: "#8b5cf6", price: 0,   rent: [],                            type: "parking" },

  // Top row (right → left): positions 20-30
  { id: 20, name: "Baghdad",       nameAr: "بغداد",           color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property" },
  { id: 21, name: "Basra",         nameAr: "البصرة",          color: "#dc2626", price: 220, rent: [18, 90, 250, 700, 875, 1050], type: "property" },
  { id: 22, name: "Chest",         nameAr: "صندوق",          color: "#3b82f6", price: 0,   rent: [],                             type: "chest" },
  { id: 23, name: "Istanbul Airport", nameAr: "مطار إسطنبول", color: "#6b7280", price: 200, rent: [25, 50, 100, 200],             type: "property" },
  { id: 24, name: "Casablanca",    nameAr: "الدار البيضاء",   color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property" },
  { id: 25, name: "Marrakech",     nameAr: "مراكش",           color: "#eab308", price: 260, rent: [22, 110, 330, 800, 975, 1150], type: "property" },
  { id: 26, name: "Chance",        nameAr: "فرصة",            color: "#f59e0b", price: 0,   rent: [],                             type: "chance" },
  { id: 27, name: "Fez",           nameAr: "فاس",             color: "#eab308", price: 280, rent: [24, 120, 360, 850, 1025, 1200],type: "property" },
  { id: 28, name: "Doha",          nameAr: "الدوحة",          color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property" },
  { id: 29, name: "Kuwait City",   nameAr: "الكويت",          color: "#16a34a", price: 300, rent: [26, 130, 390, 900, 1100, 1275],type: "property" },
  { id: 30, name: "Go To Jail",    nameAr: "اذهب للسجن",      color: "#6b7280", price: 0,   rent: [],                             type: "jail" },

  // Left column (top → bottom): positions 31-39
  { id: 31, name: "Muscat",        nameAr: "مسقط",            color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property" },
  { id: 32, name: "Amman",         nameAr: "عمّان",            color: "#7c3aed", price: 350, rent: [28, 150, 420, 950, 1150, 1350], type: "property" },
  { id: 33, name: "Electric Company", nameAr: "الكهرباء",     color: "#06b6d4", price: 150, rent: [4, 10],                          type: "utility" },
  { id: 34, name: "Beirut",        nameAr: "بيروت",           color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property" },
  { id: 35, name: "Tripoli",       nameAr: "طرابلس",          color: "#a855f7", price: 400, rent: [30, 160, 450, 1000, 1200, 1400], type: "property" },
  { id: 36, name: "Chance",        nameAr: "فرصة",             color: "#f59e0b", price: 0,   rent: [],                                type: "chance" },
  { id: 37, name: "Tunis",         nameAr: "تونس",             color: "#a855f7", price: 420, rent: [32, 170, 480, 1050, 1250, 1500], type: "property" },
  { id: 38, name: "Chest",         nameAr: "صندوق",           color: "#3b82f6", price: 0,   rent: [],                                type: "chest" },
  { id: 39, name: "Algiers",       nameAr: "الجزائر",          color: "#a855f7", price: 450, rent: [35, 180, 500, 1100, 1300, 1550], type: "property" },
];

type Phase = "lobby" | "playing" | "finished";

interface PlayerState {
  id: string;
  position: number;
  money: number;
  properties: number[];
  upgradedColors: Set<string>;
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

  // Configurable options
  startingBalance: number;
  jailEnabled: boolean;
  freeParkingBonus: number;
  turnTimerMs: number;
  aiDifficulty: "easy" | "medium" | "hard";

  private callbacks: GameRoomCallbacks;
  private turnTimer: NodeJS.Timeout | null = null;
  private moveLock = false;
  private botTimers: NodeJS.Timeout[] = [];

  constructor(
    roomId: string,
    options: { maxPlayers?: number; startingBalance?: number; jailEnabled?: boolean; freeParkingBonus?: number; turnTimer?: number; aiDifficulty?: "easy" | "medium" | "hard" },
    callbacks: GameRoomCallbacks,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(6, options?.maxPlayers || 4));
    this.startingBalance = Math.max(200, Math.min(10000, options?.startingBalance || 1500));
    this.jailEnabled = options?.jailEnabled !== false;
    this.freeParkingBonus = Math.max(0, options?.freeParkingBonus || 0);
    this.turnTimerMs = Math.max(5000, Math.min(60000, options?.turnTimer || 15000));
    this.aiDifficulty = options?.aiDifficulty || "medium";
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
    }, 15000);
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
    ps.position = (ps.position + total) % BOARD.length;
    return ps.position < oldPos;
  }

  private processLanding(playerId: string) {
    const ps = this.playerStates.get(playerId);
    if (!ps) return;

    const cell = BOARD[ps.position];
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
          const colorCount = BOARD.filter(c => c.color === cell.color && (c.type === "property" || c.type === "utility")).length;
          const ownedCount = ownerState.properties.filter(pid => BOARD[pid]?.color === cell.color).length;
          const houses = Math.floor(ownedCount / Math.max(1, colorCount));
          const rentIdx = Math.min(houses, cell.rent.length - 1);
          let rent = cell.rent[rentIdx];
          if (ownerState.upgradedColors.has(cell.color)) rent *= 2;
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

    const cell = BOARD[ps.position];
    if (cell.type !== "property" && cell.type !== "utility") return { success: false, error: "Not a property" };
    if (this.getPropertyOwner(cell.id)) return { success: false, error: "Already owned" };
    if (ps.money < cell.price) return { success: false, error: "Not enough money" };

    ps.money -= cell.price;
    ps.properties.push(cell.id);

    const color = cell.color;
    const allColorProps = BOARD.filter(c => c.color === color && (c.type === "property" || c.type === "utility")).map(c => c.id);
    const ownedColorProps = ps.properties.filter(pid => allColorProps.includes(pid));
    if (ownedColorProps.length === allColorProps.length && !ps.upgradedColors.has(color)) {
      ps.upgradedColors.add(color);
      this.lastAction = `${this.getPlayerName(playerId)} completed ${color} set — rent doubled!`;
    }

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
    // Transfer properties
    for (const pid of proposal.offerProperties) {
      fromPs.properties = fromPs.properties.filter(p => p !== pid);
      toPs.properties.push(pid);
    }
    for (const pid of proposal.requestProperties) {
      toPs.properties = toPs.properties.filter(p => p !== pid);
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
    for (const cell of BOARD) {
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
      const cell = BOARD[ps.position];
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
      board: BOARD,
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
