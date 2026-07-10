# Higher or Lower (أعلى أو أقل) — Full Design Document (AR/EN)

Bilingual (Arabic/English) Higher or Lower game for **Safariyat Games**, built on the existing Liar's Bar server/client architecture and rendered in the same warm sticker-style theme as the landing page.

This document is the single source of truth for the game implementation.

---

## 1. Product Summary & Goal

- **Game Name**: "أعلى أو أقل" (Higher or Lower).
- **Core Concept**: Each player is assigned a unique secret random number between `1` and `99` (inclusive) at the start of a round.
- **Turn-Based Guessing**: Players take turns entering a guess for their secret number.
- **Game Feedback**: When a player guesses:
  - If they are **correct**, they win the round and receive points.
  - If they are **incorrect**, their bounds are updated:
    - If the guess is lower than the secret number, the lower bound is updated (e.g., `> 50`).
    - If the guess is higher than the secret number, the upper bound is updated (e.g., `< 80`).
- **Scoring (Race to 10)**: The game is a race to reach `10` points.
  - **Single Win**: Guessing correctly on a round gives `+1` point.
  - **Consecutive Wins (Streak)**: If a player wins two rounds in a row, they get `+2` points for the second win. If they continue their consecutive streak, they receive `+2` points for each subsequent win.
  - **Streak Reset**: If another player wins a round, the active streak for all other players is reset to `0`.
- **Round End & Recap**: The round ends immediately when any player guesses their secret number correctly. A 6-second round recap phase starts, showing:
  - The winner and the points they gained.
  - The secret numbers of **all** players.
  - After 6 seconds, a new round begins automatically with new secret numbers.
- **Microphone & Voice**: Built-in voice chat controls (mic toggle) utilizing the existing WebRTC signaling logic.
- **Room Link Sharing**: 
  - **Copy Link button**: Copies the room URL to the clipboard.
  - **Share button**: Triggers native device sharing (`navigator.share`), falling back to copying the link.
- **Numeric Room IDs**: Room IDs will be changed to be numbers-only (6 digits) for easy typing and verbal sharing.

---

## 2. Visual Theme & UI Spec

All style elements must match the landing page theme (warm, sticker-style, hard-bordered panels). Do not invent new colors.

### 2.1 Color Tokens

| Token | Hex | Usage in Higher or Lower |
|---|---|---|
| `cream` | `#FDF6EC` | Main page background |
| `ink` | `#2B2420` | Hard borders, primary text, buttons |
| `red` | `#E8574A` | "Lower" direction (down-arrow circle), primary action buttons |
| `teal` | `#3AA6A6` | "Higher" direction (up-arrow circle), success states |
| `peach` | `#F4C89A` | Leaderboard panels, secondary button backs |
| `white` | `#FFFFFF` | Core panel backgrounds, card faces |
| `textSecondary` | `#5B5147` | Body details, subtitles |
| `textMuted` | `#8A7F73` | Countdown timers, offline states, placeholder text |

### 2.2 Borders & Shadows

- **Main Panels**: `background: #FFFFFF`, `border: 3px solid #2B2420`, `borderRadius: 24px`, `boxShadow: 6px 6px 0px #2B2420`.
- **Player/Guessing Cards**: `background: #FFFFFF`, `border: 2px solid #2B2420`, `borderRadius: 16px`, `boxShadow: 4px 4px 0px rgba(43,36,32,0.15)`.
- **Round Bounds Indicators**: Circular badges, e.g., a green circle (`#3AA6A6`) for `>` and a red circle (`#E8574A`) for `<`.
- **Buttons**: Pill-shaped (`borderRadius: 999px`), bold text, no borders for primary solid fills, or `2px solid #2B2420` borders for secondary outlined buttons.

### 2.3 Typography & RTL

- **Fonts**: `'Tajawal', sans-serif` for Arabic UI/content; `'Baloo 2', sans-serif` for English UI/content.
- **RTL Support**: Standard page container detects language via the `useLanguage()` hook. Layout shifts (like alignment and arrow indicators) mirror dynamically (`dir="rtl"` vs `dir="ltr"`).

