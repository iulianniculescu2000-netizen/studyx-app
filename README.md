# StudyX

StudyX este o aplicatie desktop pentru studenti la medicina, construita cu React, TypeScript, Vite si Electron. Aplicatia ajuta la organizarea grilelor, recapitulare, flashcards, statistici, mod review si asistenta AI pe baza documentelor incarcate.

## Functionalitati principale

- profiluri locale de utilizator si progres separat pe profil
- creare, import si organizare grile pe foldere
- mod de quiz, rezultate, review si recapitulare zilnica
- flashcards si biblioteca de cunostinte
- AI Studio pentru rezumate, explicatii, scheme, mnemonice si generare de pachete de grile din documente
- import pentru PDF, DOCX, text si imagini cu OCR
- statistici, streak, predictii de studiu si gamification
- aplicatie Electron cu update flow si build pentru Windows

## Setup rapid

```bash
npm install
npm run dev
```

Pentru aplicatia desktop in development:

```bash
npm run electron:dev
```

## Scripturi utile

```bash
npm run security:scan    # verifica daca exista chei/API tokens in fisierele proiectului
npm run lint             # ruleaza ESLint
npm run build            # compileaza TypeScript si genereaza build-ul Vite
npm run test:run         # ruleaza testele Vitest
npm run verify:runtime   # verifica fisiere/configuratii critice
npm run verify:all       # ruleaza scanare, lint, build, teste si verificari runtime
npm run electron:build   # genereaza installerul Electron
```

## Configurare AI

Cheile API nu se comit in repository. Configureaza providerul din setarile aplicatiei sau pastreaza cheile doar local, in fisiere ignorate de Git precum `.env.local`.

Provideri suportati in cod:

- Groq: chei de forma `gsk_...`
- DeepSeek: chei de forma `sk-...`

Daca o cheie ajunge intr-un fisier al proiectului, ruleaza imediat:

```bash
npm run security:scan
```

Apoi roteste cheia din dashboard-ul providerului.

## Build si release

Build web:

```bash
npm run build
```

Build desktop:

```bash
npm run electron:build
```

Update/publish:

```bash
npm run prepare-update
npm run publish-update
npm run electron:publish
```

Token-urile GitHub se tin local in `.update-config.json`, `GH_TOKEN` sau `GITHUB_TOKEN`; aceste fisiere/variabile nu trebuie publicate.

## Structura proiectului

- `src/pages` - paginile principale ale aplicatiei
- `src/components` - componente UI si module functionale
- `src/store` - store-uri Zustand pentru profil, grile, statistici, AI si UI
- `src/ai` - pipeline AI, parsere, retriever si generare
- `src/lib` - utilitare, flow-uri AI, update/stabilitate si procesari
- `electron` - main/preload/updater pentru aplicatia desktop
- `scripts` - build, release, update, securitate si verificari runtime
- `tests` si `src/test` - teste e2e, smoke, integration si unitare

## Verificare recomandata inainte de release

```bash
npm run verify:all
npm run electron:build
```

Pentru performanta bundle-ului:

```bash
npm run analyze:build
```
