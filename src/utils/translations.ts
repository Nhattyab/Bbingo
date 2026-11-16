export type Language = 'en' | 'am';

export interface Translations {
  // Brand & Header
  appName: string;
  languageName: string;
  switchLanguage: string;
  startsIn: string;
  startingSoon: string;
  claimWindow: string;
  auto: string;
  undo: string;
  redo: string;
  settings: string;
  adminPanel: string;
  signIn: string;
  signOut: string;
  openMenu: string;

  // Navigation Drawer
  homeGame: string;
  gameRules: string;
  gameHistory: string;
  profile: string;
  notifications: string;
  guestMode: string;
  notSignedIn: string;
  tournamentEdition: string;
  classicEdition: string;

  // Game Status & Announcements
  nextGame: string;
  gameStarting: string;
  gamePlaying: string;
  gameStopped: string;
  gamePaused: string;
  gameResumed: string;
  gameReset: string;
  gameSuspended: string;
  registrationOpened: string;
  registrationClosed: string;
  bingoClaimedWindow: string;
  gameCompletedNext: string;
  liveNotification: string;
  suspendedBadge: string;

  // Winning Rules
  ruleNotSet: string;
  ruleHorizontalLine: string;
  ruleVerticalLine: string;
  ruleDiagonalLine: string;
  ruleFourCorners: string;
  ruleBlackout: string;

  // Championship Card & Game Info
  gameWord: string;
  gameCodeLabel: string;
  activeWinningRule: string;
  showMore: string;
  showLess: string;
  blockedCards: string;
  gameWinners: string;
  pool: string;
  entry: string;
  noWinnersYet: string;
  noBlockedCards: string;
  ruleDescriptionPrefix: string;

  // Master Board
  masterBoardTitle: string;
  calledCount: string;
  latestCall: string;

  // Controls & Action Bar
  myCards: string;
  cardsCount: string;
  autoSync: string;
  autoSyncDesc: string;
  generateCard: string;
  registerAll: string;
  claimBingo: string;
  columns1: string;
  columns2: string;
  columns3: string;
  sortById: string;
  sortByRecent: string;
  sortByMarked: string;
  allCards: string;
  registeredOnly: string;
  unregisteredOnly: string;

  // Card View
  cardIdPrefix: string;
  freeSpace: string;
  cardRegistered: string;
  cardUnregistered: string;
  cardBlocked: string;
  inspectCard: string;
  deleteCard: string;
  confirmDelete: string;
  cancel: string;
  close: string;

  // Game History & Recap
  myGameHistoryTitle: string;
  myGameHistorySubtitle: string;
  recapTitle: string;
  recapSubtitle: string;
  filterByDate: string;
  filterAll: string;
  filterToday: string;
  filter7Days: string;
  filter30Days: string;
  fromDate: string;
  toDate: string;
  clearFilters: string;
  showDetailsRecap: string;
  cardsRegisteredByMe: string;
  lastWinningNumber: string;
  lastWinningNumberDesc: string;
  row1MyCards: string;
  row2WinnersCards: string;
  row3BlockedCards: string;
  clickToInspect: string;
  noCardsRegisteredByYou: string;
  noConfirmedWinners: string;
  noBlockedInRound: string;
  noPlayedGamesFound: string;
  noGamesMatchFilter: string;

  // Settings Modal
  settingsTitle: string;
  settingsSubtitle: string;
  language: string;
  languageSetting: string;
  englishOption: string;
  amharicOption: string;
  soundEffects: string;
  voiceCaller: string;
  vibration: string;
  appearanceTheme: string;
  clearMarks: string;
  clearMarksDesc: string;
  myBingoCards: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    // Brand & Header
    appName: 'MY Bingo',
    languageName: 'English',
    switchLanguage: 'አማርኛ',
    startsIn: 'Starts in',
    startingSoon: 'Starting Soon',
    claimWindow: 'Claim Window',
    auto: 'Auto',
    undo: 'Undo',
    redo: 'Redo',
    settings: 'Settings',
    adminPanel: 'Admin Panel',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    openMenu: 'Open Menu',

