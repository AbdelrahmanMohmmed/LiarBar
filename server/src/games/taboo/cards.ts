/**
 * The card deck for Taboo.
 *
 * ## What makes a card work
 *
 * A card is one word to make your team say, and four words you may not use
 * while doing it. Both halves have to be right or the round is dull:
 *
 * - **The target must be guessable in under fifteen seconds** by people who
 *   know each other. Abstract nouns ("justice", "progress") die on the table:
 *   the describer flails, the team goes quiet, and the clock eats the turn.
 *   Concrete things, places, foods, jobs and famous objects all work.
 *
 * - **The forbidden words must be the four a describer reaches for first.**
 *   That is the whole game. If they're obscure, the card is free; if they're
 *   the obvious ones, the describer has to find a third route to the word and
 *   that route is where the laughing happens. When writing a card, say the
 *   word out loud to yourself and write down what you nearly said.
 *
 * ## On the two languages
 *
 * These are not translations of each other and could not be. A taboo list is a
 * list of the phrases *speakers of that language* actually reach for, so the
 * English card for "camel" and the Arabic card for "جمل" block different
 * things. Several cards exist only in one language because the word has no
 * counterpart worth playing in the other; the deck is dealt per room language,
 * so that costs nothing.
 *
 * The Arabic deck leans Egyptian/Levantine colloquial rather than fusha, for
 * the same reason the rest of the product does: this is a game people play out
 * loud with their friends, and nobody describes a fridge in formal Arabic.
 */

export interface TabooCard {
  id: string;
  word: string;
  /** The four a describer reaches for first. */
  taboo: string[];
}

