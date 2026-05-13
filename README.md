# QualiTrace — Quality Control System

Aplicație web modernă pentru control calitate în process. Permite operatorilor să scaneze job-uri, part number-uri și operații, să înregistreze măsurători cu sublerulul (USB/BT) și să valideze piesele cu badge.

## Arhitectură

```
QualiTrace/
├── backend/          # Node.js + Express + SQLite
│   └── src/
│       ├── database/ # Schema + seed data
│       ├── middleware/
│       └── routes/   # auth, users, operations, fields, inspections, reports
├── frontend/         # React 18 + TypeScript + Vite + Tailwind CSS
│   └── src/
│       ├── pages/operator/  # Interfața operator
│       ├── pages/admin/     # Panou admin
│       ├── components/
│       ├── hooks/useSerial  # Web Serial API pentru subler USB
│       └── services/api     # Client API Axios
├── INSTALL.bat       # Instalare dependențe
└── START.bat         # Pornire aplicație
```

## Instalare și pornire

### Cerințe
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Chrome sau Edge (pentru subler USB via Web Serial API)

### Pași
1. Rulați `INSTALL.bat` (o singură dată)
2. Rulați `START.bat` la fiecare pornire
3. Accesați `http://localhost:5173`

## Interfața Operator

Flux complet:
1. **Scanare Badge** — Identificare operator
2. **Scanare Job Number** — Nr. lucrare
3. **Scanare Part Number** — Nr. piesă
4. **Selectare Operație** — Scanare cod operație sau selectare din listă
5. **Măsurători** — Valori introduse automat de subler sau manual
   - ✅ Verde = în toleranță
   - ❌ Roșu = în afara toleranței
6. **Validare** — Scanare badge (când toate câmpurile sunt verzi)

## Interfața Admin

Acces: `http://localhost:5173/login`
- **Badge:** `ADMIN001` / **PIN:** `1234`

Funcționalități:
- **Dashboard** — Statistici generale, rata de aprobare, inspecții recente
- **Operatori** — Adăugare/editare operatori și admini
- **Operații** — Definire coduri operații
- **Câmpuri Măsurare** — Definire parametri cu valori min/max per operație
- **Rapoarte** — Istoric inspecții cu filtrare, detalii complete

## Conectare Subler USB

1. Conectați sublerulul la laptop via USB
2. În pagina de inspecție, apăsați **"Conectează Subler"**
3. Selectați portul COM din lista sistemului
4. Selectați câmpul activ (clic pe câmp)
5. Apăsați butonul DATA de pe subler → valoarea se completează automat

> **Notă:** Web Serial API funcționează numai în Chrome/Edge. Protocoalele suportate: ASCII cu newline (standard pentru majoritatea sublerelor USB).

## API Endpoints

```
POST /api/auth/login              # Login admin
POST /api/auth/validate-badge     # Validare badge orice utilizator
GET  /api/operations              # Listă operații
GET  /api/operations/:id/fields   # Câmpuri per operație
POST /api/inspections             # Start inspecție
PUT  /api/inspections/:id/measure # Înregistrare măsurătoare
POST /api/inspections/:id/validate # Validare finală
GET  /api/reports/inspections     # Rapoarte (admin)
```
