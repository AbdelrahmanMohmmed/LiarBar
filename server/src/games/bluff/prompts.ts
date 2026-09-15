/**
 * The prompt deck for Bluff.
 *
 * ## What makes a prompt work here
 *
 * Every prompt is a sentence with one word or short phrase missing, and one
 * true answer. The entire game lives or dies on the gap between two things:
 *
 * 1. **Most of the table must not know the answer.** If everyone knows it, the
 *    truth is obvious, nobody is fooled, and the round is a formality. That
 *    rules out most "capital of…" trivia.
 *
 * 2. **Everyone must be able to invent something plausible in 45 seconds.**
 *    If the shape of the answer isn't obvious from the sentence — a country, a
 *    body part, an animal, an everyday object — players freeze and submit
 *    nothing. That rules out most numbers: "the tower is ___ metres tall" is
 *    answerable by anyone with a keyboard and interesting to no one.
 *
 * The sweet spot is a **surprising true fact whose answer is an ordinary
 * word**. "Sudan" has more pyramids than Egypt. Wombat droppings are cubes.
 * Scotland's national animal is a unicorn. Everyone can guess a country, a
 * shape, an animal — and almost nobody knows which one is right.
 *
 * ## On the Arabic
 *
 * These are written twice, not translated once. An Arabic prompt has to have
 * its blank fall somewhere natural for the sentence, which is frequently not
 * where it falls in English, and the answer has to be a phrase an Arabic
 * speaker would actually type. A few prompts lean on regional knowledge
 * deliberately (Fez, Yemen, koshari): they're the ones where the table
 * divides, which is the best kind of round.
 *
 * ## Truthfulness
 *
 * Every answer here is a fact someone could look up and confirm, because the
 * one thing that kills this game is a table arguing that the "true" answer is
 * wrong. Where a fact is commonly stated but fuzzy at the edges, the sentence
 * is hedged so the answer is still the only defensible one.
 */

export interface BluffPrompt {
  id: string;
  /** The sentence, with `___` marking the blank. */
  text: { en: string; ar: string };
  /** The true answer, short enough to sit next to the lies. */
  answer: { en: string; ar: string };
}

