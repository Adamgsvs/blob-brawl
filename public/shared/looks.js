// What a beast can wear. Shared so the server can validate looks and dress the bots.
// look = { c: body colour, k: costume, kc: costume colour, h: head item, f: face item }

export const PALETTE = [
  '#d94436', '#ee8130', '#f3c623', '#a4d13f', '#44a94e', '#2fb3a2', '#4cc2ea', '#2f6fd6',
  '#2b3c86', '#7e52c8', '#f07ab0', '#eeeeee', '#8d9099', '#8b5a3c', '#2c2c34', '#e8b48a'
];
export const COL = { red: 0, orange: 1, yellow: 2, lime: 3, green: 4, teal: 5, sky: 6, blue: 7, navy: 8, purple: 9, pink: 10, white: 11, gray: 12, brown: 13, black: 14, tan: 15 };

export const COSTUMES = [
  { id: 'none', ar: 'بدون', en: 'None' },
  { id: 'chicken', ar: 'دجاجة', en: 'Chicken' },
  { id: 'bear', ar: 'دب', en: 'Bear' },
  { id: 'dino', ar: 'ديناصور', en: 'Dinosaur' },
  { id: 'cat', ar: 'قط', en: 'Cat' },
  { id: 'bunny', ar: 'أرنب', en: 'Bunny' },
  { id: 'shark', ar: 'قرش', en: 'Shark' },
  { id: 'frog', ar: 'ضفدع', en: 'Frog' },
  { id: 'panda', ar: 'باندا', en: 'Panda' },
  { id: 'penguin', ar: 'بطريق', en: 'Penguin' },
  { id: 'skeleton', ar: 'هيكل عظمي', en: 'Skeleton' },
  { id: 'singlet', ar: 'مصارع', en: 'Wrestler' },
  { id: 'hoodie', ar: 'هودي', en: 'Hoodie' },
  { id: 'tshirt', ar: 'تيشيرت وشورت', en: 'T-shirt' },
  { id: 'suit', ar: 'بدلة رسمية', en: 'Business suit' },
  { id: 'cop', ar: 'شرطي', en: 'Cop' },
  { id: 'prisoner', ar: 'سجين', en: 'Prisoner' },
  { id: 'builder', ar: 'عامل بناء', en: 'Builder' },
  { id: 'chef', ar: 'طباخ', en: 'Chef' },
  { id: 'boxer', ar: 'ملاكم', en: 'Boxer' },
  { id: 'hero', ar: 'بطل خارق', en: 'Superhero' },
  { id: 'ninja', ar: 'نينجا', en: 'Ninja' },
  { id: 'santa', ar: 'بابا نويل', en: 'Santa' },
  { id: 'pirate', ar: 'قرصان', en: 'Pirate' },
  { id: 'astronaut', ar: 'رائد فضاء', en: 'Astronaut' },
  { id: 'overalls', ar: 'أفرول', en: 'Overalls' },
  { id: 'hawaii', ar: 'هاواي', en: 'Hawaiian' },
  { id: 'karate', ar: 'كاراتيه', en: 'Karate' },
  { id: 'referee', ar: 'حكم', en: 'Referee' },
  { id: 'jersey', ar: 'لاعب كرة', en: 'Footballer' },
  { id: 'mummy', ar: 'مومياء', en: 'Mummy' },
  { id: 'robot', ar: 'روبوت', en: 'Robot' },
  { id: 'clown', ar: 'مهرج', en: 'Clown' }
];

