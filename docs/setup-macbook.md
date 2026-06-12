# Setup — MacBook thuis

Stap-voor-stap om op een verse MacBook verder te kunnen werken aan het finance-app project.

---

## 1. Xcode Command Line Tools

Vereist voor Git en compilers.

```bash
xcode-select --install
```

---

## 2. Homebrew

Packagemanager voor macOS.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Volg de instructies — Homebrew vraagt aan het einde om twee `eval`-regels toe te voegen aan `~/.zprofile`.

---

## 3. Node.js (via nvm — aanbevolen)

nvm laat je meerdere Node-versies beheren.

```bash
# nvm installeren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Terminal opnieuw starten, dan:
nvm install 20
nvm use 20
node -v   # moet 20.x tonen
```

---

## 4. Git

Waarschijnlijk al aanwezig na stap 1. Controleer:

```bash
git --version
```

Stel je identiteit in als dat nog niet gedaan is:

```bash
git config --global user.name "Remco"
git config --global user.email "remcobaumeister@gmail.com"
```

---

## 5. Project ophalen

```bash
cd ~/Developer   # of een andere map naar keuze
git clone https://github.com/<jouw-repo>/finance-app.git
cd finance-app
```

---

## 6. Node-packages installeren

Alle dependencies staan in `package.json` — één commando installeert alles (inclusief Drizzle, Next.js, Recharts, etc.):

```bash
npm install
```

---

## 7. Environment variables instellen

Maak een `.env.local` aan op basis van het voorbeeld:

```bash
cp .env.example .env.local
```

Open `.env.local` en vul de vier Supabase-waarden in. Die zijn te vinden in het **Supabase Dashboard → Settings → API**:

| Variabele | Waar te vinden |
|-----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role key |
| `SUPABASE_DB_URL` | Settings → Database → Connection string → URI (poort 5432) |

> Let op: `.env.local` staat in `.gitignore` en wordt nooit gecommit.

---

## 8. Development server starten

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 9. Claude Code (optioneel maar handig)

```bash
npm install -g @anthropic/claude-code
```

---

## Handige commando's

| Commando | Wat het doet |
|----------|-------------|
| `npm run dev` | Start de dev server |
| `npm run build` | Productie build |
| `npm run db:studio` | Drizzle Studio — visuele DB browser |
| `npm run db:generate` | Genereer migratie na schema-wijziging |
| `npm run test` | Vitest unit tests draaien |

---

## Wat je NIET hoeft te installeren

- Drizzle CLI apart — zit in `devDependencies`, wordt via `npm install` meegeïnstalleerd
- Supabase CLI — we gebruiken de hosted Supabase, geen lokale instantie
- PostgreSQL lokaal — de database draait in Supabase
