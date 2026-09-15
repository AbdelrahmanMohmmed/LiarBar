/**
 * Topic grids for Chameleon (الحرباية).
 *
 * Each topic is a 4×4 grid of sixteen related words. Everyone sees the grid.
 * Everyone except the chameleon also knows which cell is the secret word.
 * Each player says exactly one word about it; the chameleon has to say
 * something that sounds like it belongs without knowing what it's describing.
 *
 * ## What makes a grid work
 *
 * A grid is not just "sixteen words about a thing". It has to satisfy three
 * conditions, and grids that fail any of them produce a bad round:
 *
 * 1. **Words must be mutually confusable.** If the grid is
 *    {lion, pencil, Tuesday, jealousy} then a single clue identifies the word
 *    instantly and the chameleon is caught before they open their mouth. Every
 *    word must plausibly attract several of the same clues.
 *
 * 2. **But not interchangeable.** If all sixteen are equally described by every
 *    clue, the innocents can't communicate either, and the round becomes a coin
 *    flip. The sweet spot is words that share a category but differ in one or
 *    two features you can hint at obliquely.
 *
 * 3. **Everyone must know all sixteen.** One obscure word and a player who
 *    drew it has nothing to say — and saying nothing is indistinguishable from
 *    being the chameleon, so an unfair accusation follows.
 *
 * The grids are bilingual and *parallel*, not translated: an Arabic player and
 * an English player in the same room see the same cell index with an equally
 * natural word in their own language. A literal translation of an English grid
 * produces words nobody uses, which breaks condition 3 in the language that
 * matters most here.
 */

export interface ChameleonTopic {
  id: string;
  title: { en: string; ar: string };
  /** Exactly 16, laid out as a 4×4 grid in this order. */
  words: Array<{ en: string; ar: string }>;
}

