# AGENTS.md

Questa guida definisce come lavorare in modo affidabile su `CircuitLLM`.

## Priorita' del progetto

**Documentazione e test sono obbligatori**, non opzionali:

- **Test** — prevengono regressioni su diff, parsing LLM, save/load, store e export. Ogni modifica a logica core deve passare `npm test`; comportamento nuovo = test nuovo o esteso.
- **Documentazione** — mantiene allineati utenti, contributor e agenti. Feature visibile o contratto cambiato = aggiornare `README.md`; regole operative = aggiornare `AGENTS.md`.

Non considerare completato un task che tocca comportamento utente o API interne senza **test verdi** e **documentazione aggiornata** dove serve.

## Obiettivo del progetto

`CircuitLLM` e' un editor schematico React/TypeScript con:
- canvas elettrico (`@xyflow/react`)
- auto-layout (`elkjs`)
- integrazione LLM multi-provider (OpenAI, Anthropic, Gemini, LM Studio)
- ciclo bidirezionale Canvas -> Diff -> Prompt LLM

## Regole operative (obbligatorie)

1. Non introdurre coordinate nel modello `Circuit`.
   - `Circuit` (`src/types/circuit.ts`) non deve contenere `x/y/position`.
   - La posizione e' responsabilita' esclusiva di `runElkLayout` (`src/utils/elkLayout.ts`).

2. Mantieni coerente il contratto JSON LLM.
   - Prompt: `src/utils/llm/prompts.ts`
   - Parsing/repair/normalizzazione: `src/utils/llm/validate.ts`
   - Client provider: `src/utils/llm/client.ts`
   - Ogni modifica deve preservare compatibilita' con i 4 provider supportati.

3. Ogni mutazione canvas significativa deve produrre contesto delta.
   - Store: `src/store/circuitStore.ts`
   - Diff: `src/utils/diff.ts`
   - Evita modifiche silenziose che saltano `recordNotification` (tranne reset espliciti).

4. Non rompere la semantica dei pin.
   - Lato pin dipende da `PinType` + `pinSide` (`src/utils/pinGeometry.ts`).
   - Se cambi `addPin`, aggiorna anche UI e comportamento dei nodi.

5. Non alterare il sample circuit in modo casuale.
   - `src/data/sampleCircuit.ts` e' riferimento funzionale e regressione visiva.

6. Esegui sempre gli unit test prima di chiudere una modifica.
   - Comando: `npm test` (Vitest, `vitest.config.ts`).
   - Obbligatorio dopo cambi a `src/utils/*`, `src/store/*`, `src/data/componentPalette.ts`, tipi condivisi o contratto JSON LLM.
   - Se tocchi logica coperta da test esistenti, verifica che passino; se aggiungi comportamento nuovo, aggiungi o estendi un `*.test.ts` nello stesso modulo.
   - Fixture condivisa: `src/test/fixtures.ts` (`makeTestCircuit()`).
   - Non considerare il task completato con test falliti o suite non eseguita.
   - Hook locale: `.husky/pre-push` esegue `npm test` e blocca la push se fallisce.
   - CI remota: `.github/workflows/ci.yml` (lint + test + build) su push/PR.

7. Mantieni la documentazione allineata al codice.
   - **README.md** — funzionalita' utente, comandi, formato file, architettura ad alto livello, sezione Test.
   - **AGENTS.md** — regole operative, checklist, mappa test, vincoli architetturali.
   - Aggiorna README quando cambiano: UI/toolbar, save/load, provider LLM, formato `.circuitllm.json`, flussi documentati.
   - Aggiorna AGENTS.md quando cambiano: convenzioni obbligatorie, moduli critici, suite test, checklist pre-commit.
   - Screenshot in `docs/screenshots/` solo se l'UI cambia in modo visibile (script `scripts/capture-screenshots.mjs`).
   - Non creare file markdown extra non richiesti; preferire README + AGENTS.md esistenti.