    // Navigation Drawer
    homeGame: 'Home / Game',
    gameRules: 'Game Rules',
    gameHistory: 'Game History',
    profile: 'Profile',
    notifications: 'Notifications',
    guestMode: 'Guest mode',
    notSignedIn: 'Not Signed In',
    tournamentEdition: 'Tournament Edition',
    classicEdition: 'Classic Edition',

    // Game Status & Announcements
    nextGame: 'Next game',
    gameStarting: 'Game is starting ..',
    gamePlaying: 'Game is playing',
    gameStopped: 'Game stopped',
    gamePaused: 'Game paused',
    gameResumed: 'Game resumed',
    gameReset: 'Game reset',
    gameSuspended: 'Game suspended by administrator',
    registrationOpened: 'registration opened',
    registrationClosed: 'registration closed',
    bingoClaimedWindow: 'Bingo claimed, bingo claim window will be closed in {seconds} seconds',
    gameCompletedNext: 'game completed, ready for the next game',
    liveNotification: 'Live Game Notification',
    suspendedBadge: 'Suspended',

    // Winning Rules
    ruleNotSet: 'Not Set',
    ruleHorizontalLine: 'Horizontal Line',
    ruleVerticalLine: 'Vertical Line',
    ruleDiagonalLine: 'Diagonal Line',
    ruleFourCorners: 'Four Corners',
    ruleBlackout: 'Full Card / Blackout',

    // Championship Card & Game Info
    gameWord: 'GAME',
    gameCodeLabel: 'Gamecode',
    activeWinningRule: 'Active Winning Rule',
    showMore: 'Show More',
    showLess: 'Show Less',
    blockedCards: 'Blocked Cards',
    gameWinners: 'Game Winners',
    pool: 'Pool',
    entry: 'Entry',
    noWinnersYet: 'No verified winners yet.',
    noBlockedCards: 'No cards blocked.',
    ruleDescriptionPrefix: 'Winning Pattern:',

    // Master Board
    masterBoardTitle: 'Official 75-Ball Master Board',
    calledCount: 'Called',
    latestCall: 'Latest Call',

    // Controls & Action Bar
    myCards: 'My Cards',
    cardsCount: 'Cards',
    autoSync: 'Auto Daub',
    autoSyncDesc: 'Synchronize marking across all cards',
    generateCard: 'Generate Card',
    registerAll: 'Register All Cards',
    claimBingo: 'CLAIM BINGO!',
    columns1: '1 Col',
    columns2: '2 Cols',
    columns3: '3 Cols',
    sortById: 'ID',
    sortByRecent: 'Recent',
    sortByMarked: 'Marked',
    allCards: 'All',
    registeredOnly: 'Registered',
    unregisteredOnly: 'Unregistered',

    // Card View
    cardIdPrefix: '#',
    freeSpace: 'FREE',
    cardRegistered: 'Registered',
    cardUnregistered: 'Unregistered',
    cardBlocked: 'Blocked',
    inspectCard: 'Inspect',
    deleteCard: 'Delete',
    confirmDelete: 'Are you sure you want to delete this card?',
    cancel: 'Cancel',
    close: 'Close',

