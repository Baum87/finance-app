// Canoniek tussenformaat voor xlsx-transactie-import. Elke broker-parser
// (zie brokers/) zet zijn eigen kolomlayout om naar deze vorm — de rest van
// de import-pipeline (matching, dedup, aanmaken) kent geen broker-specifieke
// logica.

export type RawGrid = (string | number | Date | null | undefined)[][]

export type ParsedTransactionRow = {
  isin: string
  product: string
  /** YYYY-MM-DD */
  transactionDate: string
  transactionType: 'buy' | 'sell'
  /** Decimal string, altijd positief. */
  quantity: string
  /** Decimal string, altijd positief. */
  pricePerUnit: string
  /** Decimal string, altijd positief, in EUR. */
  amount: string
  /** Decimal string, altijd positief, in EUR. */
  fees: string
  /** Broker-eigen unieke transactie-ID (bv. Degiro "Order ID"), voor dedup bij herupload. */
  externalRef: string | null
}

export type ParseWarning = {
  /** 1-indexed rijnummer in het originele bestand, voor het bericht aan de gebruiker. */
  row: number
  message: string
}

export type ParseResult = {
  brokerFormat: string
  rows: ParsedTransactionRow[]
  warnings: ParseWarning[]
}

export interface BrokerFileParser {
  id: string
  label: string
  /** Bepaalt of deze parser de headerrij van het bestand herkent. */
  detect(grid: RawGrid): boolean
  parse(grid: RawGrid): ParseResult
}
