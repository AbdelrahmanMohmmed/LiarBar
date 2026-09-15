/**
 * Dilemmas for Would You Rather — لو خيروك.
 *
 * ## What makes one work
 *
 * The game is not "which would you pick". It's "can your friends predict which
 * you'd pick", and that changes what a good dilemma looks like entirely:
 *
 * 1. **Neither option can be obviously correct.** "Would you rather have a
 *    million pounds or a broken leg" is not a dilemma, it's a question. If
 *    everyone predicts correctly, nobody scores and nothing happens.
 * 2. **The split should be roughly even *across people*, but strong within
 *    one.** The best ones are the ones where each individual is certain and
 *    the table is divided — that's where "wait, you'd pick THAT?" comes from,
 *    and that reaction is the whole product.
 * 3. **It must be about the person, not about facts.** A dilemma you answer by
 *    reasoning is a puzzle; a dilemma you answer by being yourself is a game
 *    about knowing your friends.
 * 4. **No dilemma that ends the evening.** Nothing about death, illness,
 *    family tragedy, religion or politics. This is a game people play with
 *    their friends at midnight, and one badly-judged card is enough to make a
 *    group stop playing and not come back.
 *
 * The Arabic is written alongside the English rather than translated from it —
 * several of these only work in one language and have a different, equally
 * natural counterpart in the other.
 */

export interface Dilemma {
  id: string;
  a: { en: string; ar: string };
  b: { en: string; ar: string };
  /** Grouping, so a round can be themed later. Not used yet. */
  tag: "everyday" | "social" | "silly" | "money" | "food" | "tech";
}