    // Game History & Recap
    myGameHistoryTitle: 'My Game History',
    myGameHistorySubtitle: 'Games you played, cards registered, and results',
    recapTitle: 'Game Recap',
    recapSubtitle: 'Review balls called, winning number, and card results',
    filterByDate: 'Filter by Date',
    filterAll: 'All',
    filterToday: 'Today',
    filter7Days: 'Last 7 Days',
    filter30Days: 'Last 30 Days',
    fromDate: 'From:',
    toDate: 'To:',
    clearFilters: 'Clear Filters',
    showDetailsRecap: 'Show Details / Recap',
    cardsRegisteredByMe: 'My Cards Registered',
    lastWinningNumber: 'Last Winning Number',
    lastWinningNumberDesc: 'Ball that triggered the verified Bingo claim',
    row1MyCards: 'Row 1: My Registered Cards',
    row2WinnersCards: 'Row 2: Winners Cards',
    row3BlockedCards: 'Row 3: Blocked Cards',
    clickToInspect: 'Click any card ID to view matrix',
    noCardsRegisteredByYou: 'You had no registered cards in this game round.',
    noConfirmedWinners: 'No confirmed winners recorded.',
    noBlockedInRound: 'No cards were blocked in this round.',
    noPlayedGamesFound: 'No played games found',
    noGamesMatchFilter: 'No games match your selected date filter.',

