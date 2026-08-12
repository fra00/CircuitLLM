import type { Circuit } from '../../types/circuit'
import type { ProjectMemory } from '../../types/projectMemory'

export const CIRCUIT_JSON_SCHEMA = `{
  "type": "object",
  "properties": {
    "circuit_name": { "type": "string" },
    "components": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "type": { "type": "string" },
          "kicad_symbol": { "type": "string" },
          "value": { "type": "string" },
          "pins": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "label": { "type": "string" },
                "type": { "type": "string" }
              },
              "required": ["id", "label", "type"]
            }
          }
        },
        "required": ["id", "label", "type", "pins"]
      }
    },
    "nets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "connections": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "component_id": { "type": "string" },
                "pin_id": { "type": "string" }
              },
              "required": ["component_id", "pin_id"]
            }
          }
        },
        "required": ["name", "connections"]
      }
    }
  },
  "required": ["circuit_name", "components", "nets"]
}`

export const COMPONENT_TYPES = [
  'MICROCONTROLLER', 'RESISTOR', 'CAPACITOR', 'INDUCTOR', 'DIODE', 'LED',
  'TRANSISTOR', 'OPAMP', 'SENSOR', 'MOTOR', 'CONNECTOR', 'POWER_SUPPLY',
  'POWER_RAIL', 'SWITCH', 'OTHER',
].join(', ')

const PIN_TYPES = [
  'INPUT', 'OUTPUT', 'BIDIRECTIONAL', 'POWER_IN', 'POWER_OUT', 'PASSIVE', 'NO_CONNECT',
].join(', ')

export function buildSystemPrompt(
  canvasContext?: string[],
  projectMemory?: ProjectMemory | null,
): string {
  const memoryBlock =
    projectMemory && projectMemory.summary.trim().length > 0
      ? `

CONTESTO PROGETTO (MEMORIA COMPATTA, RISPETTALA):
- Obiettivo: ${projectMemory.goal || '(non specificato)'}
- Memoria:
${projectMemory.summary
  .split('\n')
  .map((line) => (line.trim() ? `- ${line.replace(/^-\s*/, '')}` : ''))
  .filter(Boolean)
  .join('\n')}`
      : ''

  const context = canvasContext && canvasContext.length > 0
    ? `

MODIFICHE MANUALI GIÀ APPLICATE AL CANVAS DALL'UTENTE (RISPETTALE, NON SOVRASCRIVERLE):
${canvasContext.map((line) => `- ${line}`).join('\n')}`
    : ''
  return `Sei un esperto progettista di schemi elettrici logici. Ricevi una descrizione in linguaggio naturale e produci la topologia del circuito in formato JSON.
${memoryBlock}${context}
REGOLE OBBLIGATORIE:
1. Rispondi SOLO con un singolo oggetto JSON valido, senza testo aggiuntivo, senza markdown, senza blocchi di codice. Attenzione alla sintassi JSON: separa SEMPRE gli elementi di un array o i membri di un oggetto con virgole, NON usare virgole finali, racchiudi chiavi e valori stringa tra virgolette doppie e verifica che tutte le parentesi siano bilanciate.
2. Non includere MAI coordinate spaziali: nessun campo x, y, position, width, height. La disposizione sul foglio è calcolata da un componente automatico.
3. Ogni componente deve avere almeno un pin. Pin id univoci all'interno del componente.
4. Ogni net (rete) raggruppa 2 o piu' pin che devono essere elettricamente connessi. Usa nomi di rete significativi: suffisso _BUS per alimentazioni (es. 5V_BUS, GND_BUS), _SIGNAL per segnali (es. I2C_SDA).
5. Inserisci valori realistici dove ha senso (resistori, condensatori, alimentazioni) e kicad_symbol quando lo conosci.
6. Includi sempre almeno una connessione di GND e una di alimentazione se il circuito ha componenti attivi.
7. Tipi componenti ammessi: ${COMPONENT_TYPES}.
8. Tipi pin ammessi: ${PIN_TYPES}.
9. PINOUT COMPLETO: ogni componente deve includere TUTTI i pin del componente reale, anche quelli NON collegati (es. Arduino Nano: D0-D13, A0-A7, 5V, 3V3, GND, VIN, RESET, TX0, RX1, ecc.). I pin non collegati vanno elencati nel campo pins ma NON devono comparire in nessuna net. Un pin inesistente nel chip e' un errore: mai inventare pin mancanti.

SCHEMA JSON A CUI DEVONO ADERIRE LE RISPOSTE:
${CIRCUIT_JSON_SCHEMA}

ESEMPIO DI RETE:
{ "name": "5V_BUS", "connections": [ { "component_id": "U1", "pin_id": "5V" }, { "component_id": "S1", "pin_id": "VCC" } ] }

ESEMPIO PINOUT COMPLETO (sensore reale a 4 pin: il pin EN non e' collegato a nessuna net, ma e' comunque elencato):
{ "id": "S1", "label": "Sensore IR", "type": "SENSOR", "kicad_symbol": "Sensor_Optical:SFH309FA", "pins": [ { "id": "VCC", "label": "VCC", "type": "POWER_IN" }, { "id": "GND", "label": "GND", "type": "POWER_IN" }, { "id": "OUT", "label": "OUT", "type": "OUTPUT" }, { "id": "EN", "label": "EN", "type": "INPUT" } ] }

MODIFICA DELLO SCHEMA ATTUALE:
Quando il messaggio utente inizia con "SCHEMA ATTUALE (JSON):" NON rigenerare lo schema da zero: applica la richiesta dell'utente a quello schema e restituisci l'INTERO schema aggiornato in un singolo oggetto JSON.
- Mantieni INVARIATI tutti i componenti, i pin, i valori e le net non toccati dalla richiesta (stessi id esatti).
- Per aggiungere un componente usa un id nuovo e non in conflitto (es. C4, R3, U2) e collegalo, quando possibile, a net esistenti (es. la net di alimentazione); crea nuove net solo se necessario.
- Per rimuovere un componente eliminalo e togli i suoi pin dalle net; elimina le net che restano con meno di 2 pin.
- Per cambiare un valore modifica SOLO il campo value del componente indicato.

Non spiegare nulla in output: solo il JSON.`
}

export function buildUserPrompt(description: string, currentCircuit?: Circuit): string {
  if (!currentCircuit) {
    return `Progetta lo schema elettrico per: "${description}".\nOutput: solo JSON.`
  }
  return `SCHEMA ATTUALE (JSON):
${JSON.stringify(currentCircuit)}

Richiesta utente: "${description}"

Applica la richiesta allo schema attuale e restituisci SOLO l'intero JSON aggiornato.`
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildMessages(
  description: string,
  canvasContext?: string[],
  currentCircuit?: Circuit,
  projectMemory?: ProjectMemory | null,
): LlmMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(canvasContext, projectMemory) },
    { role: 'user', content: buildUserPrompt(description, currentCircuit) },
  ]
}