export const PROMPTS: BluffPrompt[] = [
  {
    id: "pyramids",
    text: {
      en: "The country with the most pyramids in the world is ___.",
      ar: "الدولة اللي فيها أكبر عدد أهرامات في العالم هي ___.",
    },
    answer: { en: "Sudan", ar: "السودان" },
  },
  {
    id: "oldest-university",
    text: {
      en: "The oldest continuously operating university in the world is in ___.",
      ar: "أقدم جامعة ما زالت تعمل بلا انقطاع في العالم موجودة في ___.",
    },
    answer: { en: "Morocco", ar: "المغرب" },
  },
  {
    id: "wombat",
    text: {
      en: "Wombat droppings are famously ___.",
      ar: "فضلات الومبات مشهورة بإنها ___.",
    },
    answer: { en: "cube-shaped", ar: "مكعّبة الشكل" },
  },
  {
    id: "scotland",
    text: {
      en: "Scotland's national animal is the ___.",
      ar: "الحيوان الوطني لاسكتلندا هو ___.",
    },
    answer: { en: "unicorn", ar: "وحيد القرن الخرافي" },
  },
  {
    id: "octopus",
    text: {
      en: "An octopus has three ___.",
      ar: "الأخطبوط عنده ثلاثة ___.",
    },
    answer: { en: "hearts", ar: "قلوب" },
  },
  {
    id: "shrimp-heart",
    text: {
      en: "A shrimp's heart is located in its ___.",
      ar: "قلب الجمبري موجود في ___.",
    },
    answer: { en: "head", ar: "رأسه" },
  },
  {
    id: "sahara",
    text: {
      en: "Six thousand years ago, most of the Sahara was covered in ___.",
      ar: "قبل ستة آلاف سنة، معظم الصحراء الكبرى كانت مغطاة بـ ___.",
    },
    answer: { en: "grass and lakes", ar: "عشب وبحيرات" },
  },
  {
    id: "great-wall",
    text: {
      en: "Parts of the Great Wall of China are held together with ___.",
      ar: "بعض أجزاء سور الصين العظيم متماسكة بواسطة ___.",
    },
    answer: { en: "sticky rice", ar: "الأرز اللزج" },
  },
  {
    id: "bubble-wrap",
    text: {
      en: "Bubble wrap was originally invented to be sold as ___.",
      ar: "ورق الفقاعات اختُرع أصلاً ليُباع كـ ___.",
    },
    answer: { en: "wallpaper", ar: "ورق حائط" },
  },
  {
    id: "pringles",
    text: {
      en: "The man who designed the Pringles can asked to be buried in ___.",
      ar: "الرجل اللي صمّم علبة البرينجلز طلب إنه يُدفن في ___.",
    },
    answer: { en: "a Pringles can", ar: "علبة برينجلز" },
  },
  {
    id: "ebay",
    text: {
      en: "The first item ever sold on eBay was a broken ___.",
      ar: "أول شيء انباع على موقع إيباي كان ___ مكسور.",
    },
    answer: { en: "laser pointer", ar: "مؤشّر ليزر" },
  },
  {
    id: "camels",
    text: {
      en: "Saudi Arabia imports large numbers of ___ from Australia.",
      ar: "السعودية تستورد أعداداً كبيرة من ___ من أستراليا.",
    },
    answer: { en: "camels", ar: "الجِمال" },
  },
  {
    id: "algebra",
    text: {
      en: "The word 'algebra' comes from an Arabic word meaning ___.",
      ar: "كلمة 'الجبر' في الأصل تعني ___.",
    },
    answer: { en: "putting broken parts back together", ar: "إعادة تركيب المكسور" },
  },
  {
    id: "numerals",
    text: {
      en: "The digits we call Arabic numerals were first developed in ___.",
      ar: "الأرقام اللي نسمّيها عربية تطوّرت أول ما تطوّرت في ___.",
    },
    answer: { en: "India", ar: "الهند" },
  },
  {
    id: "coffee-trade",
    text: {
      en: "Coffee was first cultivated and traded as a drink in ___.",
      ar: "أول مكان زُرع فيه البن وتُوجر به كمشروب هو ___.",
    },
    answer: { en: "Yemen", ar: "اليمن" },
  },
  {
    id: "petra",
    text: {
      en: "The city of Petra in Jordan was carved out of the rock by the ___.",
      ar: "مدينة البتراء في الأردن نحتها في الصخر ___.",
    },
    answer: { en: "Nabataeans", ar: "الأنباط" },
  },
  {
    id: "koshari",
    text: {
      en: "Egyptian koshari is rice, lentils and ___.",
      ar: "الكشري المصري رز وعدس و ___.",
    },
    answer: { en: "pasta", ar: "مكرونة" },
  },
  {
    id: "argan",
    text: {
      en: "In Morocco, goats are famous for climbing ___ trees.",
      ar: "في المغرب، المعز مشهورة بإنها تتسلّق شجر ___.",
    },
    answer: { en: "argan", ar: "الأركان" },
  },
  {
    id: "fortune",
    text: {
      en: "In Turkey and the Levant, fortunes are traditionally read from ___.",
      ar: "في تركيا وبلاد الشام، الفأل يُقرأ عادةً من ___.",
    },
    answer: { en: "coffee grounds", ar: "تفل القهوة" },
  },
  {
    id: "sharks-trees",
    text: {
      en: "Sharks have existed on Earth for longer than ___.",
      ar: "أسماك القرش موجودة على الأرض من قبل ___.",
    },
    answer: { en: "trees", ar: "الأشجار" },
  },
  {
    id: "venus-day",
    text: {
      en: "On Venus, a single day is longer than a whole ___.",
      ar: "على كوكب الزهرة، اليوم الواحد أطول من ___ كامل.",
    },
    answer: { en: "year", ar: "عام" },
  },
  {
    id: "flamingos",
    text: {
      en: "The collective noun for a group of flamingos is a ___.",
      ar: "مجموعة طيور الفلامنجو تُسمّى ___.",
    },
    answer: { en: "flamboyance", ar: "استعراض" },
  },
  {
    id: "starlings",
    text: {
      en: "A 'murmuration' is a huge swirling flock of ___.",
      ar: "الـ'murmuration' هو سرب ضخم متموّج من ___.",
    },
    answer: { en: "starlings", ar: "طيور الزرزور" },
  },
  {
    id: "chickens",
    text: {
      en: "There are more ___ alive on Earth right now than people.",
      ar: "عدد ___ الأحياء على الأرض الآن أكبر من عدد البشر.",
    },
    answer: { en: "chickens", ar: "الدجاج" },
  },
  {
    id: "tittle",
    text: {
      en: "The dot above a lowercase 'i' has a name: it's called a ___.",
      ar: "النقطة اللي فوق حرف الـ i الصغير لها اسم، اسمها ___.",
    },
    answer: { en: "tittle", ar: "تِتِل" },
  },
  {
    id: "camel-hump",
    text: {
      en: "A camel's hump stores ___, not water.",
      ar: "سنام الجمل يخزّن ___، مش ماء.",
    },
    answer: { en: "fat", ar: "دهون" },
  },
  {
    id: "honey",
    text: {
      en: "Honey found sealed in ancient Egyptian tombs was still ___.",
      ar: "العسل اللي لقوه مختوماً في المقابر المصرية القديمة كان لسه ___.",
    },
    answer: { en: "edible", ar: "صالحاً للأكل" },
  },
  {
    id: "eiffel",
    text: {
      en: "The Eiffel Tower is about 15 centimetres taller in ___.",
      ar: "برج إيفل يزيد طوله حوالي ١٥ سنتيمتر في ___.",
    },
    answer: { en: "summer", ar: "الصيف" },
  },
  {
    id: "ramen-museum",
    text: {
      en: "Japan has an entire museum dedicated to ___.",
      ar: "في اليابان متحف كامل مخصّص لـ ___.",
    },
    answer: { en: "instant noodles", ar: "النودلز سريعة التحضير" },
  },
  {
    id: "guinea-pig",
    text: {
      en: "Swiss animal welfare law effectively bans owning just one ___.",
      ar: "قانون الرفق بالحيوان السويسري عملياً يمنع اقتناء ___ واحد بمفرده.",
    },
    answer: { en: "guinea pig", ar: "خنزير غينيا" },
  },
  {
    id: "shortest-war",
    text: {
      en: "The shortest war in recorded history was over in under an ___.",
      ar: "أقصر حرب في التاريخ المسجّل انتهت في أقل من ___.",
    },
    answer: { en: "hour", ar: "ساعة" },
  },
  {
    id: "knocker-upper",
    text: {
      en: "Before cheap alarm clocks, a 'knocker-upper' woke you by firing dried ___ at your window.",
      ar: "قبل ما تنتشر المنبّهات، كان في ناس شغلتها توقّظك برمي ___ مجفّف على شبّاكك.",
    },
    answer: { en: "peas", ar: "بازلاء" },
  },
  {
    id: "longest-name",
    text: {
      en: "The world's longest official place name belongs to a hill in ___.",
      ar: "أطول اسم مكان رسمي في العالم يخص تلّة في ___.",
    },
    answer: { en: "New Zealand", ar: "نيوزيلندا" },
  },
  {
    id: "nutmeg",
    text: {
      en: "Eaten in large amounts, the spice ___ is genuinely poisonous.",
      ar: "لو أُكل بكميات كبيرة، بهار ___ سام فعلاً.",
    },
    answer: { en: "nutmeg", ar: "جوزة الطيب" },
  },
  {
    id: "cleopatra",
    text: {
      en: "Cleopatra lived closer in time to the Moon landing than to the building of the ___.",
      ar: "كليوباترا عاشت أقرب زمنياً للهبوط على القمر من ___.",
    },
    answer: { en: "Great Pyramid", ar: "بناء الهرم الأكبر" },
  },
  {
    id: "banana-berry",
    text: {
      en: "Botanically, a banana is a berry — but a ___ is not.",
      ar: "نباتياً، الموزة تُعتبر توتة — لكن ___ لأ.",
    },
    answer: { en: "strawberry", ar: "الفراولة" },
  },
  {
    id: "sand-island",
    text: {
      en: "The largest sand island in the world is off the coast of ___.",
      ar: "أكبر جزيرة رملية في العالم تقع قبالة سواحل ___.",
    },
    answer: { en: "Australia", ar: "أستراليا" },
  },
  {
    id: "uae-weekend",
    text: {
      en: "In 2022 the UAE moved its official weekend to line up with ___.",
      ar: "في ٢٠٢٢ غيّرت الإمارات عطلتها الرسمية لتتماشى مع ___.",
    },
    answer: { en: "the rest of the world", ar: "بقية العالم" },
  },
];

/**
 * Deal prompts for a match without repeats.
 *
 * A repeated prompt is worse here than in most games: the second time round
 * everyone already knows the true answer, so nobody can be fooled and the
 * round scores nothing for anybody. Shuffling the whole deck once per match
 * and dealing off the top makes that impossible for the first 38 rounds, which
 * is considerably longer than any evening.
 */
export function dealPrompts(count: number): BluffPrompt[] {
  const deck = [...PROMPTS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, Math.min(count, deck.length));
}

/**
 * Normalise an answer for comparison.
 *
 * Used to spot two players who wrote the same lie, and a player who
 * accidentally wrote the truth. Case, surrounding whitespace, Arabic
 * diacritics and the usual alef/ya/ta-marbuta spelling variants are all noise
 * here: "الهند" and "الهند " are the same answer, and a table that saw them
 * listed twice would rightly think the game was broken.
 */
export function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat and tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