    // Settings Modal
    settingsTitle: 'Game & Card Settings',
    settingsSubtitle: 'Preferences, audio, and language options',
    language: 'Language',
    languageSetting: 'Language / ቋንቋ',
    englishOption: 'English',
    amharicOption: 'አማርኛ (Amharic)',
    soundEffects: 'Sound Effects',
    voiceCaller: 'Voice Caller',
    vibration: 'Vibration',
    appearanceTheme: 'Appearance Theme',
    clearMarks: 'Clear Card Marks',
    clearMarksDesc: 'Reset daubed cells on all your active cards',
    myBingoCards: 'My Bingo Cards',
  },
  am: {
    // Brand & Header
    appName: 'የእኔ ቢንጎ',
    languageName: 'አማርኛ',
    switchLanguage: 'English',
    startsIn: 'ይጀምራል በ',
    startingSoon: 'በቅርቡ ይጀምራል',
    claimWindow: 'የጥያቄ መስኮት',
    auto: 'ራስ-ሰር',
    undo: 'መልስ',
    redo: 'ድገም',
    settings: 'ቅንብሮች',
    adminPanel: 'አስተዳዳሪ',
    signIn: 'ግባ',
    signOut: 'ውጣ',
    openMenu: 'ሜኑ ክፈት',

    // Navigation Drawer
    homeGame: 'መነሻ / ጨዋታ',
    gameRules: 'የጨዋታ ደንቦች',
    gameHistory: 'የጨዋታ ታሪክ',
    profile: 'መገለጫ',
    notifications: 'ማሳወቂያዎች',
    guestMode: 'እንግዳ',
    notSignedIn: 'አልገቡም',
    tournamentEdition: 'ውድድር እትም',
    classicEdition: 'ክላሲክ እትም',

    // Game Status & Announcements
    nextGame: 'ቀጣይ ጨዋታ',
    gameStarting: 'ጨዋታው ሊጀመር ነው ..',
    gamePlaying: 'ጨዋታው እየተካሄደ ነው',
    gameStopped: 'ጨዋታው ቆሟል',
    gamePaused: 'ጨዋታው ለጊዜው ቆሟል',
    gameResumed: 'ጨዋታው ቀጥሏል',
    gameReset: 'ጨዋታው እንደገና ተጀምሯል',
    gameSuspended: 'ጨዋታው በአስተዳዳሪው ታግዷል',
    registrationOpened: 'ምዝገባ ተከፍቷል',
    registrationClosed: 'ምዝገባ ተዘግቷል',
    bingoClaimedWindow: 'ቢንጎ ተጠይቋል፣ የጥያቄ መስኮቱ በ{seconds} ሰከንዶች ውስጥ ይዘጋል',
    gameCompletedNext: 'ጨዋታው ተጠናቋል፣ ለቀጣዩ ጨዋታ ዝግጁ ነው',
    liveNotification: 'የጨዋታው የቀጥታ ማሳወቂያ',
    suspendedBadge: 'ታግዷል',

    // Winning Rules
    ruleNotSet: 'አልተወሰነም',
    ruleHorizontalLine: 'አግድም መስመር',
    ruleVerticalLine: 'ቀጥ ያለ መስመር',
    ruleDiagonalLine: 'ዲያጎናል መስመር',
    ruleFourCorners: 'አራት ማዕዘናት',
    ruleBlackout: 'ሙሉ ካርድ / ብላክአውት',

    // Championship Card & Game Info
    gameWord: 'ጨዋታ',
    gameCodeLabel: 'የጨዋታ ኮድ',
    activeWinningRule: 'ንቁ የአሸናፊነት ደንብ',
    showMore: 'ተጨማሪ አሳይ',
    showLess: 'አሳንስ',
    blockedCards: 'የታገዱ ካርዶች',
    gameWinners: 'የጨዋታው አሸናፊዎች',
    pool: 'የሽልማት ፈንድ',
    entry: 'መግቢያ',
    noWinnersYet: 'እስካሁን የተረጋገጡ አሸናፊዎች የሉም።',
    noBlockedCards: 'የታገዱ ካርዶች የሉም።',
    ruleDescriptionPrefix: 'የአሸናፊነት ቅደም ተከተል:',

    // Master Board
    masterBoardTitle: 'ይፋዊ የ75 ኳስ ማስተር ቦርድ',
    calledCount: 'የተጠሩ',
    latestCall: 'የመጨረሻ ቁጥር',

    // Controls & Action Bar
    myCards: 'የእኔ ካርዶች',
    cardsCount: 'ካርዶች',
    autoSync: 'ራስ-ሰር ምልክት',
    autoSyncDesc: 'በሁሉም ካርዶች ላይ ምልክት ማመሳሰል',
    generateCard: 'ካርድ አውጣ',
    registerAll: 'ሁሉንም ካርዶች አስመዝግብ',
    claimBingo: 'ቢንጎ ጠይቅ!',
    columns1: '1 አምድ',
    columns2: '2 አምዶች',
    columns3: '3 አምዶች',
    sortById: 'መለያ ቁጥር',
    sortByRecent: 'አዲስ',
    sortByMarked: 'የተሞላ',
    allCards: 'ሁሉም',
    registeredOnly: 'የተመዘገቡ',
    unregisteredOnly: 'ያልተመዘገቡ',

    // Card View
    cardIdPrefix: '#',
    freeSpace: 'ነጻ',
    cardRegistered: 'የተመዘገበ',
    cardUnregistered: 'ያልተመዘገበ',
    cardBlocked: 'የታገደ',
    inspectCard: 'ተመልከት',
    deleteCard: 'ሰርዝ',
    confirmDelete: 'እርግጠኛ ነዎት ይህን ካርድ መሰረዝ ይፈልጋሉ?',
    cancel: 'ይቅር',
    close: 'ዝጋ',

    // Game History & Recap
    myGameHistoryTitle: 'የጨዋታ ታሪኬ',
    myGameHistorySubtitle: 'የተጫወቷቸው ጨዋታዎች፣ የተመዘገቡ ካርዶች እና ውጤቶች',
    recapTitle: 'የጨዋታ ማጠቃለያ',
    recapSubtitle: 'የተጠሩ ኳሶች፣ አሸናፊ ቁጥር እና የካርድ ውጤቶች',
    filterByDate: 'በቀን አጣራ',
    filterAll: 'ሁሉም',
    filterToday: 'ዛሬ',
    filter7Days: 'ያለፉት 7 ቀናት',
    filter30Days: 'ያለፉት 30 ቀናት',
    fromDate: 'ከ:',
    toDate: 'እስከ:',
    clearFilters: 'ማጣሪያ አጽዳ',
    showDetailsRecap: 'ዝርዝር / ማጠቃለያ አሳይ',
    cardsRegisteredByMe: 'የተመዘገቡ ካርዶቼ',
    lastWinningNumber: 'የመጨረሻው አሸናፊ ቁጥር',
    lastWinningNumberDesc: 'ቢንጎ እንዲረጋገጥ ያደረገው የመጨረሻ ኳስ',
    row1MyCards: 'ረድፍ 1: የተመዘገቡ ካርዶቼ',
    row2WinnersCards: 'ረድፍ 2: የአሸናፊዎች ካርዶች',
    row3BlockedCards: 'ረድፍ 3: የታገዱ ካርዶች',
    clickToInspect: 'ካርዱን ለማየት ቁጥሩን ይጫኑ',
    noCardsRegisteredByYou: 'በዚህ ዙር ያስመዘገቡት ካርድ አልነበረም።',
    noConfirmedWinners: 'የተረጋገጠ አሸናፊ አልተመዘገበም።',
    noBlockedInRound: 'በዚህ ዙር የታገደ ካርድ አልነበረም።',
    noPlayedGamesFound: 'ምንም የተጫወቱት ጨዋታ አልተገኘም',
    noGamesMatchFilter: 'በተመረጠው ቀን የተደረገ ጨዋታ የለም።',

    // Settings Modal
    settingsTitle: 'የጨዋታ እና የካርድ ቅንብሮች',
    settingsSubtitle: 'ምርጫዎች፣ ድምጽ እና የቋንቋ አማራጮች',
    language: 'ቋንቋ',
    languageSetting: 'ቋንቋ / Language',
    englishOption: 'English',
    amharicOption: 'አማርኛ',
    soundEffects: 'የድምፅ ውጤቶች',
    voiceCaller: 'የቁጥር ጠሪ ድምጽ',
    vibration: 'ንዝረት',
    appearanceTheme: 'ገጽታ',
    clearMarks: 'የካርድ ምልክቶችን አጽዳ',
    clearMarksDesc: 'በካርዶችዎ ላይ የተሞሉ ምልክቶችን እንደገና ይጀምሩ',
    myBingoCards: 'የእኔ የቢንጎ ካርዶች',
  },
};

