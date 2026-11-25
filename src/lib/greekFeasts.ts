// src/lib/greekFeasts.ts
// Feast data for the Church of Greece / Ecumenical Patriarchate calendar — the Revised Julian
// ("Neo-Julian") calendar used by the Greek Orthodox Church in New Zealand.
//
//   • FIXED feasts follow the civil (Gregorian) date: Christmas is 25 December, Theophany 6 January.
//     They are keyed "MM-DD" with no 13-day offset (unlike the Russian Julian-calendar tables).
//   • MOVEABLE feasts are counted in days from Pascha, which every Orthodox church computes by the
//     Julian paschalion (see orthodoxCalendar.ts) — so Pascha and its cycle fall on the same day
//     for the Greek and Russian churches.
//
// Names are the usual parish-calendar forms. Only feasts that are certain are listed; a parish can
// always add anything else in the free-text schedule. No feast-transfer rules are applied (for
// example St George falling in Holy Week): the calendar shows the day each commemoration falls on.

export type FastType = 'strict' | 'oilwine' | 'fish' | 'dairy' | 'fastfree' | 'totalfast';

/** great = Despotic/Theotokos great feasts; major = saints with an all-night vigil in Greek practice. */
export type FeastTier = 'great' | 'pascha' | 'major' | 'saint' | 'commemoration';

export type FeastColor = 'pascha' | 'bright' | 'palm' | 'pentecost' | 'nativity';

export interface FeastData {
  en: string;
  el: string;
  tier?: FeastTier;
  color?: FeastColor;
  /** Fast level that applies on this day regardless of the season (e.g. fish on the Annunciation). */
  fast?: FastType;
  /** Day is fast-free whatever the weekday. */
  fastFree?: boolean;
  holyWeek?: boolean;
}

/** Non-liturgical note for the day (national holidays of Greece). */
export interface DayNote { en: string; el: string }

type F = FeastData;
const f = (en: string, el: string, extra: Partial<FeastData> = {}): F => ({ en, el, ...extra });

