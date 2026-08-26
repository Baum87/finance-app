import Decimal from 'decimal.js'
import { classifyBufferMonths } from './buffer-coverage'

export type FinancialHealthSignal =
  | { level: 'warning'; reason: 'buffer_krap'; bufferMonths: Decimal }
  | { level: 'warning'; reason: 'savings_rate_negative'; savingsRate: Decimal }
  | { level: 'positive'; savingsRate: Decimal | null; bufferMonths: Decimal | null }

/**
 * Bepaalt het meest urgente financiële aandachtspunt voor de triage-kaart op
 * de startpagina, op basis van de Financiële-gezondheid-cijfers die al op de
 * Cashflow-pagina bestaan. Prioriteit: een krappe buffer (acuut risico) gaat
 * voor een negatieve spaarquote (structureel probleem), die op zijn beurt
 * voorrang krijgt boven een bevestigende melding. Geeft geen tekst terug —
 * dat is een UI-keuze — alleen welk signaal en welke cijfers erbij horen.
 * Geeft null terug bij te weinig data om iets zinnigs te zeggen.
 */
export function determineFinancialHealthSignal(
  savingsRate: Decimal | null,
  bufferMonths: Decimal | null,
): FinancialHealthSignal | null {
  if (bufferMonths != null && classifyBufferMonths(bufferMonths) === 'krap') {
    return { level: 'warning', reason: 'buffer_krap', bufferMonths }
  }
  if (savingsRate != null && savingsRate.lt(0)) {
    return { level: 'warning', reason: 'savings_rate_negative', savingsRate }
  }
  if (savingsRate == null && bufferMonths == null) return null
  return { level: 'positive', savingsRate, bufferMonths }
}