export const RULE_NAME_MAP: Record<Language, Record<string, string>> = {
  en: {
    not_set: 'Not Set',
    horizontal_line: 'Horizontal Line',
    vertical_line: 'Vertical Line',
    diagonal_line: 'Diagonal Line',
    four_corners: 'Four Corners',
    blackout: 'Full Card / Blackout',
  },
  am: {
    not_set: 'አልተወሰነም',
    horizontal_line: 'አግድም መስመር',
    vertical_line: 'ቀጥ ያለ መስመር',
    diagonal_line: 'ዲያጎናል መስመር',
    four_corners: 'አራት ማዕዘናት',
    blackout: 'ሙሉ ካርድ / ብላክአውት',
  },
};

export const STATUS_LABEL_MAP: Record<Language, Record<string, string>> = {
  en: {
    next_game: 'Next Game',
    setup: 'Setup Mode',
    registration_open: 'Registration Open',
    registration_closed: 'Registration Closed',
    starting_countdown: 'Game Starting',
    pre_game_countdown: 'Game Starting',
    running: 'Playing',
    in_progress: 'Playing',
    paused: 'Paused',
    stopped: 'Stopped',
    claim_review: 'Claim Review',
    checking_winners: 'Checking Claim',
    winner_confirmed: 'Winner Verified',
    game_completed: 'Game Completed',
    completed: 'Completed',
  },
  am: {
    next_game: 'ቀጣይ ጨዋታ',
    setup: 'ዝግጅት ላይ',
    registration_open: 'ምዝገባ ክፍት ነው',
    registration_closed: 'ምዝገባ ተዘግቷል',
    starting_countdown: 'ሊጀመር ነው',
    pre_game_countdown: 'ሊጀመር ነው',
    running: 'እየተካሄደ ነው',
    in_progress: 'እየተካሄደ ነው',
    paused: 'ቆሟል',
    stopped: 'ቆሟል',
    claim_review: 'ጥያቄ እየተመረመረ',
    checking_winners: 'ጥያቄ እየተመረመረ',
    winner_confirmed: 'አሸናፊ ተረጋግጧል',
    game_completed: 'ተጠናቋል',
    completed: 'ተጠናቋል',
  },
};
