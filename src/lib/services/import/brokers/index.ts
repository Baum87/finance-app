import type { BrokerFileParser } from '../types'
import { degiroParser } from './degiro'

// Registry van ondersteunde bestandsformaten. Nieuwe broker toevoegen =
// nieuw bestand in deze map + hier registreren, geen wijziging elders.
export const BROKER_PARSERS: BrokerFileParser[] = [degiroParser]

export function findParserById(id: string): BrokerFileParser | undefined {
  return BROKER_PARSERS.find(p => p.id === id)
}

export function detectParser(grid: Parameters<BrokerFileParser['detect']>[0]): BrokerFileParser | undefined {
  return BROKER_PARSERS.find(p => p.detect(grid))
}