// ── Moveable feasts: days from Pascha ────────────────────────────────────────
export const MOVEABLE_OFFSETS: Record<string, F> = {
  '-70': f('Sunday of the Publican and the Pharisee', 'Κυριακή του Τελώνου και του Φαρισαίου', { tier: 'major', fastFree: true }),
  '-63': f('Sunday of the Prodigal Son', 'Κυριακή του Ασώτου', { tier: 'major' }),
  '-57': f('Saturday of Souls (Meatfare)', 'Ψυχοσάββατο', { tier: 'commemoration' }),
  '-56': f('Meatfare Sunday (the Last Judgment)', 'Κυριακή της Απόκρεω (της Αποκρέω)', { tier: 'major' }),
  '-49': f('Cheesefare Sunday (Forgiveness Sunday)', 'Κυριακή της Τυροφάγου (Συγχωρήσεως)', { tier: 'major', fast: 'dairy' }),
  '-48': f('Clean Monday — Beginning of Great Lent', 'Καθαρά Δευτέρα — Αρχή της Μεγάλης Τεσσαρακοστής'),
  '-43': f('Saturday of St Theodore (the Kollyva miracle)', 'Σάββατο του Αγίου Θεοδώρου του Τήρωνος', { tier: 'saint' }),
  '-42': f('Sunday of Orthodoxy', 'Κυριακή της Ορθοδοξίας', { tier: 'major' }),
  '-36': f('Saturday of Souls (2nd of Lent)', 'Ψυχοσάββατο (Β΄ εβδομάδας)', { tier: 'commemoration' }),
  '-35': f('Sunday of St Gregory Palamas', 'Κυριακή του Αγίου Γρηγορίου του Παλαμά', { tier: 'major' }),
  '-29': f('Saturday of Souls (3rd of Lent)', 'Ψυχοσάββατο (Γ΄ εβδομάδας)', { tier: 'commemoration' }),
  '-28': f('Sunday of the Veneration of the Cross', 'Κυριακή της Σταυροπροσκυνήσεως', { tier: 'major' }),
  '-22': f('Saturday of Souls (4th of Lent)', 'Ψυχοσάββατο (Δ΄ εβδομάδας)', { tier: 'commemoration' }),
  '-21': f('Sunday of St John of the Ladder', 'Κυριακή του Αγίου Ιωάννου της Κλίμακος', { tier: 'major' }),
  '-15': f('Saturday of the Akathist Hymn', 'Σάββατο του Ακαθίστου Ύμνου', { tier: 'major' }),
  '-14': f('Sunday of St Mary of Egypt', 'Κυριακή της Οσίας Μαρίας της Αιγυπτίας', { tier: 'major' }),
  '-8': f('Saturday of Lazarus', 'Σάββατο του Λαζάρου', { tier: 'major' }),
  '-7': f('Palm Sunday — Entry into Jerusalem', 'Κυριακή των Βαΐων — Είσοδος στα Ιεροσόλυμα', { tier: 'great', color: 'palm', fast: 'fish' }),
  '-6': f('Great and Holy Monday', 'Μεγάλη Δευτέρα', { fast: 'strict', holyWeek: true }),
  '-5': f('Great and Holy Tuesday', 'Μεγάλη Τρίτη', { fast: 'strict', holyWeek: true }),
  '-4': f('Great and Holy Wednesday', 'Μεγάλη Τετάρτη', { fast: 'strict', holyWeek: true }),
  '-3': f('Great and Holy Thursday — the Last Supper', 'Μεγάλη Πέμπτη — Μυστικός Δείπνος', { fast: 'strict', holyWeek: true, tier: 'great' }),
  '-2': f('Great and Holy Friday — the Holy Passion', 'Μεγάλη Παρασκευή — Άγια Πάθη', { fast: 'totalfast', holyWeek: true, tier: 'pascha' }),
  '-1': f('Great and Holy Saturday', 'Μέγα Σάββατο', { fast: 'strict', holyWeek: true }),
  '0': f('HOLY PASCHA — The Resurrection of Our Lord', 'ΑΓΙΟΝ ΠΑΣΧΑ — Ανάσταση του Κυρίου', { tier: 'pascha', color: 'pascha', fastFree: true }),
  '1': f('Bright Monday', 'Δευτέρα της Διακαινησίμου', { tier: 'great', color: 'bright', fastFree: true }),
  '2': f('Bright Tuesday', 'Τρίτη της Διακαινησίμου', { color: 'bright', fastFree: true }),
  '3': f('Bright Wednesday', 'Τετάρτη της Διακαινησίμου', { color: 'bright', fastFree: true }),
  '4': f('Bright Thursday', 'Πέμπτη της Διακαινησίμου', { color: 'bright', fastFree: true }),
  '5': f('Bright Friday — Life-giving Spring', 'Παρασκευή της Διακαινησίμου — Ζωοδόχου Πηγής', { tier: 'great', color: 'bright', fastFree: true }),
  '6': f('Bright Saturday', 'Σάββατο της Διακαινησίμου', { color: 'bright', fastFree: true }),
  '7': f('Sunday of Thomas (Antipascha)', 'Κυριακή του Θωμά (Αντίπασχα)', { tier: 'great' }),
  '14': f('Sunday of the Myrrh-bearing Women', 'Κυριακή των Μυροφόρων', { tier: 'major' }),
  '21': f('Sunday of the Paralytic', 'Κυριακή του Παραλύτου', { tier: 'major' }),
  '25': f('Mid-Pentecost', 'Μεσοπεντηκοστή', { tier: 'major' }),
  '28': f('Sunday of the Samaritan Woman', 'Κυριακή της Σαμαρείτιδος', { tier: 'major' }),
  '35': f('Sunday of the Blind Man', 'Κυριακή του Τυφλού', { tier: 'major' }),
  '39': f('Ascension of the Lord', 'Ανάληψη του Κυρίου', { tier: 'great' }),
  '42': f('Sunday of the Holy Fathers of the First Ecumenical Council', 'Κυριακή των Αγίων Πατέρων της Α΄ Οικουμενικής Συνόδου', { tier: 'major' }),
  '48': f('Saturday of Souls (before Pentecost)', 'Ψυχοσάββατο (προ της Πεντηκοστής)', { tier: 'commemoration' }),
  '49': f('Pentecost — the Holy Trinity', 'Κυριακή της Πεντηκοστής — Αγία Τριάδα', { tier: 'great', color: 'pentecost', fastFree: true }),
  '50': f('Monday of the Holy Spirit', 'Δευτέρα του Αγίου Πνεύματος', { tier: 'great', fastFree: true }),
  '56': f('Sunday of All Saints', 'Κυριακή των Αγίων Πάντων', { tier: 'major' }),
  '57': f("Beginning of the Apostles' Fast", 'Έναρξη της νηστείας των Αγίων Αποστόλων'),
};

