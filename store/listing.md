# Cardly: Google Play listing

Everything to paste into Play Console for the first release. Graphics are in
`store/graphics/`, and the privacy policy site is in `store/site/`.

## Main store listing (Grow users → Store presence → Main store listing)

**App name** (30 max)

    Cardly: Flashcards & Recall

**Short description** (80 max)

    Flashcards that schedule themselves. Study a few minutes a day, remember more.

**Full description** (4000 max)

    Cardly is a flashcard app that remembers what you’re about to forget.

    Each time you review a card, you tell Cardly how well you knew it. Cardly then works out the best day to show it again, just before it would slip from memory. It uses FSRS, a modern spaced-repetition algorithm. The result: fewer, shorter reviews, and knowledge that sticks.

    START IN SECONDS
    • Pick your goals and Cardly suggests ready-made decks: Git commands, Big-O, SQL, Spanish, hiragana, cell biology, derivatives, statistics, medical terms, bones, world capitals and chemical elements
    • Or make your own decks in a few taps

    CARDS FOR HOW YOU LEARN
    • Basic cards, with an optional reverse card
    • Cloze cards: hide words inside a sentence
    • Code cards with syntax highlighting, made for programmers
    • Vocabulary cards for new languages

    BRING YOUR CARDS WITH YOU
    • Import Anki decks (.apkg), including your review history
    • Import spreadsheets and text files (CSV or tab-separated)
    • Back up everything to a single file and restore it on any phone

    STAY ON TRACK
    • Today screen shows exactly what’s due
    • Daily reminder at the time you choose
    • Progress stats: study heatmap, retention rate and a forecast of upcoming reviews
    • Choose how many new cards you learn each day

    PRIVATE BY DESIGN
    • No account needed
    • No ads, no tracking
    • Your cards stay on your phone and work offline

    Whether you’re preparing for exams, learning a language or keeping your coding skills sharp, Cardly helps you remember it for good.

## App details

- **Category:** Education
- **Tags** (choose up to 5 in Play Console): Flashcards, Education, Language learning, Study tools, Memory
- **Contact email:** your email (required, shown publicly)
- **Website:** your GitHub Pages address (optional)
- **Privacy policy URL:** `https://<your-github-username>.github.io/cardly/privacy.html`

## Graphics (Store presence → Main store listing → Graphics)

| Asset | File | Play requirement |
|---|---|---|
| App icon | `graphics/icon-512.png` | 512×512 PNG, up to 1 MB |
| Feature graphic | `graphics/feature-graphic.jpg` | 1024×500, JPEG or PNG without transparency |
| Phone screenshots | `graphics/screenshots/*.jpg` | 2–8 images, 9:16, long side at most twice the short side |

## App content (Policy → App content)

**Privacy policy:** the URL above.

**Ads:** No, my app does not contain ads.

**App access:** All functionality is available without special access (there's no sign-in).

**Target audience and content:** ages 13–15, 16–17 and 18+. Do *not* tick any under-13 group, otherwise the Families policy applies. "Could the store listing unintentionally appeal to children?" answer: No.

**Content rating** (IARC questionnaire): pick the category *Reference, News, or Educational*. Answer **No** to every question: violence, sexuality, language, controlled substances, gambling, user-generated content shared with others, location sharing, and digital purchases. Expected rating: Everyone / PEGI 3.

**News app:** No. **Health app:** No. **Government app:** No. **Financial features:** none.

**Data safety.** The only data that leaves the phone is Expo's update check (see the privacy policy): OS, app version and a random install ID. Declare it:

1. *Does your app collect or share any of the required user data types?* **Yes**
2. *Is all of the user data collected by your app encrypted in transit?* **Yes** (HTTPS)
3. *Do you provide a way for users to request that their data is deleted?* **No** (there's nothing linked to a person to delete; uninstalling removes the ID)
4. Data types → **Device or other IDs** only:
   - Collected: **Yes**. Shared: **No** (Expo is a service provider acting for you, which Google counts as not sharing)
   - Processed ephemerally: **No**
   - Required or optional: **Required** (users can't turn it off)
   - Purpose: **App functionality**

Everything else (name, email, location, contacts, files, app activity) is **not collected**. Cardly's own data stays on the device, and backups are sent only when the user picks a destination in the share menu. Google counts that as user-initiated, so it isn't collection.

## Releasing (Test and release)

1. Build: `npx eas-cli@latest build -p android --profile production` (creates the `.aab`)
2. **Testing → Closed testing** → create a track → upload the `.aab` by hand (the first upload must be manual)
3. Add at least 12 testers (an email list or a Google Group). They must opt in with the link and keep the app installed for 14 days in a row.
4. After 14 days: **Dashboard → Apply for production** → answer the questions about your test → roll out.

Release notes for 1.0.0 (500 max):

    First release of Cardly: spaced-repetition flashcards with ready-made decks, Anki and CSV import, backups, reminders and progress stats.
