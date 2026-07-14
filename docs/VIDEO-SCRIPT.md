# Forge Picks — scenariusz demo video (Loom, cel: ~3:45)

## Przygotowanie (przed nagraniem)

- [ ] Przeglądarka: tryb incognito lub czysty profil — bez zakładek, rozszerzeń, powiadomień
- [ ] Rozdzielczość 1920×1080, przeglądarka na pełnym ekranie
- [ ] Karta 1: `https://forge-picks.vercel.app` (świeżo załadowana, **bez** `?demo` — kickoff klikniesz ręcznie w kadrze)
- [ ] Karta 2: repo na GitHubie (README z góry)
- [ ] Jeśli pokazujesz live TxLINE: lokalnie `npm run dev:all` z `.env` → badge **● Live data** (karta 3)
- [ ] Zrób jedno suche przejście — mecz demo trwa ~90 s, więc timing scen 3–4 zależy od niego
- [ ] Loom: nagrywaj **ekran + kamera off** (albo małe kółko, jak wolisz), mikrofon sprawdź na 5 s próbce

> Kwestie mów swobodnie — to nie teleprompter. Ważne, żeby padły pogrubione słowa-klucze.

---

## Scena 1 — Hook (0:00–0:20)

**Ekran:** forge-picks.vercel.app, hero z meczem, badge widoczny.

> "Hi, this is **Forge Picks** — live World Cup scores from **TxLINE** turned into a fan pick game. You call the result, watch the match unfold live, and climb the leaderboard as results settle in real time. Let me show you."

## Scena 2 — Pick (0:20–0:50)

**Ekran:** wybierz **Germany vs Paraguay**, najedź na dwa przyciski, kliknij swój typ.

> "Every match, you make one call — **home or away**. Knockout football: no draw button, because ties go to extra time and penalties until someone wins. I'll back Germany. If the final result matches my pick, I earn **ten forge points** on the board. That's the whole game — simple on purpose."

## Scena 3 — Mecz na żywo (0:50–2:20)

**Ekran:** kliknij **▶ Kick off (demo)**. Nie gadaj bez przerwy — daj apce grać. Reaguj na gole.

> "Kick off. The app polls the score feed **every two seconds**."

*(przy pierwszym golu — pokaż banner i score pop)*

> "Goal! You get a banner, the score pops, and the hero flashes. Down here, the **goal timeline** — every scorer with the minute and their **club**, with a Transfermarkt link. Because at a World Cup, the club is the fun trivia."

*(w trakcie — przejedź kursorem po pasku 0–90')*

> "The progress bar tracks match time, zero to ninety."

*(opcjonalnie: wejdź w match detail)*

> "Match details use the **real 2026 host venues** — MetLife, SoFi, Estadio Azteca — plus the next fixtures."

## Scena 4 — Full time + Forge Board (2:20–2:50)

**Ekran:** koniec meczu, przewiń do Forge Board w momencie przetasowania.

> "Full time — and the moment the match settles, the **Forge Board reshuffles**. My pick was right, so that's plus ten points, and I move up against the rival typers. No refresh, it just happens."

## Scena 5 — TxLINE live data (2:50–3:30)

**Ekran:** przełącz na kartę z lokalną wersją z badge **● Live data** (albo pokaż badge i sekcję README o endpointach).

> "Everything you just saw ran in demo mode — but the app runs on **real TxLINE data**. I subscribed on-chain on Solana devnet, activated an API token, and the badge flips from demo replay to **live data**. Same UI, zero code changes. It uses TxLINE's guest auth, token activation, fixtures snapshot, and live score endpoints, with an API proxy that keeps tokens off the browser."

## Scena 6 — Wrap (3:30–3:50)

**Ekran:** karta z repo na GitHubie, potem wróć na forge-picks.vercel.app.

> "Stack is React, Vite and TypeScript — no heavy UI libraries. The repo is public, and the app is live at **forge-picks dot vercel dot app** — try it, hit kick off, and make your pick. Thanks for watching!"

---

## Po nagraniu

- [ ] Obejrzyj całość 1× — sprawdź, czy gole wypadły w kadrze i czy < 5:00
- [ ] Tytuł na Loom: `Forge Picks — TxLINE World Cup fan picks (Superteam Earn demo)`
- [ ] Link ustaw na **publiczny** i wklej do README + formularza submitu