// ── Fixed feasts: civil date "MM-DD" ─────────────────────────────────────────
export const FIXED_FEASTS: Record<string, F> = {
  // January
  '01-01': f('Circumcision of the Lord — St Basil the Great', 'Περιτομή του Κυρίου — Άγιος Βασίλειος ο Μέγας', { tier: 'great' }),
  '01-05': f('Eve of Theophany', 'Παραμονή των Θεοφανείων', { fast: 'strict' }),
  '01-06': f('Holy Theophany — Baptism of the Lord', 'Άγια Θεοφάνεια — Βάπτιση του Κυρίου', { tier: 'great' }),
  '01-07': f('Synaxis of St John the Forerunner', 'Σύναξις του Αγίου Ιωάννου του Προδρόμου', { tier: 'major' }),
  '01-17': f('St Anthony the Great', 'Άγιος Αντώνιος ο Μέγας', { tier: 'major' }),
  '01-18': f('Ss Athanasius and Cyril of Alexandria', 'Άγιοι Αθανάσιος και Κύριλλος Αλεξανδρείας', { tier: 'saint' }),
  '01-20': f('St Euthymius the Great', 'Όσιος Ευθύμιος ο Μέγας', { tier: 'saint' }),
  '01-25': f('St Gregory the Theologian', 'Άγιος Γρηγόριος ο Θεολόγος', { tier: 'major' }),
  '01-30': f('The Three Hierarchs', 'Οι Τρεις Ιεράρχες', { tier: 'major' }),
  '01-31': f('Ss Cyrus and John the Unmercenaries', 'Άγιοι Κύρος και Ιωάννης οι Ανάργυροι', { tier: 'saint' }),
  // February
  '02-01': f('St Tryphon the Martyr', 'Άγιος Τρύφων ο Μάρτυρας', { tier: 'saint' }),
  '02-02': f('Presentation of the Lord in the Temple', 'Η Υπαπαντή του Κυρίου', { tier: 'great' }),
  '02-03': f('Ss Symeon the God-receiver and Anna the Prophetess', 'Άγιοι Συμεών ο Θεοδόχος και Άννα η Προφήτις', { tier: 'saint' }),
  '02-08': f('St Theodore the General', 'Άγιος Θεόδωρος ο Στρατηλάτης', { tier: 'saint' }),
  '02-10': f('St Charalambos the Hieromartyr', 'Άγιος Χαράλαμπος ο Ιερομάρτυρας', { tier: 'major' }),
  '02-11': f('St Blaise the Hieromartyr', 'Άγιος Βλάσιος ο Ιερομάρτυρας', { tier: 'saint' }),
  '02-23': f('St Polycarp of Smyrna', 'Άγιος Πολύκαρπος Σμύρνης', { tier: 'saint' }),
  '02-24': f('First and Second Finding of the Head of St John the Forerunner', 'Α΄ και Β΄ Εύρεσις της Τιμίας Κεφαλής του Προδρόμου', { tier: 'saint' }),
  // March
  '03-09': f('The Holy Forty Martyrs of Sebaste', 'Οι Άγιοι Τεσσαράκοντα Μάρτυρες', { tier: 'saint', fast: 'oilwine' }),
  '03-25': f('Annunciation of the Theotokos', 'Ο Ευαγγελισμός της Θεοτόκου', { tier: 'great', fast: 'fish' }),
  '03-26': f('Synaxis of the Archangel Gabriel', 'Σύναξις του Αρχαγγέλου Γαβριήλ', { tier: 'saint' }),
  '03-30': f('St John of the Ladder', 'Όσιος Ιωάννης της Κλίμακος', { tier: 'saint' }),
  // April
  '04-23': f('St George the Great Martyr', 'Άγιος Γεώργιος ο Μεγαλομάρτυς', { tier: 'major' }),
  '04-25': f('St Mark the Apostle and Evangelist', 'Άγιος Μάρκος ο Απόστολος και Ευαγγελιστής', { tier: 'saint' }),
  '04-30': f('St James the Apostle, son of Zebedee', 'Άγιος Ιάκωβος ο Απόστολος, του Ζεβεδαίου', { tier: 'saint' }),
  // May
  '05-02': f('St Athanasius the Great', 'Άγιος Αθανάσιος ο Μέγας', { tier: 'saint' }),
  '05-05': f('St Irene the Great Martyr', 'Αγία Ειρήνη η Μεγαλομάρτυς', { tier: 'saint' }),
  '05-08': f('St John the Theologian, Apostle and Evangelist', 'Άγιος Ιωάννης ο Θεολόγος, Απόστολος και Ευαγγελιστής', { tier: 'major' }),
  '05-11': f('Ss Cyril and Methodius, Equals-to-the-Apostles', 'Άγιοι Κύριλλος και Μεθόδιος, ισαπόστολοι', { tier: 'saint' }),
  '05-21': f('Ss Constantine and Helen, Equals-to-the-Apostles', 'Άγιοι Κωνσταντίνος και Ελένη, ισαπόστολοι', { tier: 'major' }),
  '05-25': f('Third Finding of the Head of St John the Forerunner', 'Γ΄ Εύρεσις της Τιμίας Κεφαλής του Προδρόμου', { tier: 'saint' }),
  // June
  '06-11': f('Ss Bartholomew and Barnabas the Apostles', 'Άγιοι Βαρθολομαίος και Βαρνάβας οι Απόστολοι', { tier: 'saint' }),
  '06-24': f('Nativity of St John the Forerunner', 'Γέννησις του Αγίου Ιωάννου του Προδρόμου', { tier: 'major' }),
  '06-29': f('Ss Peter and Paul, the Chief Apostles', 'Άγιοι Απόστολοι Πέτρος και Παύλος', { tier: 'great' }),
  '06-30': f('Synaxis of the Holy Twelve Apostles', 'Σύναξις των Αγίων Δώδεκα Αποστόλων', { tier: 'major' }),
  // July
  '07-02': f('Deposition of the Robe of the Theotokos at Blachernae', 'Κατάθεση της Τιμίας Εσθήτος της Θεοτόκου', { tier: 'saint' }),
  '07-12': f('St Paisios of Mount Athos', 'Όσιος Παΐσιος ο Αγιορείτης', { tier: 'saint' }),
  '07-17': f('St Marina the Great Martyr', 'Αγία Μαρίνα η Μεγαλομάρτυς', { tier: 'major' }),
  '07-20': f('The Holy Prophet Elias', 'Ο Προφήτης Ηλίας', { tier: 'major' }),
  '07-22': f('St Mary Magdalene, Equal-to-the-Apostles', 'Αγία Μαρία η Μαγδαληνή, ισαπόστολος', { tier: 'major' }),
  '07-24': f('St Christina the Great Martyr', 'Αγία Χριστίνα η Μεγαλομάρτυς', { tier: 'saint' }),
  '07-25': f('Dormition of St Anna, mother of the Theotokos', 'Κοίμησις της Αγίας Άννης, μητέρας της Θεοτόκου', { tier: 'saint' }),
  '07-26': f('St Paraskevi the Martyr', 'Αγία Παρασκευή η Μάρτυς', { tier: 'major' }),
  '07-27': f('St Panteleimon the Great Martyr', 'Άγιος Παντελεήμων ο Μεγαλομάρτυς', { tier: 'major' }),
  // August
  '08-01': f('Beginning of the Dormition Fast — Procession of the Precious Cross', 'Έναρξη νηστείας Κοιμήσεως — Προέλευσις του Τιμίου Σταυρού', { tier: 'saint' }),
  '08-06': f('Transfiguration of the Saviour', 'Η Μεταμόρφωση του Σωτήρος', { tier: 'great', fast: 'fish' }),
  '08-09': f('St Matthias the Apostle', 'Άγιος Ματθίας ο Απόστολος', { tier: 'saint' }),
  '08-15': f('Dormition of the Theotokos', 'Η Κοίμησις της Θεοτόκου', { tier: 'great', fastFree: true }),
  '08-16': f('Translation of the Holy Mandylion', 'Μετακομιδή του Αγίου Μανδηλίου', { tier: 'saint' }),
  '08-29': f('Beheading of St John the Forerunner', 'Αποτομή της Κεφαλής του Αγίου Ιωάννου του Προδρόμου', { tier: 'great', fast: 'strict' }),
  '08-31': f('Deposition of the Belt of the Theotokos', 'Κατάθεση της Τιμίας Ζώνης της Θεοτόκου', { tier: 'saint' }),
  // September
  '09-01': f('Beginning of the Church Year — St Symeon the Stylite', 'Αρχή της Ινδίκτου — Όσιος Συμεών ο Στυλίτης', { tier: 'major' }),
  '09-05': f('St Zachariah the Prophet, father of the Forerunner', 'Ο Προφήτης Ζαχαρίας, πατέρας του Προδρόμου', { tier: 'saint' }),
  '09-06': f('Miracle of the Archangel Michael at Chonae', 'Το Θαύμα του Αρχαγγέλου Μιχαήλ εν Χώναις', { tier: 'saint' }),
  '09-08': f('Nativity of the Theotokos', 'Το Γενέσιον της Θεοτόκου', { tier: 'great' }),
  '09-09': f('Ss Joachim and Anna, ancestors of Christ', 'Άγιοι Ιωακείμ και Άννα, οι θεοπάτορες', { tier: 'saint' }),
  '09-14': f('Exaltation of the Precious and Life-giving Cross', 'Η Ύψωσις του Τιμίου και Ζωοποιού Σταυρού', { tier: 'great', fast: 'strict' }),
  '09-17': f('Ss Sophia, and her daughters Faith, Hope and Love', 'Αγία Σοφία και οι θυγατέρες της Πίστις, Ελπίς και Αγάπη', { tier: 'saint' }),
  '09-20': f('St Eustathius the Great Martyr', 'Άγιος Ευστάθιος ο Μεγαλομάρτυς', { tier: 'saint' }),
  '09-23': f('Conception of St John the Forerunner', 'Η Σύλληψις του Αγίου Ιωάννου του Προδρόμου', { tier: 'saint' }),
  '09-24': f('St Thekla the Protomartyr, Equal-to-the-Apostles', 'Αγία Θέκλα η Πρωτομάρτυς, ισαπόστολος', { tier: 'saint' }),
  '09-26': f('Repose of St John the Theologian', 'Μετάστασις του Αγίου Ιωάννου του Θεολόγου', { tier: 'major' }),
  // October
  '10-01': f('St Romanos the Melodist', 'Όσιος Ρωμανός ο Μελωδός', { tier: 'saint' }),
  '10-06': f('St Thomas the Apostle', 'Άγιος Θωμάς ο Απόστολος', { tier: 'saint' }),
  '10-09': f('St James the Apostle, son of Alphaeus', 'Άγιος Ιάκωβος ο Απόστολος, του Αλφαίου', { tier: 'saint' }),
  '10-11': f('St Philip the Deacon, one of the Seven', 'Άγιος Φίλιππος ο Διάκονος', { tier: 'saint' }),
  '10-18': f('St Luke the Apostle and Evangelist', 'Άγιος Λουκάς ο Απόστολος και Ευαγγελιστής', { tier: 'major' }),
  '10-23': f('St James the Brother of the Lord', 'Άγιος Ιάκωβος ο Αδελφόθεος', { tier: 'major' }),
  '10-26': f('St Demetrios the Great Martyr', 'Άγιος Δημήτριος ο Μεγαλομάρτυς', { tier: 'major' }),
  // November
  '11-01': f('Ss Cosmas and Damian the Unmercenaries of Asia', 'Άγιοι Κοσμάς και Δαμιανός οι Ανάργυροι', { tier: 'saint' }),
  '11-08': f('Synaxis of the Archangels Michael and Gabriel', 'Σύναξις των Ταξιαρχών Μιχαήλ και Γαβριήλ', { tier: 'major' }),
  '11-09': f('St Nektarios of Aegina', 'Άγιος Νεκτάριος Πενταπόλεως', { tier: 'major' }),
  '11-11': f('St Menas the Great Martyr', 'Άγιος Μηνάς ο Μεγαλομάρτυς', { tier: 'saint' }),
  '11-12': f('St John the Merciful, Patriarch of Alexandria', 'Άγιος Ιωάννης ο Ελεήμων', { tier: 'saint' }),
  '11-13': f('St John Chrysostom', 'Άγιος Ιωάννης ο Χρυσόστομος', { tier: 'major' }),
  '11-14': f('St Gregory Palamas', 'Άγιος Γρηγόριος ο Παλαμάς', { tier: 'major' }),
  '11-15': f('Beginning of the Nativity Fast — Ss Gurias, Samonas and Abibus', 'Έναρξη νηστείας Χριστουγέννων — Άγιοι Γουρίας, Σαμωνάς και Άβιβος', { tier: 'saint' }),
  '11-16': f('St Matthew the Apostle and Evangelist', 'Άγιος Ματθαίος ο Απόστολος και Ευαγγελιστής', { tier: 'saint' }),
  '11-20': f('Forefeast of the Entry of the Theotokos', 'Προεόρτια των Εισοδίων της Θεοτόκου', { tier: 'saint' }),
  '11-21': f('Entry of the Theotokos into the Temple', 'Τα Εισόδια της Θεοτόκου', { tier: 'great', fast: 'fish' }),
  '11-25': f('St Catherine the Great Martyr', 'Αγία Αικατερίνη η Μεγαλομάρτυς', { tier: 'major' }),
  '11-26': f('St Stylianos of Paphlagonia', 'Όσιος Στυλιανός', { tier: 'saint' }),
  '11-30': f('St Andrew the First-called Apostle', 'Άγιος Ανδρέας ο Πρωτόκλητος', { tier: 'major' }),
  // December
  '12-04': f('St Barbara the Great Martyr — St John of Damascus', 'Αγία Βαρβάρα η Μεγαλομάρτυς — Άγιος Ιωάννης ο Δαμασκηνός', { tier: 'major' }),
  '12-05': f('St Sabbas the Sanctified', 'Όσιος Σάββας ο Ηγιασμένος', { tier: 'saint' }),
  '12-06': f('St Nicholas, Archbishop of Myra', 'Άγιος Νικόλαος Αρχιεπίσκοπος Μύρων', { tier: 'major', fast: 'fish' }),
  '12-07': f('St Ambrose of Milan', 'Άγιος Αμβρόσιος Μεδιολάνων', { tier: 'saint' }),
  '12-09': f('Conception of the Theotokos by St Anna', 'Η Σύλληψις της Θεοτόκου από την Αγία Άννα', { tier: 'saint' }),
  '12-10': f('Ss Menas, Hermogenes and Eugraphus', 'Άγιοι Μηνάς, Ερμογένης και Ευγράφος', { tier: 'saint' }),
  '12-12': f('St Spyridon of Trimythous', 'Άγιος Σπυρίδων ο Θαυματουργός', { tier: 'major' }),
  '12-13': f('Ss Eustratius and companions, St Lucy', 'Άγιοι Ευστράτιος και συν αυτώ, Αγία Λουκία', { tier: 'saint' }),
  '12-15': f('St Eleutherios the Hieromartyr', 'Άγιος Ελευθέριος ο Ιερομάρτυς', { tier: 'saint' }),
  '12-17': f('St Daniel the Prophet and the Three Holy Youths — St Dionysios of Zakynthos', 'Προφήτης Δανιήλ και οι Τρεις Παίδες — Άγιος Διονύσιος Ζακύνθου', { tier: 'saint' }),
  '12-20': f('St Ignatius the God-bearer — Forefeast of the Nativity', 'Άγιος Ιγνάτιος ο Θεοφόρος — Προεόρτια των Χριστουγέννων', { tier: 'saint' }),
  '12-24': f('Eve of the Nativity of Christ', 'Παραμονή των Χριστουγέννων', { tier: 'saint', fast: 'strict' }),
  '12-25': f('Nativity of Our Lord Jesus Christ', 'Η Γέννησις του Κυρίου και Θεού και Σωτήρος ημών Ιησού Χριστού', { tier: 'great', color: 'nativity', fastFree: true }),
  '12-26': f('Synaxis of the Theotokos', 'Σύναξις της Υπεραγίας Θεοτόκου', { tier: 'great', fastFree: true }),
  '12-27': f('St Stephen the Protomartyr', 'Άγιος Στέφανος ο Πρωτομάρτυς', { tier: 'major', fastFree: true }),
  '12-29': f('The Holy Innocents slain by Herod', 'Οι Άγιοι Νήπια οι υπό του Ηρώδου αναιρεθέντες', { tier: 'saint', fastFree: true }),
};