export const HEADS = [
  { id: 'none', ar: 'بدون', en: 'None' },
  { id: 'lucha', ar: 'قناع مصارع', en: 'Lucha mask' },
  { id: 'hair', ar: 'شعر', en: 'Hair' },
  { id: 'mohawk', ar: 'موهوك', en: 'Mohawk' },
  { id: 'afro', ar: 'أفرو', en: 'Afro' },
  { id: 'cap', ar: 'كاب', en: 'Cap' },
  { id: 'beanie', ar: 'طاقية', en: 'Beanie' },
  { id: 'hardhat', ar: 'خوذة عامل', en: 'Hard hat' },
  { id: 'chefhat', ar: 'قبعة طباخ', en: 'Chef hat' },
  { id: 'copcap', ar: 'قبعة شرطي', en: 'Police cap' },
  { id: 'crown', ar: 'تاج', en: 'Crown' },
  { id: 'party', ar: 'قبعة حفلة', en: 'Party hat' },
  { id: 'tophat', ar: 'قبعة عالية', en: 'Top hat' },
  { id: 'cowboy', ar: 'كاوبوي', en: 'Cowboy hat' },
  { id: 'santahat', ar: 'قبعة بابا نويل', en: 'Santa hat' },
  { id: 'headband', ar: 'عصبة راس', en: 'Headband' },
  { id: 'bandana', ar: 'بندانة', en: 'Bandana' },
  { id: 'horns', ar: 'قرون', en: 'Horns' },
  { id: 'halo', ar: 'هالة', en: 'Halo' },
  { id: 'propeller', ar: 'مروحة', en: 'Propeller cap' },
  { id: 'viking', ar: 'خوذة فايكنغ', en: 'Viking helmet' },
  { id: 'space', ar: 'خوذة فضاء', en: 'Space helmet' },
  { id: 'bucket', ar: 'سطل', en: 'Bucket' },
  { id: 'cone', ar: 'قمع مرور', en: 'Traffic cone' },
  { id: 'wig', ar: 'باروكة مهرج', en: 'Clown wig' },
  { id: 'ponytail', ar: 'ذيل حصان', en: 'Ponytail' },
  { id: 'headphones', ar: 'سماعات', en: 'Headphones' }
];

export const FACES = [
  { id: 'none', ar: 'عادي', en: 'Plain' },
  { id: 'shades', ar: 'نظارة شمسية', en: 'Sunglasses' },
  { id: 'glasses', ar: 'نظارة', en: 'Glasses' },
  { id: 'patch', ar: 'رقعة عين', en: 'Eye patch' },
  { id: 'moustache', ar: 'شارب', en: 'Moustache' },
  { id: 'beard', ar: 'لحية', en: 'Beard' },
  { id: 'angry', ar: 'حواجب غاضبة', en: 'Angry brows' },
  { id: 'nose', ar: 'أنف مهرج', en: 'Clown nose' },
  { id: 'monocle', ar: 'مونوكل', en: 'Monocle' },
  { id: 'bandit', ar: 'قناع لص', en: 'Bandit mask' }
];

const K = Object.fromEntries(COSTUMES.map((c, i) => [c.id, i])), H = Object.fromEntries(HEADS.map((c, i) => [c.id, i])), F = Object.fromEntries(FACES.map((c, i) => [c.id, i]));
const L = (c, k, kc, h, f) => ({ c: COL[c], k: K[k || 'none'], kc: COL[kc || 'white'], h: H[h || 'none'], f: F[f || 'none'] });