---

## 3. Screen States

The interface shifts across four primary screens:

### 3.1 Lobby Screen
- **Settings Panel**: 
  - Host can select `maxPlayers` (2 to 6).
  - Target score is locked to `10` points.
  - Turn timer is set to `15` seconds (customizable option).
- **Player List**: Displays all joined players, avatar placeholders, and a "Host" badge. Includes "Add Bot" options for the host.
- **Sharing Section**:
  - Displays the numeric Room ID (e.g., `210856`).
  - Copy Link button.
  - Open Share button.
- **Start Game Button**: Host only, active when $\ge 2$ players are in the room.

### 3.2 Game Screen (Active Round)
- **Top Bar**:
  - Room Code display.
  - "How to Play" (كيفية اللعب) modal trigger.
  - Voice controls (Mic button with connecting/muted/active visual states).
- **Leaderboard Header Card**:
  - Collapsible card showing ranked standings.
  - Winner reaches 10 points. Displays current scores and streaks (e.g., Sara: 9 points, 1 streak).
- **Active Guess Indicator Card**:
  - Prominently shows the active player's bounds:
    - **Lower Limit**: Circle with `--` or a number + Green Up Arrow ($\uparrow$).
    - **Upper Limit**: Circle with `--` or a number + Red Down Arrow ($\downarrow$).
  - **Status Text**: "Waiting for [PlayerName]..." or "Your Turn! Guess your number (1-99)".
  - **Turn Timer**: A circular progress countdown showing remaining seconds (e.g., `13 ثانية` with a yellow timer icon).
- **Guess Input Box (Active Player Only)**:
  - Large text input box for number entry (1-99).
  - "Send" (إرسال) button (Red background, ink border, sticker shadow).
- **Other Players List**:
  - Shows each player's avatar, name, current score, and their current bounds.
  - Highlights the current active player with a thick purple border and soft pop-in animation.
- **Chat Box**:
  - Located at the bottom. A collapsible tray showing recent chat logs and a send message input.

### 3.3 Round Recap Screen
- Overlay modal or screen panel displayed for 6 seconds between rounds.
- Displays:
  - **Winner Name**: "Sara won the round!" (فازت Sara بالجولة!).
  - **Score Update**: "+1 point" or "+2 points (Consecutive Win!)".
  - **Secret Numbers**: Shows a grid of all players and the exact secret numbers they were trying to guess.
  - **Countdown**: "Next round starts in 5s...".

### 3.4 Game Over Screen
- Triggered when a player reaches 10 points.
- Displays:
  - Podium (1st, 2nd, 3rd) with player names and total scores.
  - Rematch button (Host only) to restart the game.
  - Return to Arcade button.

---

## 4. Game Rules & Logic State Machine

```
                  ┌──────────────────────┐
                  │        LOBBY         │
                  └──────────┬───────────┘
                             │
                        (startGame)
                             ▼
                  ┌──────────────────────┐
                  │       PLAYING        │◄──────────────────┐
                  └──────────┬───────────┘                   │
                             │                               │
                       (correct guess)                 (next round)
                             ▼                               │
                  ┌──────────────────────┐                   │
                  │     ROUND_RECAP      ├───────────────────┘
                  └──────────┬───────────┘
                             │
                     (score reaches 10)
                             ▼
                  ┌──────────────────────┐
                  │      GAME_OVER       │
                  └──────────────────────┘
```

### 4.1 Turn Order
- At the start of a game, turn order is randomized based on connected players.
- Turn rotation is sequential: $P_1 \rightarrow P_2 \rightarrow \dots \rightarrow P_n \rightarrow P_1$.
- Only connected players and active bots take turns.

### 4.2 Handling Guesses
When player $P$ makes a guess $G$:
1. If $G$ is not an integer between 1 and 99, reject the guess.
2. Let $S$ be the secret number of player $P$.
3. **If $G == S$ (Correct)**:
   - Player $P$ wins the round.
   - Update $P$'s streak: $Streak_P = Streak_P + 1$.
   - Calculate points gained:
     - If $Streak_P \ge 2$: $+2$ points.
     - Else: $+1$ point.
   - Update score: $Score_P = Score_P + PointsGained$.
   - Reset streaks of all other players: For each player $O \ne P$, $Streak_O = 0$.
   - Check Win Condition:
     - If $Score_P \ge 10$, transition to `GAME_OVER` phase.
     - Else, transition to `ROUND_RECAP` phase, populate recap info, and start a 6-second timer to trigger the next round.