export const DILEMMAS: Dilemma[] = [
  {
    id: "phone-wallet",
    a: { en: "Lose your phone for a week", ar: "تضيّع موبايلك أسبوع" },
    b: { en: "Lose your wallet for a week", ar: "تضيّع محفظتك أسبوع" },
    tag: "everyday",
  },
  {
    id: "early-late",
    a: { en: "Always be 20 minutes early", ar: "توصل دايماً بدري 20 دقيقة" },
    b: { en: "Always be 20 minutes late", ar: "توصل دايماً متأخر 20 دقيقة" },
    tag: "everyday",
  },
  {
    id: "ac-wifi",
    a: { en: "No air conditioning all summer", ar: "من غير تكييف الصيف كله" },
    b: { en: "No wifi at home all summer", ar: "من غير نت في البيت الصيف كله" },
    tag: "everyday",
  },
  {
    id: "koshari-shawarma",
    a: { en: "Only eat koshari for a month", ar: "تاكل كشري بس شهر" },
    b: { en: "Only eat shawarma for a month", ar: "تاكل شاورما بس شهر" },
    tag: "food",
  },
  {
    id: "tea-coffee",
    a: { en: "Never drink tea again", ar: "متشربش شاي تاني" },
    b: { en: "Never drink coffee again", ar: "متشربش قهوة تاني" },
    tag: "food",
  },
  {
    id: "sweet-savoury",
    a: { en: "Give up sweets forever", ar: "تبطل حلويات للأبد" },
    b: { en: "Give up bread forever", ar: "تبطل عيش للأبد" },
    tag: "food",
  },
  {
    id: "sing-dance",
    a: { en: "Sing at every wedding you attend", ar: "تغني في كل فرح تروحه" },
    b: { en: "Dance alone at every wedding you attend", ar: "ترقص لوحدك في كل فرح تروحه" },
    tag: "social",
  },
  {
    id: "read-thoughts",
    a: { en: "Know what everyone thinks of you", ar: "تعرف كل الناس بتفكر فيك إيه" },
    b: { en: "Never find out", ar: "متعرفش أبداً" },
    tag: "social",
  },
  {
    id: "group-chat",
    a: { en: "Your group chat is read out loud at a family dinner", ar: "جروبكم يتقري بصوت عالي في عزومة عيلة" },
    b: { en: "Your search history is read out loud at a family dinner", ar: "تاريخ بحثك يتقري بصوت عالي في عزومة عيلة" },
    tag: "tech",
  },
  {
    id: "always-truth",
    a: { en: "Never be able to lie", ar: "متقدرش تكدب خالص" },
    b: { en: "Never be believed when you tell the truth", ar: "محدش يصدقك لما تقول الصح" },
    tag: "social",
  },
  {
    id: "money-time",
    a: { en: "Double your money, half your free time", ar: "فلوسك بالدوبل، ووقتك بالنص" },
    b: { en: "Half your money, double your free time", ar: "فلوسك بالنص، ووقتك بالدوبل" },
    tag: "money",
  },
  {
    id: "lend-money",
    a: { en: "Lend a friend money and never get it back", ar: "تسلّف صاحبك فلوس وميرجعهاش" },
    b: { en: "Refuse and have them stay annoyed for a year", ar: "ترفض وتفضل زعلانة منك سنة" },
    tag: "money",
  },
  {
    id: "famous",
    a: { en: "Be famous and hated", ar: "تبقى مشهور والناس مش طايقاك" },
    b: { en: "Be unknown and loved by everyone who meets you", ar: "محدش يعرفك وكل اللي يقابلك يحبك" },
    tag: "social",
  },
  {
    id: "microbus-walk",
    a: { en: "Take a packed microbus for an hour", ar: "تركب ميكروباص مزنوق ساعة" },
    b: { en: "Walk for 45 minutes in August", ar: "تمشي 45 دقيقة في أغسطس" },
    tag: "everyday",
  },
  {
    id: "wake-up",
    a: { en: "Wake up at 5am every day", ar: "تصحى 5 الصبح كل يوم" },
    b: { en: "Never sleep before 3am", ar: "متنامش قبل 3 الفجر أبداً" },
    tag: "everyday",
  },
  {
    id: "spoilers",
    a: { en: "Know the ending of every film before watching", ar: "تعرف نهاية كل فيلم قبل ما تتفرج" },
    b: { en: "Never be able to rewatch anything", ar: "متقدرش تعيد أي حاجة تاني" },
    tag: "tech",
  },
  {
    id: "voice-notes",
    a: { en: "Only communicate in voice notes", ar: "تتكلم بفويس نوتس بس" },
    b: { en: "Only communicate in text, never a call", ar: "تكتب بس، من غير أي مكالمة" },
    tag: "tech",
  },
  {
    id: "apologise",
    a: { en: "Always apologise first, even when you're right", ar: "تعتذر انت الأول دايماً حتى لو انت صح" },
    b: { en: "Never apologise, even when you're wrong", ar: "متعتذرش أبداً حتى لو انت غلط" },
    tag: "social",
  },
  {
    id: "forget-names",
    a: { en: "Forget every name you hear", ar: "تنسى كل اسم تسمعه" },
    b: { en: "Forget every face you see", ar: "تنسى كل وش تشوفه" },
    tag: "silly",
  },
  {
    id: "loud-chew",
    a: { en: "Everyone you eat with chews loudly", ar: "كل اللي بتاكل معاهم بياكلوا بصوت" },
    b: { en: "Everyone you talk to interrupts you", ar: "كل اللي بتكلمهم بيقاطعوك" },
    tag: "silly",
  },
  {
    id: "no-music",
    a: { en: "Never listen to music again", ar: "متسمعش أغاني تاني" },
    b: { en: "Never watch a film again", ar: "متتفرجش على أفلام تاني" },
    tag: "everyday",
  },
  {
    id: "team-lose",
    a: { en: "Your team wins every match but you never watch", ar: "فريقك يكسب كل ماتش وانت متتفرجش" },
    b: { en: "You watch every match but they always draw", ar: "تتفرج على كل ماتش وهما دايماً يتعادلوا" },
    tag: "social",
  },
  {
    id: "always-cold",
    a: { en: "Be slightly too cold, always", ar: "تحس ببرد خفيف طول الوقت" },
    b: { en: "Be slightly too hot, always", ar: "تحس بحر خفيف طول الوقت" },
    tag: "everyday",
  },
  {
    id: "no-privacy",
    a: { en: "Your parents see every photo on your phone", ar: "أهلك يشوفوا كل صورة في موبايلك" },
    b: { en: "Your boss sees every photo on your phone", ar: "مديرك يشوف كل صورة في موبايلك" },
    tag: "tech",
  },
  {
    id: "speak-langs",
    a: { en: "Speak every language badly", ar: "تتكلم كل اللغات بشكل وحش" },
    b: { en: "Speak one extra language perfectly", ar: "تتكلم لغة واحدة زيادة بإتقان" },
    tag: "silly",
  },
  {
    id: "first-last",
    a: { en: "Always go first at everything", ar: "تبدأ انت الأول في كل حاجة" },
    b: { en: "Always go last at everything", ar: "تيجي انت الأخير في كل حاجة" },
    tag: "silly",
  },
  {
    id: "unlimited-food",
    a: { en: "Free food forever, but you never choose it", ar: "أكل ببلاش للأبد، بس انت مش بتختاره" },
    b: { en: "Pay for everything, but always exactly what you want", ar: "تدفع على كل حاجة، بس دايماً اللي انت عايزه" },
    tag: "food",
  },
  {
    id: "host-guest",
    a: { en: "Host every gathering at your place", ar: "كل اللمات تبقى عندك" },
    b: { en: "Never host, always travel to theirs", ar: "متستضيفش أبداً، دايماً انت اللي رايح" },
    tag: "social",
  },
  {
    id: "old-phone",
    a: { en: "Use a phone from ten years ago", ar: "تستخدم موبايل من عشر سنين" },
    b: { en: "Use a brand new phone with no apps you like", ar: "موبايل جديد من غير أي تطبيق بتحبه" },
    tag: "tech",
  },
  {
    id: "win-lose-loud",
    a: { en: "Win, but never be allowed to mention it", ar: "تكسب، بس ممنوع تتكلم عن الموضوع" },
    b: { en: "Lose, but everyone thinks you won", ar: "تخسر، بس الكل فاكر إنك كسبت" },
    tag: "social",
  },
  {
    id: "traffic",
    a: { en: "Sit in traffic for an hour every day", ar: "تقعد في زحمة ساعة كل يوم" },
    b: { en: "Wake up an hour earlier every day to avoid it", ar: "تصحى بدري ساعة كل يوم عشان تهرب منها" },
    tag: "everyday",
  },
  {
    id: "photo-memory",
    a: { en: "Remember everything perfectly", ar: "تفتكر كل حاجة بالظبط" },
    b: { en: "Be able to forget anything you choose", ar: "تقدر تنسى أي حاجة تختارها" },
    tag: "silly",
  },
  {
    id: "secret",
    a: { en: "Know one secret about everyone you meet", ar: "تعرف سر واحد عن كل حد تقابله" },
    b: { en: "Have everyone know one secret about you", ar: "كل الناس تعرف سر واحد عنك" },
    tag: "social",
  },
  {
    id: "meal-repeat",
    a: { en: "Eat your mother's cooking every day forever", ar: "تاكل طبخ أمك كل يوم للأبد" },
    b: { en: "Eat at a different restaurant every day forever", ar: "تاكل في مطعم مختلف كل يوم للأبد" },
    tag: "food",
  },
  {
    id: "public-speak",
    a: { en: "Give a speech to 500 strangers", ar: "تتكلم قدام 500 غريب" },
    b: { en: "Give a speech to 10 people who know you well", ar: "تتكلم قدام 10 عارفينك كويس" },
    tag: "social",
  },
  {
    id: "no-complain",
    a: { en: "Never complain about anything again", ar: "متشتكيش من حاجة تاني" },
    b: { en: "Never be able to compliment anyone again", ar: "متمدحش حد تاني" },
    tag: "silly",
  },
];

export function pickDilemma(
  exclude: Set<string>,
  rng: () => number = Math.random,
): Dilemma {
  const pool = DILEMMAS.filter((d) => !exclude.has(d.id));
  // Once the deck is exhausted the round list wraps rather than stalling. A
  // repeat late in a long session is far better than "no more questions".
  const from = pool.length > 0 ? pool : DILEMMAS;
  return from[Math.floor(rng() * from.length)];
}