// ready-made characters
export const PRESETS = [
  { ar: 'الأحمر', en: 'Red', look: L('red') },
  { ar: 'الدجاجة', en: 'Chicken', look: L('yellow', 'chicken', 'yellow') },
  { ar: 'الدب', en: 'Bear', look: L('blue', 'bear', 'blue') },
  { ar: 'الديناصور', en: 'Dino', look: L('green', 'dino', 'green') },
  { ar: 'اللوتشادور', en: 'Luchador', look: L('blue', 'singlet', 'red', 'lucha') },
  { ar: 'المصارع', en: 'Wrestler', look: L('purple', 'singlet', 'black') },
  { ar: 'أبو الهودي', en: 'Hoodie', look: L('orange', 'hoodie', 'green', 'hair') },
  { ar: 'القط', en: 'Cat', look: L('orange', 'cat', 'orange') },
  { ar: 'الأرنب', en: 'Bunny', look: L('pink', 'bunny', 'white') },
  { ar: 'القرش', en: 'Shark', look: L('gray', 'shark', 'gray') },
  { ar: 'الضفدع', en: 'Frog', look: L('lime', 'frog', 'lime') },
  { ar: 'الباندا', en: 'Panda', look: L('white', 'panda', 'white') },
  { ar: 'البطريق', en: 'Penguin', look: L('black', 'penguin', 'black') },
  { ar: 'الهيكل', en: 'Skeleton', look: L('black', 'skeleton', 'black') },
  { ar: 'الشرطي', en: 'Cop', look: L('tan', 'cop', 'navy', 'copcap', 'shades') },
  { ar: 'السجين', en: 'Prisoner', look: L('tan', 'prisoner', 'orange', 'none', 'beard') },
  { ar: 'عامل البناء', en: 'Builder', look: L('tan', 'builder', 'orange', 'hardhat', 'moustache') },
  { ar: 'الطباخ', en: 'Chef', look: L('pink', 'chef', 'white', 'chefhat', 'moustache') },
  { ar: 'الملاكم', en: 'Boxer', look: L('brown', 'boxer', 'red', 'headband') },
  { ar: 'البطل الخارق', en: 'Hero', look: L('tan', 'hero', 'blue', 'none', 'bandit') },
  { ar: 'النينجا', en: 'Ninja', look: L('black', 'ninja', 'black', 'headband') },
  { ar: 'بابا نويل', en: 'Santa', look: L('pink', 'santa', 'red', 'santahat', 'beard') },
  { ar: 'القرصان', en: 'Pirate', look: L('tan', 'pirate', 'red', 'bandana', 'patch') },
  { ar: 'رائد الفضاء', en: 'Astronaut', look: L('tan', 'astronaut', 'white', 'space') },
  { ar: 'رجل الأعمال', en: 'Businessman', look: L('tan', 'suit', 'navy', 'tophat', 'monocle') },
  { ar: 'المزارع', en: 'Farmer', look: L('tan', 'overalls', 'blue', 'cowboy') },
  { ar: 'السائح', en: 'Tourist', look: L('pink', 'hawaii', 'teal', 'cap', 'shades') },
  { ar: 'الكاراتيه', en: 'Karate', look: L('tan', 'karate', 'white', 'headband', 'angry') },
  { ar: 'الحكم', en: 'Referee', look: L('brown', 'referee', 'black', 'cap') },
  { ar: 'لاعب الكرة', en: 'Footballer', look: L('brown', 'jersey', 'green', 'afro') },
  { ar: 'المومياء', en: 'Mummy', look: L('white', 'mummy', 'white') },
  { ar: 'الروبوت', en: 'Robot', look: L('gray', 'robot', 'gray', 'bucket') },
  { ar: 'المهرج', en: 'Clown', look: L('white', 'clown', 'yellow', 'wig', 'nose') }
];

export const DEFAULT_LOOK = PRESETS[1].look;

export function cleanLook(l) {
  l = l || {};
  const n = (v, max, d) => { v = v | 0; return v >= 0 && v < max ? v : d; };
  return { c: n(l.c, PALETTE.length, 0), k: n(l.k, COSTUMES.length, 0), kc: n(l.kc, PALETTE.length, 0), h: n(l.h, HEADS.length, 0), f: n(l.f, FACES.length, 0) };
}
export function randomLook() {
  if (Math.random() < 0.8) return { ...PRESETS[(Math.random() * PRESETS.length) | 0].look };
  const r = n => (Math.random() * n) | 0;
  return { c: r(PALETTE.length), k: r(COSTUMES.length), kc: r(PALETTE.length), h: r(HEADS.length), f: r(FACES.length) };
}
