export type Language = "en" | "ar";

const translations: Record<Language, Record<string, string>> = {
  en: {
    "lang.name": "English",
    "lang.switch_to": "العربية",

    // Top bar
    "game.claim_type_suit": "Suit Claim",
    "game.claim_type_rank": "Rank Claim",
    "game.current_claim": "Current Claim:",
    "game.revealing": "Revealing...",
    "game.playing": "Playing",
    "game.challenge_window": "Challenge Window",

    // Guide
    "guide.title": "How to Play Liar's Bar",
    "guide.objective_title": "Objective",
    "guide.objective": "Be the last player with cards in hand. Get rid of all your cards by playing them into the center pile, but beware — you can lie about what you play!",
    "guide.setup_title": "Setup",
    "guide.setup": "Each player is dealt a hand of cards. A central pile starts empty. Players take turns in clockwise order.",
    "guide.gameplay_title": "Gameplay",
    "guide.gameplay_turn": "On your turn, select one or more cards from your hand and place them face-down on the pile. You must declare a claim for what you're playing (e.g. '3x Hearts' or '2x Aces').",
    "guide.gameplay_claim": "If there is a current claim (e.g. 'Hearts'), your declaration MUST match it. You cannot start a new claim type — you can only choose which cards to play.",
    "guide.gameplay_bluff": "You may bluff! You can declare cards that don't match what you actually played. But be careful — other players can challenge you!",
    "guide.challenge_title": "Challenge (Call Liar!)",
    "guide.challenge": "After someone plays, there is a short window for others to call 'Liar!' If you suspect they lied about their cards, click 'Call Liar!' to challenge them.",
    "guide.challenge_result": "If the challenged player was lying — they take the entire pile. If they were telling the truth — the challenger takes the pile instead!",
    "guide.pass_title": "Passing",
    "guide.pass": "If you don't want to challenge, click 'Play Cards' to pass the challenge window and then play your own cards on your turn.",
    "guide.winning_title": "Winning",
    "guide.winning": "When a player runs out of cards, they are eliminated. The last player standing wins the game!",
    "guide.domino_title": "Domino Mode",
    "guide.domino": "In domino mode, you declare a number (0-6) that all your played dominoes supposedly contain. The required claim is based on the number value.",
    "guide.close": "Close",
  },
  ar: {
    "lang.name": "العربية",
    "lang.switch_to": "English",

    "game.claim_type_suit": "ادعاء النوع",
    "game.claim_type_rank": "ادعاء الرتبة",
    "game.current_claim": "الادعاء الحالي:",
    "game.revealing": "كشف البطاقات...",
    "game.playing": "جاري اللعب",
    "game.challenge_window": "نافذة التحدي",

    "guide.title": "كيفية اللعب في Liar's Bar",
    "guide.objective_title": "الهدف",
    "guide.objective": "كن آخر لاعب لديه بطاقات في يده. تخلص من جميع بطاقاتك بوضعها في الكومة الوسطى، لكن احذر — يمكنك الكذب بشأن ما تلعبه!",
    "guide.setup_title": "الإعداد",
    "guide.setup": "يتم توزيع بطاقات على كل لاعب. الكومة الوسطى تبدأ فارغة. يتناوب اللاعبون في اتجاه عقارب الساعة.",
    "guide.gameplay_title": "طريقة اللعب",
    "guide.gameplay_turn": "في دورك، اختر بطاقة أو أكثر من يدك وضعها مقلوبة على الكومة. يجب أن تعلن ادعاءً لما تلعبه (مثل '3 × قلوب' أو '2 × آص').",
    "guide.gameplay_claim": "إذا كان هناك ادعاء حالي (مثل 'قلوب')، يجب أن يتطابق إعلانك معه. لا يمكنك بدء نوع ادعاء جديد — يمكنك فقط اختيار البطاقات التي ستلعبها.",
    "guide.gameplay_bluff": "يمكنك الخداع! يمكنك إعلان بطاقات لا تتطابق مع ما لعبته فعليًا. لكن كن حذرًا — يمكن للاعبين الآخرين تحديّك!",
    "guide.challenge_title": "التحدي (اتصل بالكاذب!)",
    "guide.challenge": "بعد أن يلعب شخص ما، هناك نافذة قصيرة للآخرين ليقولوا 'كاذب!' إذا كنت تشك في أنهم كذبوا بشأن بطاقاتهم، انقر على 'اتصل بالكاذب!' لتحديهم.",
    "guide.challenge_result": "إذا كان اللاعب المُتحدى يكذب — يأخذ الكومة بأكملها. إذا كان صادقًا — يأخذ المُتحدي الكومة بدلاً من ذلك!",
    "guide.pass_title": "تخطي الدور",
    "guide.pass": "إذا كنت لا تريد التحدي، انقر على 'العب بطاقات' لتجاوز نافذة التحدي ثم العب بطاقاتك في دورك.",
    "guide.winning_title": "الفوز",
    "guide.winning": "عندما تنفد بطاقات اللاعب، يتم استبعاده. آخر لاعب يبقى يفوز باللعبة!",
    "guide.domino_title": "وضع الدومينو",
    "guide.domino": "في وضع الدومينو، تعلن عن رقم (0-6) يُفترض أن جميع قطع الدومينو التي لعبتها تحتوي عليه. الادعاء المطلوب يعتمد على قيمة الرقم.",
    "guide.close": "إغلاق",
  },
};

export function t(key: string, lang: Language): string {
  return translations[lang][key] ?? translations["en"][key] ?? key;
}

export default translations;
