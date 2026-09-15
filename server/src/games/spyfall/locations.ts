/**
 * Locations for Spyfall (برا اللعبة).
 *
 * Each location carries a set of roles. A role is not decoration: it gives a
 * player something specific to answer *from*, which is the difference between
 * "what do you do here?" → "…stuff" and a real answer. Without roles the game
 * stalls in the first minute because nobody knows what to say.
 *
 * ## Why these locations
 *
 * Every location has to satisfy three constraints, and most obvious choices
 * fail at least one:
 *
 * 1. **Everyone must be able to picture it.** A location half the table has
 *    never been to isn't a game, it's a quiz.
 * 2. **It must support ambiguous questions.** "Is it hot here?" should be
 *    answerable for several locations, or the spy is caught on question one.
 *    Locations that are unique in every dimension are dead ends.
 * 3. **The roles must be distinguishable.** If every role at a location does
 *    the same thing, the role adds nothing.
 *
 * The list is deliberately weighted toward places an Egyptian or Levantine
 * player knows intimately — a قهوة, a ميكروباص, a تجنيد office — alongside
 * universal ones. A location list translated from an English game is playable
 * but flat; "the coffee shop where the same four men have sat every evening
 * for thirty years" is a place people have *opinions* about, and opinions are
 * what make the questions funny.
 */

export interface SpyfallLocation {
  id: string;
  name: { en: string; ar: string };
  roles: Array<{ en: string; ar: string }>;
}