export const CARDS_EN: TabooCard[] = [
  { id: "en-camel", word: "Camel", taboo: ["Desert", "Hump", "Sand", "Arabia"] },
  { id: "en-pyramid", word: "Pyramid", taboo: ["Egypt", "Triangle", "Pharaoh", "Giza"] },
  { id: "en-coffee", word: "Coffee", taboo: ["Drink", "Beans", "Morning", "Caffeine"] },
  { id: "en-football", word: "Football", taboo: ["Ball", "Goal", "Team", "Kick"] },
  { id: "en-wedding", word: "Wedding", taboo: ["Marry", "Bride", "Ring", "Dress"] },
  { id: "en-taxi", word: "Taxi", taboo: ["Car", "Driver", "Fare", "Yellow"] },
  { id: "en-barber", word: "Barber", taboo: ["Hair", "Cut", "Shave", "Scissors"] },
  { id: "en-ramadan", word: "Ramadan", taboo: ["Fasting", "Month", "Iftar", "Moon"] },
  { id: "en-airport", word: "Airport", taboo: ["Plane", "Fly", "Luggage", "Travel"] },
  { id: "en-hospital", word: "Hospital", taboo: ["Doctor", "Sick", "Nurse", "Patient"] },
  { id: "en-fridge", word: "Fridge", taboo: ["Cold", "Food", "Kitchen", "Freezer"] },
  { id: "en-rain", word: "Rain", taboo: ["Water", "Sky", "Wet", "Umbrella"] },
  { id: "en-teacher", word: "Teacher", taboo: ["School", "Student", "Class", "Lesson"] },
  { id: "en-mirror", word: "Mirror", taboo: ["Reflection", "Glass", "Face", "Look"] },
  { id: "en-honey", word: "Honey", taboo: ["Bee", "Sweet", "Sticky", "Golden"] },
  { id: "en-beach", word: "Beach", taboo: ["Sea", "Sand", "Swim", "Sun"] },
  { id: "en-library", word: "Library", taboo: ["Books", "Quiet", "Read", "Shelf"] },
  { id: "en-elevator", word: "Elevator", taboo: ["Lift", "Floor", "Building", "Button"] },
  { id: "en-moustache", word: "Moustache", taboo: ["Face", "Hair", "Shave", "Lip"] },
  { id: "en-neighbour", word: "Neighbour", taboo: ["Next", "House", "Door", "Live"] },
  { id: "en-passport", word: "Passport", taboo: ["Travel", "Country", "Stamp", "Photo"] },
  { id: "en-garlic", word: "Garlic", taboo: ["Smell", "Cook", "Clove", "Breath"] },
  { id: "en-goalkeeper", word: "Goalkeeper", taboo: ["Football", "Save", "Gloves", "Net"] },
  { id: "en-balcony", word: "Balcony", taboo: ["Outside", "Flat", "View", "Railing"] },
  { id: "en-generator", word: "Generator", taboo: ["Power", "Electricity", "Cut", "Fuel"] },
  { id: "en-ambulance", word: "Ambulance", taboo: ["Hospital", "Siren", "Emergency", "Van"] },
  { id: "en-pharmacy", word: "Pharmacy", taboo: ["Medicine", "Doctor", "Prescription", "Shop"] },
  { id: "en-watermelon", word: "Watermelon", taboo: ["Fruit", "Summer", "Seeds", "Red"] },
  { id: "en-suitcase", word: "Suitcase", taboo: ["Travel", "Clothes", "Pack", "Wheels"] },
  { id: "en-referee", word: "Referee", taboo: ["Match", "Whistle", "Card", "Decision"] },
  { id: "en-sunglasses", word: "Sunglasses", taboo: ["Eyes", "Sun", "Dark", "Wear"] },
  { id: "en-traffic", word: "Traffic", taboo: ["Cars", "Road", "Jam", "Late"] },
  { id: "en-wallet", word: "Wallet", taboo: ["Money", "Pocket", "Cards", "Leather"] },
  { id: "en-grandmother", word: "Grandmother", taboo: ["Mother", "Old", "Family", "Granny"] },
  { id: "en-mosquito", word: "Mosquito", taboo: ["Bite", "Buzz", "Insect", "Itch"] },
  { id: "en-chandelier", word: "Chandelier", taboo: ["Light", "Ceiling", "Glass", "Hang"] },
  { id: "en-photographer", word: "Photographer", taboo: ["Camera", "Picture", "Shoot", "Lens"] },
  { id: "en-parachute", word: "Parachute", taboo: ["Jump", "Plane", "Fall", "Sky"] },
  { id: "en-honeymoon", word: "Honeymoon", taboo: ["Wedding", "Travel", "Couple", "Marriage"] },
  { id: "en-lighthouse", word: "Lighthouse", taboo: ["Sea", "Light", "Ships", "Tower"] },
];