// National days of Greece, noted for the community (they are not church feasts).
export const GREEK_NATIONAL_DAYS: Record<string, DayNote> = {
  '03-25': { en: 'Greek Independence Day', el: 'Εθνική Εορτή — Επέτειος της Ελληνικής Επανάστασης' },
  '10-28': { en: 'Ochi Day', el: 'Εθνική Εορτή — Επέτειος του «Όχι»' },
};

// ── Labels ───────────────────────────────────────────────────────────────────
export const FAST_COLOR: Record<FastType, string> = {
  strict: '#7A1010',
  oilwine: '#A9760F',
  fish: '#2A6088',
  dairy: '#8A6D1A',
  fastfree: '#2A7A48',
  totalfast: '#1C1C1C',
};

export const FAST_LABEL: Record<FastType, { en: string; el: string }> = {
  strict:    { en: 'Strict fast',           el: 'Αυστηρή νηστεία' },
  oilwine:   { en: 'Oil & wine allowed',    el: 'Κατάλυση ελαίου και οίνου' },
  fish:      { en: 'Fish allowed',          el: 'Κατάλυση ιχθύος' },
  dairy:     { en: 'Dairy & eggs allowed',  el: 'Κατάλυση γάλακτος και αυγών' },
  fastfree:  { en: 'Fast-free',             el: 'Κατάλυση εις πάντα' },
  totalfast: { en: 'Total abstinence',      el: 'Άσιτος' },
};