4. **If $G \ne S$ (Incorrect)**:
   - If $G < S$ (Secret is higher):
     - Update lower bound: $LowerBound_P = \max(LowerBound_P \text{ or } 0, G)$.
     - Set last guess result for $P$: `lastGuess = G`, `lastGuessResult = "higher"`.
   - If $G > S$ (Secret is lower):
     - Update upper bound: $UpperBound_P = \min(UpperBound_P \text{ or } 100, G)$.
     - Set last guess result for $P$: `lastGuess = G`, `lastGuessResult = "lower"`.
   - Shift turn to the next player in order.
   - Reset the turn timer.

### 4.3 Bot Logic
- When it is a Bot's turn:
  - The bot analyzes its current bounds ($LowerBound$ and $UpperBound$).
  - If a bound is null, treat it as 1 (lower) or 99 (upper).
  - The bot selects a number $G$ within its valid range.
    - **Easy Bot**: Selects a completely random number between $LowerBound + 1$ and $UpperBound - 1$.
    - **Medium Bot**: Selects a random number with a slight bias towards the middle of the range.
    - **Hard Bot**: Always selects the perfect binary search midpoint: $\lfloor \frac{LowerBound + UpperBound}{2} \rfloor$.
  - The bot submits the guess after a simulated delay of 1.5 to 3 seconds.

### 4.4 Turn Timeout
- If a player fails to submit a guess before `turnDeadline` is reached:
  - Their turn is skipped.
  - Turn order rotates to the next player.
  - Turn timer resets.

---

## 5. Server Architecture & State

### 5.1 Game Engine File structure
- `server/src/games/higher-lower/HigherLowerGame.ts`: Implements `GameRoom` interface.
- `server/src/games/higher-lower/HigherLowerPlayer.ts`: Extends base player representation to track points, streaks, secret numbers, and bounds.

### 5.2 Server State Representation

```typescript
export interface HigherLowerPlayerState {
  playerId: string;
  score: number;
  streak: number;
  lowerBound: number | null;
  upperBound: number | null;
  lastGuess: number | null;
  lastGuessResult: "higher" | "lower" | "correct" | null;
  isTurn: boolean;
}

export interface HigherLowerRoundRecap {
  winnerId: string;
  winnerName: string;
  winnerScore: number;
  winnerStreak: number;
  pointsGained: number;
  secretNumbers: Record<string, number>;
}

export interface HigherLowerState {
  roomId: string;
  gameId: "higher-lower";
  phase: "lobby" | "playing" | "round_recap" | "game_over";
  maxPlayers: number;
  players: PlayerData[];
  playerStates: Record<string, HigherLowerPlayerState>;
  activePlayerId: string | null;
  turnTimeLimit: number;
  turnDeadline: number | null;
  roundNumber: number;
  winnerId: string | null;
  recap: HigherLowerRoundRecap | null;
}
```

### 5.3 Player Private Hand Serialization
- The server will implement `toState()` to send public information to all clients.
- The server will implement `toPlayerState(playerId: string)` to include the individual secret number for the destination socket inside `mySecretNumber` (hidden from other clients during active rounds).

---

## 6. Socket API Spec

### 6.1 Client to Server Events

#### `higher_lower_guess`
Submits a guess for the active player.
- **Payload**:
  ```typescript
  {
    guess: number; // must be 1-99
  }
  ```
- **Response / Ack**:
  ```typescript
  {
    success: boolean;
    error?: string;
  }
  ```

#### `higher_lower_rematch`
Requests a rematch (host only, during `game_over` phase).
- **Payload**: `{}`
- **Response / Ack**:
  ```typescript
  {
    success: boolean;
    error?: string;
  }
  ```