export const CARDS_AR: TabooCard[] = [
  { id: "ar-koshari", word: "كشري", taboo: ["رز", "عدس", "مكرونة", "أكل"] },
  { id: "ar-ahwa", word: "قهوة", taboo: ["مشروب", "بن", "صباح", "فنجان"] },
  { id: "ar-shisha", word: "شيشة", taboo: ["فحم", "دخان", "معسّل", "قهوة"] },
  { id: "ar-farah", word: "فرح", taboo: ["جواز", "عروسة", "زفة", "فستان"] },
  { id: "ar-microbus", word: "ميكروباص", taboo: ["عربية", "سواق", "أجرة", "ركاب"] },
  { id: "ar-hallaq", word: "حلاق", taboo: ["شعر", "قص", "دقن", "مقص"] },
  { id: "ar-ramadan", word: "رمضان", taboo: ["صيام", "شهر", "فطار", "هلال"] },
  { id: "ar-matar", word: "مطار", taboo: ["طيارة", "سفر", "شنطة", "تذكرة"] },
  { id: "ar-talaga", word: "تلاجة", taboo: ["ساقعة", "أكل", "مطبخ", "فريزر"] },
  { id: "ar-madrasa", word: "مدرّس", taboo: ["مدرسة", "طالب", "فصل", "درس"] },
  { id: "ar-asal", word: "عسل", taboo: ["نحل", "حلو", "دبس", "أصفر"] },
  { id: "ar-bahr", word: "بحر", taboo: ["مية", "عوم", "شط", "رملة"] },
  { id: "ar-asansair", word: "أسانسير", taboo: ["دور", "عمارة", "طالع", "زرار"] },
  { id: "ar-shanab", word: "شنب", taboo: ["وش", "شعر", "حلاقة", "بق"] },
  { id: "ar-gar", word: "جار", taboo: ["بيت", "باب", "ساكن", "جنب"] },
  { id: "ar-basbort", word: "باسبور", taboo: ["سفر", "بلد", "ختم", "صورة"] },
  { id: "ar-tom", word: "توم", taboo: ["ريحة", "طبيخ", "فص", "نفس"] },
  { id: "ar-goalkeeper", word: "حارس مرمى", taboo: ["كورة", "جون", "جوانتي", "شبكة"] },
  { id: "ar-balcona", word: "بلكونة", taboo: ["بره", "شقة", "منظر", "سور"] },
  { id: "ar-motor", word: "موتور", taboo: ["كهربا", "قطع", "نور", "سولار"] },
  { id: "ar-esaaf", word: "إسعاف", taboo: ["مستشفى", "صفارة", "حالة", "عربية"] },
  { id: "ar-saydaliya", word: "صيدلية", taboo: ["دوا", "دكتور", "روشتة", "محل"] },
  { id: "ar-bateekh", word: "بطيخ", taboo: ["فاكهة", "صيف", "بذر", "أحمر"] },
  { id: "ar-shanta", word: "شنطة", taboo: ["سفر", "هدوم", "عجل", "لبس"] },
  { id: "ar-hakam", word: "حكم", taboo: ["ماتش", "صفارة", "كارت", "قرار"] },
  { id: "ar-nadara", word: "نضارة", taboo: ["عين", "شمس", "سودا", "لبس"] },
  { id: "ar-zahma", word: "زحمة", taboo: ["عربيات", "شارع", "طريق", "متأخر"] },
  { id: "ar-mahfaza", word: "محفظة", taboo: ["فلوس", "جيب", "كروت", "جلد"] },
  { id: "ar-teta", word: "تيتة", taboo: ["ماما", "كبيرة", "عيلة", "جدّة"] },
  { id: "ar-namousa", word: "ناموسة", taboo: ["قرصة", "طنين", "حشرة", "هرش"] },
  { id: "ar-nagafa", word: "نجفة", taboo: ["نور", "سقف", "إزاز", "معلّقة"] },
  { id: "ar-mosawwer", word: "مصوّر", taboo: ["كاميرا", "صورة", "عدسة", "فلاش"] },
  { id: "ar-fanar", word: "فنار", taboo: ["بحر", "نور", "مراكب", "برج"] },
  { id: "ar-sooq", word: "سوق", taboo: ["شرا", "خضار", "فلوس", "محلات"] },
  { id: "ar-shay", word: "شاي", taboo: ["مشروب", "سكر", "كوباية", "سخن"] },
  { id: "ar-mowazzaf", word: "موظّف", taboo: ["شغل", "مكتب", "مرتب", "مدير"] },
  { id: "ar-kanaba", word: "كنبة", taboo: ["قعدة", "أوضة", "تليفزيون", "نوم"] },
  { id: "ar-tarabeza", word: "ترابيزة", taboo: ["أكل", "كراسي", "خشب", "قعدة"] },
  { id: "ar-mazzika", word: "مزّيكا", taboo: ["أغاني", "سمع", "مطرب", "صوت"] },
  { id: "ar-eid", word: "عيد", taboo: ["عيدية", "كحك", "فرحة", "إجازة"] },
];

/**
 * Shuffle a language's deck for one match.
 *
 * The whole deck is shuffled once and dealt off the top rather than picking a
 * card at random each time, because the same card coming round twice in an
 * evening is worse here than in most games: everyone already knows the answer,
 * so the describer's turn is over before it starts.
 */
export function shuffledDeck(language: "en" | "ar"): TabooCard[] {
  const deck = [...(language === "ar" ? CARDS_AR : CARDS_EN)];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