export type FastPeriodKey =
  | 'greatLent' | 'apostles' | 'dormition' | 'nativity' | 'weekly'
  | 'cheesefare' | 'publican' | 'afterPentecost' | 'afterNativity' | 'bright';

export const FAST_PERIOD_LABEL: Record<FastPeriodKey, { en: string; el: string }> = {
  greatLent:      { en: 'Great Lent', el: 'Μεγάλη Τεσσαρακοστή' },
  apostles:       { en: "Apostles' Fast", el: 'Νηστεία των Αγίων Αποστόλων' },
  dormition:      { en: 'Dormition Fast', el: 'Νηστεία της Παναγίας' },
  nativity:       { en: 'Nativity Fast', el: 'Νηστεία των Χριστουγέννων' },
  weekly:         { en: 'Wednesday & Friday fast', el: 'Νηστεία Τετάρτης και Παρασκευής' },
  cheesefare:     { en: 'Cheesefare week', el: 'Εβδομάδα της Τυροφάγου' },
  publican:       { en: 'Fast-free week (Publican & Pharisee)', el: 'Κατάλυση εις πάντα (Τελώνου και Φαρισαίου)' },
  afterPentecost: { en: 'Fast-free week (after Pentecost)', el: 'Κατάλυση εις πάντα (μετά την Πεντηκοστή)' },
  afterNativity:  { en: 'Fast-free (Nativity to Theophany)', el: 'Κατάλυση εις πάντα (Χριστούγεννα έως Θεοφάνεια)' },
  bright:         { en: 'Bright Week — fast-free', el: 'Διακαινήσιμος Εβδομάδα — κατάλυση εις πάντα' },
};