### 6.2 Server Broadcast Events

#### `room_state`
Dispatched automatically when room state changes.
- **Payload**: `HigherLowerState`

---

## 7. Client Integration Plan

### 7.1 GameContext Extensions (`web/src/lib/gameContext.tsx`)
- Add `higherLowerState` state variable.
- In the connection socket listener, handle state payloads with `gameId === "higher-lower"` by updating `higherLowerState`.
- Expose actions:
  - `higherLowerGuess(guess: number)`: Emits `higher_lower_guess`.
  - `higherLowerRematch()`: Emits `higher_lower_rematch`.

### 7.2 Routing & Pages (`web/src/App.tsx`)
Add routes:
- `/higher-lower` -> `HigherLowerHome.tsx` (join/create screen matching landing theme).
- `/higher-lower/room/:roomId` -> `HigherLowerRoom.tsx` (lobby screen).
- `/higher-lower/game/:roomId` -> `HigherLowerGame.tsx` (actual gameplay screen).

### 7.3 Shared Theme & Layout
- Reuse visual patterns from Codenames and Landing: cream background (`#FDF6EC`), Baloo 2 and Tajawal fonts, sticker cards, and button shadows.
- Render the `VoiceControls` component in the game header.
- Implement clipboard copy and `navigator.share` inside `HigherLowerRoom.tsx` and `HigherLowerGame.tsx` to satisfy room link sharing.

---

## 8. Detailed Task Breakdown

### Phase 1: Shared Core Changes
- [ ] **Task 1: Numeric Room IDs**
  - Modify `server/src/core/RoomRegistry.ts` to use digits-only for the custom alphabet generator:
    ```typescript
    const roomCode = customAlphabet("0123456789", 6);
    ```
  - Verify that this doesn't break room matching (room validation regexes should support numeric inputs).

### Phase 2: Backend Implementation
- [ ] **Task 2: Game Classes & Initialization**
  - Create `server/src/games/higher-lower/HigherLowerPlayer.ts` defining player properties (score, streak, secret number, bounds).
  - Create `server/src/games/higher-lower/HigherLowerGame.ts` implementing `GameRoom`. Handlers for player join/leave/reconnect and bot addition.
- [ ] **Task 3: Turn State Machine & Guess Processing**
  - Implement guess validation and processing in `HigherLowerGame.ts`.
  - Add turn-switching order logic and round-winning checks.
  - Implement point calculations (including consecutive wins logic).
  - Setup turn timer logic (15s deadline) and timeout handler.
- [ ] **Task 4: Round Recap & State Serialization**
  - Implement the 6-second round recap state transition and automated trigger for subsequent rounds.
  - Write state serializers `toState()` and `toPlayerState()` ensuring player secret numbers are hidden from opponents.
- [ ] **Task 5: Registry & Socket Event Registration**
  - Register `higher-lower` in `server/src/games/registry.ts`.
  - Map guess and rematch events in `server/src/socket/handlers.ts` using a `higherLowerMembership` helper.

### Phase 3: Frontend Implementation
- [ ] **Task 6: Types & Context Wiring**
  - Add types to `web/src/lib/types.ts`.
  - Update `web/src/lib/gameContext.tsx` to handle `higher-lower` state and actions (`higherLowerGuess`, `higherLowerRematch`).
- [ ] **Task 7: Home & Room Lobby UI**
  - Build `HigherLowerHome.tsx` and `HigherLowerRoom.tsx` in `web/src/pages/higher-lower/` following the warm landing page sticker styling.
  - Incorporate the Copy Link and Share buttons.
- [ ] **Task 8: Game Screen & Bounds Panel**
  - Build `HigherLowerGame.tsx` with sections for standings, current bounds (large circular arrow indicators), guess submission input, and opponent bounds list.
  - Integrate `<VoiceControls roomId={roomId} />` in the header bar.
  - Embed the Chat component.
- [ ] **Task 9: Recap Overlay & Game Over Views**
  - Build the round recap overlay (visible during the `round_recap` phase showing everyone's secret numbers).
  - Build the Game Over screen showing the podium list and rematch triggers.