export const TOPICS: ChameleonTopic[] = [
  {
    id: "food",
    title: { en: "Things you eat", ar: "أكل" },
    words: [
      { en: "Koshari", ar: "كشري" },
      { en: "Falafel", ar: "طعمية" },
      { en: "Shawarma", ar: "شاورما" },
      { en: "Molokhia", ar: "ملوخية" },
      { en: "Kunafa", ar: "كنافة" },
      { en: "Rice pudding", ar: "أرز بلبن" },
      { en: "Grilled fish", ar: "سمك مشوي" },
      { en: "Pizza", ar: "بيتزا" },
      { en: "Burger", ar: "برجر" },
      { en: "Stuffed vine leaves", ar: "محشي ورق عنب" },
      { en: "Fava beans", ar: "فول" },
      { en: "Liver sandwich", ar: "سندوتش كبدة" },
      { en: "Grilled corn", ar: "ذرة مشوية" },
      { en: "Ice cream", ar: "آيس كريم" },
      { en: "Watermelon", ar: "بطيخ" },
      { en: "Dates", ar: "بلح" },
    ],
  },
  {
    id: "places",
    title: { en: "Places you go", ar: "أماكن" },
    words: [
      { en: "The coffee shop", ar: "القهوة" },
      { en: "The barber", ar: "الحلاق" },
      { en: "The beach", ar: "البحر" },
      { en: "The gym", ar: "الجيم" },
      { en: "The mall", ar: "المول" },
      { en: "School", ar: "المدرسة" },
      { en: "The hospital", ar: "المستشفى" },
      { en: "The market", ar: "السوق" },
      { en: "The cinema", ar: "السينما" },
      { en: "A wedding", ar: "فرح" },
      { en: "Grandma's house", ar: "بيت الجدة" },
      { en: "The airport", ar: "المطار" },
      { en: "The stadium", ar: "الاستاد" },
      { en: "The bank", ar: "البنك" },
      { en: "The pharmacy", ar: "الصيدلية" },
      { en: "Work", ar: "الشغل" },
    ],
  },
  {
    id: "jobs",
    title: { en: "Jobs", ar: "مهن" },
    words: [
      { en: "Doctor", ar: "دكتور" },
      { en: "Teacher", ar: "مدرس" },
      { en: "Taxi driver", ar: "سواق تاكسي" },
      { en: "Chef", ar: "شيف" },
      { en: "Engineer", ar: "مهندس" },
      { en: "Footballer", ar: "لاعب كورة" },
      { en: "Police officer", ar: "ظابط" },
      { en: "Singer", ar: "مطرب" },
      { en: "Farmer", ar: "فلاح" },
      { en: "Pilot", ar: "طيار" },
      { en: "Barber", ar: "حلاق" },
      { en: "Lawyer", ar: "محامي" },
      { en: "Journalist", ar: "صحفي" },
      { en: "Shopkeeper", ar: "بياع" },
      { en: "Nurse", ar: "ممرض" },
      { en: "Actor", ar: "ممثل" },
    ],
  },
  {
    id: "animals",
    title: { en: "Animals", ar: "حيوانات" },
    words: [
      { en: "Cat", ar: "قطة" },
      { en: "Dog", ar: "كلب" },
      { en: "Camel", ar: "جمل" },
      { en: "Horse", ar: "حصان" },
      { en: "Donkey", ar: "حمار" },
      { en: "Lion", ar: "أسد" },
      { en: "Snake", ar: "تعبان" },
      { en: "Eagle", ar: "نسر" },
      { en: "Fish", ar: "سمكة" },
      { en: "Mouse", ar: "فار" },
      { en: "Cow", ar: "بقرة" },
      { en: "Sheep", ar: "خروف" },
      { en: "Chicken", ar: "فرخة" },
      { en: "Monkey", ar: "قرد" },
      { en: "Elephant", ar: "فيل" },
      { en: "Crocodile", ar: "تمساح" },
    ],
  },
  {
    id: "household",
    title: { en: "Things in a house", ar: "حاجات في البيت" },
    words: [
      { en: "Fridge", ar: "تلاجة" },
      { en: "Television", ar: "تلفزيون" },
      { en: "Kettle", ar: "غلاية" },
      { en: "Sofa", ar: "كنبة" },
      { en: "Mirror", ar: "مراية" },
      { en: "Washing machine", ar: "غسالة" },
      { en: "Carpet", ar: "سجادة" },
      { en: "Fan", ar: "مروحة" },
      { en: "Balcony", ar: "بلكونة" },
      { en: "Lamp", ar: "أباجورة" },
      { en: "Key", ar: "مفتاح" },
      { en: "Broom", ar: "مقشة" },
      { en: "Shoe rack", ar: "رف الجزم" },
      { en: "Clock", ar: "ساعة حيط" },
      { en: "Water jug", ar: "قلة" },
      { en: "Tea glass", ar: "كباية شاي" },
    ],
  },
  {
    id: "transport",
    title: { en: "Getting around", ar: "مواصلات" },
    words: [
      { en: "Microbus", ar: "ميكروباص" },
      { en: "Metro", ar: "مترو" },
      { en: "Taxi", ar: "تاكسي" },
      { en: "Tuk-tuk", ar: "توك توك" },
      { en: "Bicycle", ar: "عجلة" },
      { en: "Motorbike", ar: "موتوسيكل" },
      { en: "Train", ar: "قطر" },
      { en: "Plane", ar: "طيارة" },
      { en: "Boat", ar: "مركب" },
      { en: "Walking", ar: "مشي" },
      { en: "Bus", ar: "أتوبيس" },
      { en: "Horse cart", ar: "كارو" },
      { en: "Ride app", ar: "تطبيق توصيل" },
      { en: "Ferry", ar: "معدية" },
      { en: "Scooter", ar: "سكوتر" },
      { en: "Donkey", ar: "حمار" },
    ],
  },
  {
    id: "feelings",
    title: { en: "How you feel", ar: "مشاعر" },
    words: [
      { en: "Happy", ar: "مبسوط" },
      { en: "Angry", ar: "متعصب" },
      { en: "Bored", ar: "زهقان" },
      { en: "Tired", ar: "تعبان" },
      { en: "Scared", ar: "خايف" },
      { en: "Jealous", ar: "غيران" },
      { en: "Embarrassed", ar: "متكسف" },
      { en: "Excited", ar: "متحمس" },
      { en: "Worried", ar: "قلقان" },
      { en: "Relieved", ar: "مرتاح" },
      { en: "Confused", ar: "مش فاهم" },
      { en: "Proud", ar: "فخور" },
      { en: "Homesick", ar: "مشتاق للبيت" },
      { en: "Hungry", ar: "جعان" },
      { en: "Sleepy", ar: "نعسان" },
      { en: "In love", ar: "واقع في الحب" },
    ],
  },
  {
    id: "sport",
    title: { en: "Sport", ar: "رياضة" },
    words: [
      { en: "Football", ar: "كورة قدم" },
      { en: "Basketball", ar: "سلة" },
      { en: "Swimming", ar: "سباحة" },
      { en: "Running", ar: "جري" },
      { en: "Boxing", ar: "ملاكمة" },
      { en: "Tennis", ar: "تنس" },
      { en: "Squash", ar: "اسكواش" },
      { en: "Handball", ar: "كرة يد" },
      { en: "Wrestling", ar: "مصارعة" },
      { en: "Chess", ar: "شطرنج" },
      { en: "Table tennis", ar: "بينج بونج" },
      { en: "Volleyball", ar: "طايرة" },
      { en: "Cycling", ar: "دراجات" },
      { en: "Weightlifting", ar: "رفع أثقال" },
      { en: "Karate", ar: "كاراتيه" },
      { en: "Fencing", ar: "سلاح" },
    ],
  },
  {
    id: "phone",
    title: { en: "On your phone", ar: "على الموبايل" },
    words: [
      { en: "WhatsApp", ar: "واتساب" },
      { en: "Instagram", ar: "انستجرام" },
      { en: "TikTok", ar: "تيك توك" },
      { en: "YouTube", ar: "يوتيوب" },
      { en: "The camera", ar: "الكاميرا" },
      { en: "The alarm", ar: "المنبه" },
      { en: "Maps", ar: "الخرايط" },
      { en: "A game", ar: "لعبة" },
      { en: "The calculator", ar: "الآلة الحاسبة" },
      { en: "Your bank app", ar: "تطبيق البنك" },
      { en: "A delivery app", ar: "تطبيق دليفري" },
      { en: "The notes app", ar: "الملاحظات" },
      { en: "Group chat", ar: "جروب" },
      { en: "The battery", ar: "البطارية" },
      { en: "A voice note", ar: "فويس نوت" },
      { en: "The gallery", ar: "الصور" },
    ],
  },
  {
    id: "weather",
    title: { en: "Weather & seasons", ar: "الجو" },
    words: [
      { en: "Heatwave", ar: "موجة حر" },
      { en: "Rain", ar: "مطرة" },
      { en: "Sandstorm", ar: "عاصفة تراب" },
      { en: "Fog", ar: "شبورة" },
      { en: "Cold snap", ar: "برد شديد" },
      { en: "Humidity", ar: "رطوبة" },
      { en: "A breeze", ar: "نسمة" },
      { en: "Summer", ar: "الصيف" },
      { en: "Winter", ar: "الشتا" },
      { en: "Sunset", ar: "المغرب" },
      { en: "Sunrise", ar: "الفجر" },
      { en: "Thunder", ar: "رعد" },
      { en: "Clouds", ar: "غيوم" },
      { en: "Full moon", ar: "بدر" },
      { en: "Hot night", ar: "ليلة حرة" },
      { en: "First cold day", ar: "أول يوم برد" },
    ],
  },
  {
    id: "school",
    title: { en: "School days", ar: "أيام المدرسة" },
    words: [
      { en: "The exam", ar: "الامتحان" },
      { en: "Homework", ar: "الواجب" },
      { en: "The break", ar: "الفسحة" },
      { en: "The headmaster", ar: "الناظر" },
      { en: "The maths teacher", ar: "مدرس الحساب" },
      { en: "Copying answers", ar: "النقل" },
      { en: "The school bus", ar: "أتوبيس المدرسة" },
      { en: "The morning line-up", ar: "الطابور" },
      { en: "The canteen", ar: "الكانتين" },
      { en: "A report card", ar: "شهادة الدرجات" },
      { en: "Being late", ar: "التأخير" },
      { en: "The last day", ar: "آخر يوم" },
      { en: "Private lessons", ar: "الدروس الخصوصية" },
      { en: "The uniform", ar: "اليونيفورم" },
      { en: "Detention", ar: "الحجز" },
      { en: "Summer holiday", ar: "الأجازة" },
    ],
  },
  {
    id: "money",
    title: { en: "Money", ar: "فلوس" },
    words: [
      { en: "Salary", ar: "المرتب" },
      { en: "Rent", ar: "الإيجار" },
      { en: "A loan", ar: "قرض" },
      { en: "Haggling", ar: "الفصال" },
      { en: "A tip", ar: "بقشيش" },
      { en: "Savings", ar: "مدخرات" },
      { en: "Gold", ar: "دهب" },
      { en: "A bribe", ar: "رشوة" },
      { en: "Charity", ar: "صدقة" },
      { en: "A bill", ar: "فاتورة" },
      { en: "Wedding money", ar: "نقوط" },
      { en: "Debt", ar: "دين" },
      { en: "A bargain", ar: "لقطة" },
      { en: "Change", ar: "فكة" },
      { en: "An inheritance", ar: "ميراث" },
      { en: "Pocket money", ar: "مصروف" },
    ],
  },
];

export function pickTopic(rng: () => number = Math.random): ChameleonTopic {
  return TOPICS[Math.floor(rng() * TOPICS.length)];
}

export function getTopic(id: string): ChameleonTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}