## Unit test (Vitest)

Suite in `src/**/*.test.ts`. Aree coperte:

| Modulo | File test |
|--------|-----------|
| Diff canvas → LLM | `src/utils/diff.test.ts` |
| Parsing/normalizzazione LLM | `src/utils/llm/validate.test.ts` |
| Prompt LLM | `src/utils/llm/prompts.test.ts` |
| Client LLM (mock fetch) | `src/utils/llm/client.test.ts` |
| Compaction memoria | `src/utils/llm/compactMemory.test.ts` |
| Save/load progetto | `src/utils/projectIO.test.ts` |
| Fingerprint memoria | `src/utils/memoryFingerprint.test.ts` |
| Geometria pin | `src/utils/pinGeometry.test.ts` |
| Graph React Flow | `src/utils/circuitToGraph.test.ts` |
| Layout ELK | `src/utils/elkLayout.test.ts` |
| Export KiCad | `src/utils/kicadExport.test.ts` |
| Palette componenti | `src/data/componentPalette.test.ts` |
| Provider presets | `src/data/providerPresets.test.ts` |
| Sample circuit | `src/data/sampleCircuit.test.ts` |
| Store circuito | `src/store/circuitStore.test.ts` |
| Store LLM / memoria | `src/store/llmStore.test.ts` |

Watch mode durante lo sviluppo: `npm run test:watch`.
Report coverage: `npm run test:coverage` (soglie minime in `vitest.config.ts`).

## Comandi standard (Windows/PowerShell)

Se `node/npm` non sono in PATH della sessione:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

Comandi principali:

```powershell
npm run dev
npm run lint
npm run build
npm test
npm run test:coverage
```

Se `npm` non e' risolto, usare:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" test
& "C:\Program Files\nodejs\npm.cmd" run test:coverage
```

## Checklist prima di chiudere una modifica

1. Unit test verdi (`npm test`); aggiungere/aggiornare test se la modifica introduce o cambia comportamento coperto.
2. Documentazione aggiornata se la modifica e' user-facing o cambia contratti/API interne (`README.md`, `AGENTS.md`).
3. Lint verde (`npm run lint`) o solo warning non bloccanti gia' noti.
4. Nessun errore TS/JSX nei file toccati.
5. Flusso canvas valido:
   - aggiunta componente
   - aggiunta/rimozione pin
   - collegamento/scollegamento edge
6. Re-layout funzionante e fallback ELK non rotto.
7. Flusso LLM valido:
   - richiesta inviata
   - risposta parsata/normalizzata
   - circuit store aggiornato

## Convenzioni di modifica

- **Test e documentazione vanno di pari passo con il codice** — stesso PR/task, non "dopo".
- Preferire cambi piccoli e mirati; evitare refactor larghi senza richiesta esplicita.
- Quando aggiungi stato UI, mantenerlo locale al componente se non serve globalmente.
- Usare commenti solo per logica non ovvia.
- Non cambiare nomi/shape dei tipi in `src/types/*` senza aggiornare tutte le dipendenze.

## Note sui provider LLM

- Default Gemini richiesto dal progetto: `gemini-3-flash-preview` (`src/data/providerPresets.ts`).
- LM Studio usa endpoint OpenAI-compatible locale.
- Gestire errori provider con messaggi leggibili (`result.error`) e raw opzionale.

## Cosa evitare

- Non introdurre dipendenze nuove senza necessita' reale.
- Non fare reset/revert distruttivi del repository.
- Non cambiare comportamento di serializzazione JSON senza testare almeno un caso reale (preferire un caso in `projectIO.test.ts` o `validate.test.ts`).
- Non chiudere modifiche a logica core senza aver eseguito `npm test`.
- Non mergiare feature user-facing senza aggiornare la documentazione pertinente.
- Non lasciare README o AGENTS.md in contraddizione con il comportamento reale dell'app.