export const LOCATIONS: SpyfallLocation[] = [
  {
    id: "ahwa",
    name: { en: "The local coffee shop", ar: "القهوة البلدي" },
    roles: [
      { en: "The owner", ar: "المعلم" },
      { en: "Waiter", ar: "القهوجي" },
      { en: "Shisha guy", ar: "بتاع المعسل" },
      { en: "The regular who never leaves", ar: "الزبون اللي عمره ما بيمشي" },
      { en: "Backgammon champion", ar: "بطل الطاولة" },
      { en: "Someone watching the match", ar: "واحد بيتفرج على الماتش" },
      { en: "Dominoes player", ar: "بيلعب دومينو" },
    ],
  },
  {
    id: "wedding",
    name: { en: "A wedding", ar: "فرح" },
    roles: [
      { en: "The bride", ar: "العروسة" },
      { en: "The groom", ar: "العريس" },
      { en: "The mother-in-law", ar: "الحماة" },
      { en: "DJ", ar: "الدي جي" },
      { en: "Photographer", ar: "المصور" },
      { en: "A cousin nobody invited", ar: "قريب محدش عزمه" },
      { en: "The kid running everywhere", ar: "العيل اللي بيجري في كل حتة" },
    ],
  },
  {
    id: "microbus",
    name: { en: "A microbus", ar: "ميكروباص" },
    roles: [
      { en: "The driver", ar: "السواق" },
      { en: "The money collector", ar: "التباع" },
      { en: "Passenger with no change", ar: "راكب مش معاه فكة" },
      { en: "The one shouting the destination", ar: "اللي بينادي على الخط" },
      { en: "Someone asleep", ar: "واحد نايم" },
      { en: "A student late for class", ar: "طالب متأخر على المحاضرة" },
    ],
  },
  {
    id: "hospital",
    name: { en: "Hospital", ar: "مستشفى" },
    roles: [
      { en: "Surgeon", ar: "جراح" },
      { en: "Nurse", ar: "ممرض" },
      { en: "Patient", ar: "مريض" },
      { en: "Worried relative", ar: "قريب قلقان" },
      { en: "Receptionist", ar: "موظف الاستقبال" },
      { en: "Intern who hasn't slept", ar: "امتياز مش نايم من إمبارح" },
      { en: "Ambulance driver", ar: "سواق الإسعاف" },
    ],
  },
  {
    id: "airport",
    name: { en: "Airport", ar: "المطار" },
    roles: [
      { en: "Pilot", ar: "طيار" },
      { en: "Security officer", ar: "ضابط أمن" },
      { en: "Passenger who's late", ar: "مسافر متأخر" },
      { en: "Check-in agent", ar: "موظف التذاكر" },
      { en: "Someone with too much luggage", ar: "واحد شنطه كتير" },
      { en: "Duty-free cashier", ar: "كاشير السوق الحرة" },
    ],
  },
  {
    id: "school",
    name: { en: "School", ar: "مدرسة" },
    roles: [
      { en: "Headmaster", ar: "الناظر" },
      { en: "Maths teacher", ar: "مدرس الرياضيات" },
      { en: "Student who didn't study", ar: "طالب مذاكرش" },
      { en: "The school prefect", ar: "عريف الفصل" },
      { en: "Caretaker", ar: "الفراش" },
      { en: "Parent at a meeting", ar: "ولي أمر في اجتماع" },
    ],
  },
  {
    id: "beach",
    name: { en: "The beach", ar: "الشاطئ" },
    roles: [
      { en: "Lifeguard", ar: "المنقذ" },
      { en: "Corn seller", ar: "بتاع الذرة" },
      { en: "Someone who can't swim", ar: "واحد مش عارف يعوم" },
      { en: "Sunbathing tourist", ar: "سايح بياخد شمس" },
      { en: "Beach chair renter", ar: "بتاع الشمسيات" },
      { en: "Kid building a sandcastle", ar: "عيل بيبني قلعة رمل" },
    ],
  },
  {
    id: "police",
    name: { en: "Police station", ar: "قسم الشرطة" },
    roles: [
      { en: "The officer in charge", ar: "الظابط" },
      { en: "Detective", ar: "المباحث" },
      { en: "Someone filing a report", ar: "واحد بيعمل محضر" },
      { en: "The suspect", ar: "المتهم" },
      { en: "Lawyer", ar: "محامي" },
      { en: "Clerk", ar: "الكاتب" },
    ],
  },
  {
    id: "restaurant",
    name: { en: "Restaurant", ar: "مطعم" },
    roles: [
      { en: "Head chef", ar: "الشيف" },
      { en: "Waiter", ar: "الجرسون" },
      { en: "Food critic", ar: "ناقد أكل" },
      { en: "Customer complaining", ar: "زبون بيشتكي" },
      { en: "Someone on a first date", ar: "واحد في أول ميعاد" },
      { en: "Dishwasher", ar: "بتاع غسيل الأطباق" },
    ],
  },
  {
    id: "gym",
    name: { en: "The gym", ar: "الجيم" },
    roles: [
      { en: "Personal trainer", ar: "الكابتن" },
      { en: "Someone on day one", ar: "واحد أول يوم ليه" },
      { en: "The guy hogging the bench", ar: "اللي قاعد على الجهاز من ساعة" },
      { en: "Receptionist", ar: "موظف الاستقبال" },
      { en: "Someone filming themselves", ar: "واحد بيصور نفسه" },
      { en: "The cleaner", ar: "عامل النظافة" },
    ],
  },
  {
    id: "bank",
    name: { en: "Bank", ar: "البنك" },
    roles: [
      { en: "Bank manager", ar: "مدير الفرع" },
      { en: "Teller", ar: "أمين الصندوق" },
      { en: "Security guard", ar: "الأمن" },
      { en: "Customer in a long queue", ar: "زبون في طابور طويل" },
      { en: "Loan officer", ar: "موظف القروض" },
      { en: "Someone withdrawing everything", ar: "واحد بيسحب كل فلوسه" },
    ],
  },
  {
    id: "football",
    name: { en: "A football match", ar: "ماتش كورة" },
    roles: [
      { en: "Striker", ar: "مهاجم" },
      { en: "Goalkeeper", ar: "حارس المرمى" },
      { en: "Referee", ar: "الحكم" },
      { en: "Angry fan", ar: "مشجع متعصب" },
      { en: "Commentator", ar: "المعلق" },
      { en: "Someone selling drinks", ar: "بتاع المشروبات" },
      { en: "The coach", ar: "المدرب" },
    ],
  },
  {
    id: "cinema",
    name: { en: "Cinema", ar: "السينما" },
    roles: [
      { en: "Projectionist", ar: "بتاع العرض" },
      { en: "Someone on their phone", ar: "واحد على موبايله" },
      { en: "Ticket seller", ar: "بتاع التذاكر" },
      { en: "The loud popcorn eater", ar: "اللي بياكل فيشار بصوت عالي" },
      { en: "A couple at the back", ar: "اتنين قاعدين ورا" },
      { en: "Usher", ar: "المرشد" },
    ],
  },
  {
    id: "market",
    name: { en: "The market", ar: "السوق" },
    roles: [
      { en: "Vegetable seller", ar: "بياع الخضار" },
      { en: "Someone haggling hard", ar: "واحد بيفاصل بجد" },
      { en: "Butcher", ar: "الجزار" },
      { en: "Pickpocket", ar: "نشال" },
      { en: "Spice merchant", ar: "العطار" },
      { en: "A tourist getting overcharged", ar: "سايح بيتنصب عليه" },
    ],
  },
  {
    id: "train",
    name: { en: "A long-distance train", ar: "قطر سفر" },
    roles: [
      { en: "Conductor", ar: "الكمساري" },
      { en: "Passenger without a ticket", ar: "راكب من غير تذكرة" },
      { en: "Tea seller walking through", ar: "بتاع الشاي" },
      { en: "Someone in the wrong seat", ar: "واحد قاعد في كرسي مش بتاعه" },
      { en: "Driver", ar: "سواق القطر" },
      { en: "Student going home", ar: "طالب راجع بلده" },
    ],
  },
  {
    id: "spaceship",
    name: { en: "A spaceship", ar: "مركبة فضاء" },
    roles: [
      { en: "Captain", ar: "القائد" },
      { en: "Engineer", ar: "المهندس" },
      { en: "Doctor", ar: "الدكتور" },
      { en: "Alien stowaway", ar: "كائن فضائي متخبي" },
      { en: "Navigator", ar: "الملاح" },
      { en: "Scientist", ar: "العالم" },
    ],
  },
  {
    id: "pyramids",
    name: { en: "The Pyramids", ar: "الأهرامات" },
    roles: [
      { en: "Tour guide", ar: "المرشد السياحي" },
      { en: "Camel owner", ar: "صاحب الجمل" },
      { en: "Archaeologist", ar: "عالم آثار" },
      { en: "Tourist taking photos", ar: "سايح بيصور" },
      { en: "Souvenir seller", ar: "بياع التذكارات" },
      { en: "Ticket inspector", ar: "بتاع التذاكر" },
    ],
  },
  {
    id: "office",
    name: { en: "An office", ar: "مكتب شركة" },
    roles: [
      { en: "The boss", ar: "المدير" },
      { en: "Intern", ar: "متدرب" },
      { en: "IT guy", ar: "بتاع الكمبيوتر" },
      { en: "Someone in a pointless meeting", ar: "واحد في اجتماع مالوش لازمة" },
      { en: "HR", ar: "الموارد البشرية" },
      { en: "The one who makes the tea", ar: "الساعي" },
    ],
  },
  {
    id: "barber",
    name: { en: "Barber shop", ar: "الحلاق" },
    roles: [
      { en: "The barber", ar: "الحلاق" },
      { en: "Customer who wanted a trim", ar: "زبون كان عايز تخفيف بس" },
      { en: "Someone waiting forever", ar: "واحد مستني من ساعة" },
      { en: "The apprentice", ar: "الصبي" },
      { en: "A groom before his wedding", ar: "عريس قبل فرحه" },
    ],
  },
  {
    id: "hotel",
    name: { en: "Hotel", ar: "فندق" },
    roles: [
      { en: "Receptionist", ar: "موظف الاستقبال" },
      { en: "Housekeeper", ar: "عاملة النظافة" },
      { en: "Guest complaining about the AC", ar: "نزيل بيشتكي من التكييف" },
      { en: "Bellboy", ar: "الحمال" },
      { en: "Manager", ar: "المدير" },
      { en: "Someone who lost their key", ar: "واحد ضيع مفتاحه" },
    ],
  },
  {
    id: "bakery",
    name: { en: "The bakery", ar: "الفرن" },
    roles: [
      { en: "The baker", ar: "الفران" },
      { en: "Someone in the bread queue", ar: "واحد في طابور العيش" },
      { en: "Delivery boy", ar: "الدليفري" },
      { en: "The cashier", ar: "الكاشير" },
      { en: "A kid sent by their mother", ar: "عيل أمه بعتاه" },
    ],
  },
  {
    id: "exam",
    name: { en: "An exam hall", ar: "لجنة امتحان" },
    roles: [
      { en: "Invigilator", ar: "الملاحظ" },
      { en: "Student who studied everything", ar: "طالب ذاكر كل حاجة" },
      { en: "Student who studied nothing", ar: "طالب مذاكرش خالص" },
      { en: "Someone trying to cheat", ar: "واحد بيحاول يغش" },
      { en: "The one who finishes first", ar: "اللي بيخلص الأول" },
      { en: "Latecomer", ar: "واحد جه متأخر" },
    ],
  },
  {
    id: "pharmacy",
    name: { en: "Pharmacy", ar: "صيدلية" },
    roles: [
      { en: "Pharmacist", ar: "الصيدلي" },
      { en: "Someone self-diagnosing", ar: "واحد بيشخص نفسه" },
      { en: "Medical rep", ar: "مندوب دعاية" },
      { en: "Customer with no prescription", ar: "زبون من غير روشتة" },
      { en: "The night shift assistant", ar: "مساعد الوردية الليلية" },
    ],
  },
  {
    id: "ship",
    name: { en: "A cruise ship", ar: "باخرة سياحية" },
    roles: [
      { en: "Captain", ar: "القبطان" },
      { en: "Entertainer", ar: "المنشط" },
      { en: "Seasick passenger", ar: "راكب دايخ" },
      { en: "Waiter", ar: "الجرسون" },
      { en: "Someone who boarded by mistake", ar: "واحد ركب بالغلط" },
      { en: "Engineer below deck", ar: "مهندس تحت" },
    ],
  },
  {
    id: "camp",
    name: { en: "A desert camp", ar: "مخيم في الصحرا" },
    roles: [
      { en: "Guide", ar: "الدليل" },
      { en: "Cook", ar: "الطباخ" },
      { en: "Someone terrified of the dark", ar: "واحد خايف من الضلمة" },
      { en: "Stargazer", ar: "واحد بيتفرج على النجوم" },
      { en: "Driver of the 4x4", ar: "سواق الجيب" },
      { en: "Musician with an oud", ar: "واحد معاه عود" },
    ],
  },
  {
    id: "tv",
    name: { en: "A TV studio", ar: "استوديو تلفزيون" },
    roles: [
      { en: "Presenter", ar: "المذيع" },
      { en: "Cameraman", ar: "المصور" },
      { en: "Nervous guest", ar: "ضيف متوتر" },
      { en: "Director", ar: "المخرج" },
      { en: "Makeup artist", ar: "الميك أب" },
      { en: "Someone in the audience", ar: "واحد في الجمهور" },
    ],
  },
  {
    id: "mall",
    name: { en: "Shopping mall", ar: "المول" },
    roles: [
      { en: "Shop assistant", ar: "بياع" },
      { en: "Security guard", ar: "الأمن" },
      { en: "Teenager just hanging around", ar: "مراهق بيتمشى بس" },
      { en: "Parent chasing a child", ar: "أب بيجري ورا عياله" },
      { en: "Cleaner", ar: "عامل النظافة" },
      { en: "Someone window shopping with no money", ar: "واحد بيتفرج ومعهوش فلوس" },
    ],
  },
  {
    id: "petrol",
    name: { en: "A petrol station", ar: "محطة بنزين" },
    roles: [
      { en: "Attendant", ar: "عامل البنزينة" },
      { en: "Driver in a hurry", ar: "سواق مستعجل" },
      { en: "Someone who ran out of fuel", ar: "واحد خلص بنزين" },
      { en: "Shop cashier", ar: "كاشير المحل" },
      { en: "Mechanic", ar: "الميكانيكي" },
    ],
  },
  {
    id: "library",
    name: { en: "Library", ar: "مكتبة" },
    roles: [
      { en: "Librarian", ar: "أمين المكتبة" },
      { en: "Student cramming", ar: "طالب بيذاكر بجنون" },
      { en: "Someone sleeping on a book", ar: "واحد نايم على كتاب" },
      { en: "Researcher", ar: "باحث" },
      { en: "The one who keeps talking", ar: "اللي مش بيسكت" },
    ],
  },
  {
    id: "concert",
    name: { en: "A concert", ar: "حفلة" },
    roles: [
      { en: "The singer", ar: "المطرب" },
      { en: "Sound engineer", ar: "مهندس الصوت" },
      { en: "Superfan in the front row", ar: "معجب في الصف الأول" },
      { en: "Security", ar: "الأمن" },
      { en: "Someone filming the whole thing", ar: "واحد بيصور الحفلة كلها" },
      { en: "Drummer", ar: "عازف الدرامز" },
    ],
  },
];

/** Pick a random location, and shuffled roles for the non-spies. */
export function pickLocation(rng: () => number = Math.random): SpyfallLocation {
  return LOCATIONS[Math.floor(rng() * LOCATIONS.length)];
}

/** Every location name, sent to all players — the spy needs the list to guess from. */
export function locationList(): Array<{ id: string; name: { en: string; ar: string } }> {
  return LOCATIONS.map((l) => ({ id: l.id, name: l.name }));
}
