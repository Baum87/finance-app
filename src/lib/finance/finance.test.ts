import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateXirr } from './xirr'
import { buildXirrCashflows, hasMinimumXirrPeriod } from './xirr-cashflows'
import { calculateCostBasis, calculateQuantityHeld, calculateRealizedGain } from './cost-basis'
import { calculateNetDeposit } from './net-deposit'
import { calculateMarketValue, calculateSavingsBalance, calculateUnrealizedGain } from './current-value'
import { calculatePassiveIncome } from './passive-income'
import { calculateAllocation } from './allocation'
import {
  calculateGrossRentalYield,
  calculateNetRentalYield,
  calculateCashOnCash,
  calculateLtv,
  calculateEquity,
} from './real-estate'
import { calculateNetWorth } from './net-worth'
import { calculateTwr } from './twr'
import { calculateAnnualReturn } from './annual-return'
import { calculateExcessReturn } from './benchmark'
import { buildNetWorthSeries } from './net-worth-series'
import { buildSimpleEntryMonthlySeries, buildSingleValueMonthlySeries } from './simple-entry-series'
import { annualizeAmount, calculateRecurringTotals } from './recurring-cashflow'
import { calculateOneTimeExpensesTotal } from './one-time-expenses'
import { calculatePercentChange } from './percent-change'
import { calculateSavingsRate } from './savings-rate'
import { calculateBufferMonths, classifyBufferMonths } from './buffer-coverage'
import { calculatePassiveIncomeCoverage } from './passive-income-coverage'
import { determineFinancialHealthSignal } from './financial-health-signal'
import { calculateMortgageAmortizationForYear } from './mortgage-amortization'
import type { MortgageTerms } from './mortgage-amortization'
import { calculateRentalPeriodCashflowForYear } from './rental-period-cashflow'
import type { RentalPeriodInput } from './rental-period-cashflow'
import { buildMonthlyCashflowSeries, lastNMonths } from './monthly-cashflow-series'
import type { RecurringItemHistoryInput, OneTimeExpenseInput as MonthlyOneTimeExpenseInput } from './monthly-cashflow-series'

// ─── Helpers ────────────────────────────────────────────────────────────────

const d = (v: string | number) => new Decimal(v)

// ─── XIRR ───────────────────────────────────────────────────────────────────

describe('calculateXirr', () => {
  it('converges for a simple one-year investment', () => {
    const cashflows = [
      { amount: d('-1000'), date: new Date('2023-01-01') },
      { amount: d('1100'), date: new Date('2024-01-01') },
    ]
    const result = calculateXirr(cashflows)
    // ~10% return after 1 year (XIRR uses 365.25 days/yr so tiny deviation is expected)
    expect(result.toNumber()).toBeCloseTo(0.1, 3)
  })

  it('handles irregular cashflows', () => {
    const cashflows = [
      { amount: d('-10000'), date: new Date('2022-01-01') },
      { amount: d('2000'),   date: new Date('2022-07-01') },
      { amount: d('10000'),  date: new Date('2023-01-01') },
    ]
    const result = calculateXirr(cashflows)
    // Positive return
    expect(result.toNumber()).toBeGreaterThan(0)
  })

  it('throws with fewer than 2 cashflows', () => {
    expect(() =>
      calculateXirr([{ amount: d('-1000'), date: new Date() }])
    ).toThrow('XIRR vereist minimaal 2 cashflows')
  })

  it('returns a negative XIRR for a losing investment', () => {
    const cashflows = [
      { amount: d('-1000'), date: new Date('2023-01-01') },
      { amount: d('800'),   date: new Date('2024-01-01') },
    ]
    const result = calculateXirr(cashflows)
    expect(result.toNumber()).toBeLessThan(0)
  })
})

// ─── XIRR cashflow-classificatie (gedeeld door asset-, portfolio- en broker-niveau) ──

describe('buildXirrCashflows', () => {
  it('behandelt buy/deposit/cost als uitstroom (negatief)', () => {
    const flows = buildXirrCashflows([
      { transactionType: 'buy',     amount: '1000', transactionDate: '2023-01-01' },
      { transactionType: 'deposit', amount: '500',  transactionDate: '2023-02-01' },
      { transactionType: 'cost',    amount: '10',   transactionDate: '2023-03-01' },
    ])
    expect(flows.every(f => f.amount.lt(0))).toBe(true)
    expect(flows.map(f => f.amount.toNumber())).toEqual([-1000, -500, -10])
  })

  it('behandelt sell/withdrawal/dividend/interest/rental_income als instroom (positief)', () => {
    const flows = buildXirrCashflows([
      { transactionType: 'sell',          amount: '100', transactionDate: '2023-01-01' },
      { transactionType: 'withdrawal',    amount: '50',  transactionDate: '2023-02-01' },
      { transactionType: 'dividend',      amount: '20',  transactionDate: '2023-03-01' },
      { transactionType: 'interest',      amount: '5',   transactionDate: '2023-04-01' },
      { transactionType: 'rental_income', amount: '900', transactionDate: '2023-05-01' },
    ])
    expect(flows.every(f => f.amount.gt(0))).toBe(true)
    expect(flows).toHaveLength(5)
  })

  it('negeert onbekende/niet-XIRR transactietypes', () => {
    const flows = buildXirrCashflows([
      { transactionType: 'valuation_only', amount: '100', transactionDate: '2023-01-01' },
    ])
    expect(flows).toHaveLength(0)
  })
})

describe('hasMinimumXirrPeriod', () => {
  it('is false zonder cashflows', () => {
    expect(hasMinimumXirrPeriod([])).toBe(false)
  })

  it('is false binnen 30 dagen sinds de eerste cashflow', () => {
    const asOf = new Date('2023-01-15')
    const flows = [{ amount: d('-100'), date: new Date('2023-01-01') }]
    expect(hasMinimumXirrPeriod(flows, asOf)).toBe(false)
  })

  it('is true na 30 dagen sinds de eerste cashflow', () => {
    const asOf = new Date('2023-02-01')
    const flows = [{ amount: d('-100'), date: new Date('2023-01-01') }]
    expect(hasMinimumXirrPeriod(flows, asOf)).toBe(true)
  })
})

// ─── Cost Basis (AVCO) ───────────────────────────────────────────────────────

describe('calculateCostBasis', () => {
  it('returns 0 when no transactions', () => {
    expect(calculateCostBasis([]).toNumber()).toBe(0)
  })

  it('calculates cost basis for a single buy', () => {
    const txs = [{ transactionType: 'buy', amount: '1000', quantity: '10' }]
    expect(calculateCostBasis(txs).toNumber()).toBe(100)
  })

  it('averages cost basis after two buys at different prices', () => {
    const txs = [
      { transactionType: 'buy', amount: '1000', quantity: '10' }, // 100/unit
      { transactionType: 'buy', amount: '1200', quantity: '8' },  // 150/unit
    ]
    // total 18 units for 2200 → avg 122.2222
    const result = calculateCostBasis(txs)
    expect(result.toNumber()).toBeCloseTo(122.2222, 2)
  })

  it('adjusts cost basis after a partial sell', () => {
    const txs = [
      { transactionType: 'buy',  amount: '2000', quantity: '20' }, // 100/unit
      { transactionType: 'sell', amount: '500',  quantity: '5' },
    ]
    // After sell: 15 units at 100/unit each
    expect(calculateCostBasis(txs).toNumber()).toBe(100)
  })

  it('returns 0 after selling entire position', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' },
      { transactionType: 'sell', amount: '1000', quantity: '10' },
    ]
    expect(calculateCostBasis(txs).toNumber()).toBe(0)
  })
})

describe('calculateQuantityHeld', () => {
  it('sums buys minus sells', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' },
      { transactionType: 'sell', amount: '200',  quantity: '2' },
    ]
    expect(calculateQuantityHeld(txs).toNumber()).toBe(8)
  })

  it('returns 0 for empty transactions', () => {
    expect(calculateQuantityHeld([]).toNumber()).toBe(0)
  })
})

describe('calculateRealizedGain', () => {
  it('is 0 without any sells', () => {
    const txs = [{ transactionType: 'buy', amount: '1000', quantity: '10' }]
    expect(calculateRealizedGain(txs).toNumber()).toBe(0)
  })

  it('is 0 for an empty position', () => {
    expect(calculateRealizedGain([]).toNumber()).toBe(0)
  })

  it('reflects profit on a fully closed position', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' }, // 100/unit
      { transactionType: 'sell', amount: '1500', quantity: '10' }, // proceeds 1500, cost 1000
    ]
    expect(calculateRealizedGain(txs).toNumber()).toBe(500)
  })

  it('reflects loss on a fully closed position', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' },
      { transactionType: 'sell', amount: '700',  quantity: '10' },
    ]
    expect(calculateRealizedGain(txs).toNumber()).toBe(-300)
  })

  it('uses the AVCO cost at the moment of each sell (partial sells)', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' }, // 100/unit
      { transactionType: 'sell', amount: '600',  quantity: '5' },  // cost 500 → +100 realized
      { transactionType: 'buy',  amount: '900',  quantity: '10' }, // avg now (500+900)/15 = 93.33/unit
      { transactionType: 'sell', amount: '700',  quantity: '5' },  // cost 466.67 → +233.33 realized
    ]
    // total realized ≈ 100 + 233.33 = 333.33
    expect(calculateRealizedGain(txs).toNumber()).toBeCloseTo(333.33, 1)
  })

  it('telt aankoopkosten (fees) mee in de kostprijs', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10', fees: '20' }, // kostprijs 1020
      { transactionType: 'sell', amount: '1100', quantity: '10' },
    ]
    expect(calculateRealizedGain(txs).toNumber()).toBe(80)
  })

  it('resteert op 0 zodra de hele positie na meerdere sells is gesloten', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000', quantity: '10' },
      { transactionType: 'sell', amount: '600',  quantity: '5' },
      { transactionType: 'sell', amount: '700',  quantity: '5' },
    ]
    // AVCO blijft consistent: costBasis van de resterende (0) positie is 0
    calculateRealizedGain(txs) // geen throw, altijd een getal
    expect(calculateCostBasis(txs).toNumber()).toBe(0)
  })
})

// ─── Net Deposit ─────────────────────────────────────────────────────────────

describe('calculateNetDeposit', () => {
  it('sums buys', () => {
    const txs = [
      { transactionType: 'buy', amount: '1000' },
      { transactionType: 'buy', amount: '500' },
    ]
    expect(calculateNetDeposit(txs).toNumber()).toBe(1500)
  })

  it('subtracts sells', () => {
    const txs = [
      { transactionType: 'buy',  amount: '1000' },
      { transactionType: 'sell', amount: '300' },
    ]
    expect(calculateNetDeposit(txs).toNumber()).toBe(700)
  })

  it('ignores dividends and interest', () => {
    const txs = [
      { transactionType: 'buy',      amount: '1000' },
      { transactionType: 'dividend', amount: '50' },
      { transactionType: 'interest', amount: '20' },
    ]
    expect(calculateNetDeposit(txs).toNumber()).toBe(1000)
  })

  it('handles deposits and withdrawals for savings', () => {
    const txs = [
      { transactionType: 'deposit',    amount: '5000' },
      { transactionType: 'withdrawal', amount: '1000' },
    ]
    expect(calculateNetDeposit(txs).toNumber()).toBe(4000)
  })
})

// ─── Current Value ───────────────────────────────────────────────────────────

describe('calculateMarketValue', () => {
  it('multiplies quantity held by current price', () => {
    const txs = [
      { transactionType: 'buy', amount: '1000', quantity: '10' },
      { transactionType: 'sell', amount: '200', quantity: '2' },
    ]
    // 8 units × 150 = 1200
    const result = calculateMarketValue(txs, d('150'))
    expect(result.toNumber()).toBe(1200)
  })

  it('throws on zero or negative price', () => {
    const txs = [{ transactionType: 'buy', amount: '1000', quantity: '10' }]
    expect(() => calculateMarketValue(txs, d('0'))).toThrow()
    expect(() => calculateMarketValue(txs, d('-5'))).toThrow()
  })
})

describe('calculateSavingsBalance', () => {
  it('sums deposits minus withdrawals', () => {
    const txs = [
      { transactionType: 'deposit',    amount: '10000', quantity: null },
      { transactionType: 'withdrawal', amount: '2500',  quantity: null },
    ]
    expect(calculateSavingsBalance(txs).toNumber()).toBe(7500)
  })
})

describe('calculateUnrealizedGain', () => {
  it('returns currentValue minus netDeposit', () => {
    const result = calculateUnrealizedGain(d('1500'), d('1000'))
    expect(result.toNumber()).toBe(500)
  })

  it('returns negative gain when at a loss', () => {
    const result = calculateUnrealizedGain(d('800'), d('1000'))
    expect(result.toNumber()).toBe(-200)
  })
})

// ─── Passive Income ───────────────────────────────────────────────────────────

describe('calculatePassiveIncome', () => {
  const txs = [
    { transactionType: 'dividend',     amount: '200',  transactionDate: '2024-03-15' },
    { transactionType: 'interest',     amount: '50',   transactionDate: '2024-06-30' },
    { transactionType: 'rental_income', amount: '1200', transactionDate: '2024-07-01' },
    { transactionType: 'cost',         amount: '100',  transactionDate: '2024-07-01' },
    { transactionType: 'buy',          amount: '5000', transactionDate: '2024-01-01' },
  ]

  it('sums income types minus costs', () => {
    const result = calculatePassiveIncome(txs)
    // 200 + 50 + 1200 - 100 = 1350
    expect(result.toNumber()).toBe(1350)
  })

  it('ignores buy transactions', () => {
    const result = calculatePassiveIncome(txs)
    expect(result.toNumber()).not.toBe(6350)
  })

  it('filters by date range', () => {
    const result = calculatePassiveIncome(txs, '2024-06-01', '2024-12-31')
    // 50 + 1200 - 100 = 1150
    expect(result.toNumber()).toBe(1150)
  })
})

// ─── Allocation ───────────────────────────────────────────────────────────────

describe('calculateAllocation', () => {
  it('returns empty array for zero total', () => {
    expect(calculateAllocation([])).toEqual([])
  })

  it('calculates percentages correctly', () => {
    const assets = [
      { assetType: 'stock_etf',  value: d('6000') },
      { assetType: 'real_estate', value: d('4000') },
    ]
    const result = calculateAllocation(assets)
    const stocks = result.find(r => r.assetType === 'stock_etf')!
    const re = result.find(r => r.assetType === 'real_estate')!
    expect(stocks.percentage.toNumber()).toBe(60)
    expect(re.percentage.toNumber()).toBe(40)
  })

  it('aggregates multiple assets of the same type', () => {
    const assets = [
      { assetType: 'stock_etf', value: d('3000') },
      { assetType: 'stock_etf', value: d('2000') },
      { assetType: 'crypto',    value: d('5000') },
    ]
    const result = calculateAllocation(assets)
    const stocks = result.find(r => r.assetType === 'stock_etf')!
    expect(stocks.value.toNumber()).toBe(5000)
    expect(stocks.percentage.toNumber()).toBe(50)
  })
})

// ─── Real Estate ─────────────────────────────────────────────────────────────

describe('calculateGrossRentalYield', () => {
  it('divides annual rent by property value', () => {
    // 12,000 / 300,000 = 4%
    const result = calculateGrossRentalYield(d('12000'), d('300000'))
    expect(result.toNumber()).toBeCloseTo(0.04, 4)
  })

  it('throws for zero property value', () => {
    expect(() => calculateGrossRentalYield(d('12000'), d('0'))).toThrow()
  })
})

describe('calculateNetRentalYield', () => {
  it('subtracts costs before dividing', () => {
    // (12000 - 3000) / 300000 = 3%
    const result = calculateNetRentalYield(d('12000'), d('3000'), d('300000'))
    expect(result.toNumber()).toBeCloseTo(0.03, 4)
  })
})

describe('calculateCashOnCash', () => {
  it('divides net cashflow by initial investment', () => {
    // 5000 / 50000 = 10%
    const result = calculateCashOnCash(d('5000'), d('50000'))
    expect(result.toNumber()).toBeCloseTo(0.1, 4)
  })

  it('throws for zero initial investment', () => {
    expect(() => calculateCashOnCash(d('5000'), d('0'))).toThrow()
  })
})

describe('calculateLtv', () => {
  it('divides mortgage by property value', () => {
    // 225,000 / 300,000 = 75%
    const result = calculateLtv(d('225000'), d('300000'))
    expect(result.toNumber()).toBeCloseTo(0.75, 4)
  })
})

describe('calculateEquity', () => {
  it('subtracts mortgage from property value', () => {
    const result = calculateEquity(d('350000'), d('225000'))
    expect(result.toNumber()).toBe(125000)
  })
})

// ─── Net Worth ────────────────────────────────────────────────────────────────

describe('calculateNetWorth', () => {
  it('sums assets minus liabilities', () => {
    const assets = [
      { value: d('300000'), liability: d('200000') },
      { value: d('50000'),  liability: d('0') },
      { value: d('10000'),  liability: d('0') },
    ]
    // 100000 + 50000 + 10000 = 160000
    expect(calculateNetWorth(assets).toNumber()).toBe(160000)
  })

  it('returns 0 for empty assets', () => {
    expect(calculateNetWorth([]).toNumber()).toBe(0)
  })
})

// ─── TWR ─────────────────────────────────────────────────────────────────────

describe('calculateTwr', () => {
  it('calculates TWR for a single period', () => {
    // end=110, cashflow=0, start=100 → HPR = 10% → TWR = 10%
    const periods = [{ startValue: d('100'), endValue: d('110'), cashflow: d('0') }]
    const result = calculateTwr(periods)
    expect(result.toNumber()).toBeCloseTo(0.1, 5)
  })

  it('links multiple sub-period returns', () => {
    // Period 1: start=100, end=110, cf=0 → HPR=10%
    // Period 2: start=110, end=121, cf=0 → HPR=10%
    // TWR = 1.1 * 1.1 - 1 = 21%
    const periods = [
      { startValue: d('100'), endValue: d('110'), cashflow: d('0') },
      { startValue: d('110'), endValue: d('121'), cashflow: d('0') },
    ]
    const result = calculateTwr(periods)
    expect(result.toNumber()).toBeCloseTo(0.21, 5)
  })

  it('throws for empty periods', () => {
    expect(() => calculateTwr([])).toThrow()
  })

  it('throws for zero start value', () => {
    const periods = [{ startValue: d('0'), endValue: d('100'), cashflow: d('0') }]
    expect(() => calculateTwr(periods)).toThrow()
  })
})

describe('calculateAnnualReturn', () => {
  // Periode van 100 dagen, zodat cashflow-gewichten (dagen-over/totaal) op
  // schone breuken uitkomen i.p.v. afhankelijk te zijn van kalendermaanden.
  const periodStart = new Date(2023, 0, 1)
  const periodEnd   = new Date(periodStart.getTime() + 100 * 24 * 60 * 60 * 1000)
  const daysAfterStart = (n: number) => new Date(periodStart.getTime() + n * 24 * 60 * 60 * 1000)

  it('berekent een positief rendement zonder tussentijdse cashflow', () => {
    // start=1000, eind=1100, geen cashflow → +100 EUR, +10%
    const { returnAmount, returnPct } = calculateAnnualReturn(d('1000'), d('1100'), periodStart, periodEnd, [])
    expect(returnAmount.toNumber()).toBe(100)
    expect(returnPct?.toNumber()).toBeCloseTo(0.1, 5)
  })

  it('weegt een cashflow naar rato van het resterende deel van de periode (Modified Dietz)', () => {
    // start=1000, cashflow van +500 precies op de helft van de periode (dag 50 van 100,
    // gewicht 0.5), eind=1600 → returnAmount = 1600-1000-500 = 100.
    // Kapitaalbasis = 1000 + 500*0.5 = 1250 → returnPct = 100/1250 = 8%.
    // (Een naïeve (eind-cashflow)/start-formule zou hier 10% geven — te hoog,
    // omdat die de cashflow behandelt alsof die pas op het ÉÍND plaatsvond.)
    const cashflows = [{ amount: d('500'), date: daysAfterStart(50) }]
    const { returnAmount, returnPct } = calculateAnnualReturn(d('1000'), d('1600'), periodStart, periodEnd, cashflows)
    expect(returnAmount.toNumber()).toBe(100)
    expect(returnPct?.toNumber()).toBeCloseTo(0.08, 5)
  })

  it('weegt eenzelfde cashflow zwaarder naarmate die vroeger in de periode valt', () => {
    // Zelfde bedragen, alleen het moment van de cashflow verschilt.
    const early = calculateAnnualReturn(d('1000'), d('1600'), periodStart, periodEnd, [{ amount: d('500'), date: daysAfterStart(10) }])
    const late  = calculateAnnualReturn(d('1000'), d('1600'), periodStart, periodEnd, [{ amount: d('500'), date: daysAfterStart(90) }])
    // returnAmount is timing-onafhankelijk: in beide gevallen exact gelijk
    expect(early.returnAmount.toNumber()).toBe(late.returnAmount.toNumber())
    // maar een vroege cashflow drukt het procentuele rendement sterker (grotere kapitaalbasis)
    expect(early.returnPct!.toNumber()).toBeLessThan(late.returnPct!.toNumber())
  })

  it('kan een returnPct berekenen ook als de portefeuille bij aanvang €0 waard was (eerste jaar)', () => {
    // Startjaar: portefeuille begint op 0, eerste aankoop van 1000 op dag 0, eind 1050
    const cashflows = [{ amount: d('1000'), date: periodStart }]
    const { returnAmount, returnPct } = calculateAnnualReturn(d('0'), d('1050'), periodStart, periodEnd, cashflows)
    expect(returnAmount.toNumber()).toBe(50)
    // kapitaalbasis = 0 + 1000*1.0 (cashflow op dag 0 → volledig gewicht) = 1000
    expect(returnPct?.toNumber()).toBeCloseTo(0.05, 5)
  })

  it('is null voor returnPct als de tijdgewogen kapitaalbasis €0 is', () => {
    const { returnAmount, returnPct } = calculateAnnualReturn(d('0'), d('0'), periodStart, periodEnd, [])
    expect(returnAmount.toNumber()).toBe(0)
    expect(returnPct).toBeNull()
  })

  it('geeft een negatief rendement bij waardedaling', () => {
    const { returnAmount, returnPct } = calculateAnnualReturn(d('1000'), d('900'), periodStart, periodEnd, [])
    expect(returnAmount.toNumber()).toBe(-100)
    expect(returnPct?.toNumber()).toBeCloseTo(-0.1, 5)
  })

  it('annualiseert niet — een korte periode met +5% blijft +5%, niet omgerekend naar een jaartarief', () => {
    // In tegenstelling tot XIRR: dit is een holding-period-rendement, geen jaarlijks tarief
    const { returnPct } = calculateAnnualReturn(d('1000'), d('1050'), periodStart, periodEnd, [])
    expect(returnPct?.toNumber()).toBeCloseTo(0.05, 5)
  })

  it('geeft geen returnPct als vrijwel alle inleg pas vlak voor periodEnd valt (dunne tijdgewogen kapitaalbasis)', () => {
    // Startjaar (start=0): 1000 ingelegd op dag 95 van 100 (gewicht 0.05) → tijdgewogen
    // basis = 50. Een bescheiden koerswinst van 20 in die laatste dagen zou anders
    // 20/50 = 40% opleveren — een percentage dat niets zegt over het jaar als geheel.
    const cashflows = [{ amount: d('1000'), date: daysAfterStart(95) }]
    const { returnAmount, returnPct } = calculateAnnualReturn(d('0'), d('1020'), periodStart, periodEnd, cashflows)
    expect(returnAmount.toNumber()).toBe(20)
    expect(returnPct).toBeNull()
  })
})

// ─── Benchmark ───────────────────────────────────────────────────────────────

describe('calculateExcessReturn', () => {
  it('returns portfolio minus benchmark', () => {
    // 12% portfolio - 8% benchmark = 4% alpha
    const result = calculateExcessReturn(d('0.12'), d('0.08'))
    expect(result.toNumber()).toBeCloseTo(0.04, 6)
  })

  it('returns negative alpha when underperforming', () => {
    const result = calculateExcessReturn(d('0.05'), d('0.10'))
    expect(result.toNumber()).toBeCloseTo(-0.05, 6)
  })
})

// ─── Net Worth Series ─────────────────────────────────────────────────────────

describe('buildNetWorthSeries', () => {
  it('returns sorted time series of net worth', () => {
    const valuations = [
      { assetId: 'a1', date: '2024-03-01', value: d('300000'), liability: d('220000') },
      { assetId: 'a2', date: '2024-03-01', value: d('50000'),  liability: d('0') },
      { assetId: 'a1', date: '2024-04-01', value: d('305000'), liability: d('219000') },
      { assetId: 'a2', date: '2024-04-01', value: d('52000'),  liability: d('0') },
    ]
    const series = buildNetWorthSeries(valuations)
    expect(series).toHaveLength(2)
    // 2024-03-01: (300000-220000) + 50000 = 130000
    expect(series[0].date).toBe('2024-03-01')
    expect(series[0].netWorth.toNumber()).toBe(130000)
    // 2024-04-01: (305000-219000) + 52000 = 138000
    expect(series[1].date).toBe('2024-04-01')
    expect(series[1].netWorth.toNumber()).toBe(138000)
  })

  it('returns empty array for empty input', () => {
    expect(buildNetWorthSeries([])).toEqual([])
  })
})

// ─── buildSimpleEntryMonthlySeries ─────────────────────────────────────────

describe('buildSimpleEntryMonthlySeries', () => {
  const asOf = new Date('2026-03-15')

  it('forward-fills each broker into every month up to asOf', () => {
    const entries = [
      { broker: 'Bitvavo', invested: '1000', currentValue: '1200', entryDate: '2026-01-10' },
    ]
    const series = buildSimpleEntryMonthlySeries(entries, asOf)
    expect(series.map(p => p.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(series.every(p => p.invested.toNumber() === 1000 && p.currentValue.toNumber() === 1200)).toBe(true)
  })

  it('sums the latest entry per broker at each month', () => {
    const entries = [
      { broker: 'Bitvavo', invested: '1000', currentValue: '1100', entryDate: '2026-01-10' },
      { broker: 'Binance', invested: '500', currentValue: '400', entryDate: '2026-02-05' },
      { broker: 'Bitvavo', invested: '1500', currentValue: '1800', entryDate: '2026-03-01' },
    ]
    const series = buildSimpleEntryMonthlySeries(entries, asOf)
    const jan = series.find(p => p.month === '2026-01')!
    const feb = series.find(p => p.month === '2026-02')!
    const mar = series.find(p => p.month === '2026-03')!
    // Jan: alleen Bitvavo (Binance nog geen invoer)
    expect(jan.invested.toNumber()).toBe(1000)
    expect(jan.currentValue.toNumber()).toBe(1100)
    // Feb: Bitvavo (jan-waarde) + Binance
    expect(feb.invested.toNumber()).toBe(1500)
    expect(feb.currentValue.toNumber()).toBe(1500)
    // Mar: Bitvavo (nieuwe waarde) + Binance
    expect(mar.invested.toNumber()).toBe(2000)
    expect(mar.currentValue.toNumber()).toBe(2200)
  })

  it('returns empty array for empty input', () => {
    expect(buildSimpleEntryMonthlySeries([], asOf)).toEqual([])
  })
})

// ─── buildSingleValueMonthlySeries ─────────────────────────────────────────

describe('buildSingleValueMonthlySeries', () => {
  const asOf = new Date('2026-03-15')

  it('sums the latest value per group at each month, forward-filled', () => {
    const entries = [
      { group: 'ING', value: '10000', entryDate: '2026-01-10' },
      { group: 'Rabobank', value: '5000', entryDate: '2026-02-05' },
      { group: 'ING', value: '10500', entryDate: '2026-03-01' },
    ]
    const series = buildSingleValueMonthlySeries(entries, asOf)
    expect(series.map(p => p.month)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(series.find(p => p.month === '2026-01')!.value.toNumber()).toBe(10000)
    expect(series.find(p => p.month === '2026-02')!.value.toNumber()).toBe(15000)
    expect(series.find(p => p.month === '2026-03')!.value.toNumber()).toBe(15500)
  })

  it('returns empty array for empty input', () => {
    expect(buildSingleValueMonthlySeries([], asOf)).toEqual([])
  })
})

// ─── annualizeAmount ────────────────────────────────────────────────────────

describe('annualizeAmount', () => {
  it('multiplies monthly amounts by 12', () => {
    expect(annualizeAmount(d('100'), 'monthly').toNumber()).toBe(1200)
  })

  it('multiplies quarterly amounts by 4', () => {
    expect(annualizeAmount(d('300'), 'quarterly').toNumber()).toBe(1200)
  })

  it('multiplies four-weekly amounts by 13', () => {
    expect(annualizeAmount(d('100'), 'four_weekly').toNumber()).toBe(1300)
  })

  it('leaves yearly amounts unchanged', () => {
    expect(annualizeAmount(d('1200'), 'yearly').toNumber()).toBe(1200)
  })

  it('throws on an unknown frequency', () => {
    // @ts-expect-error - testing invalid input from an untyped boundary (e.g. DB row)
    expect(() => annualizeAmount(d('100'), 'weekly')).toThrow()
  })
})

// ─── calculateRecurringTotals ───────────────────────────────────────────────

describe('calculateRecurringTotals', () => {
  it('sums income and expenses across mixed frequencies', () => {
    const items = [
      { itemType: 'income' as const, amount: '3500', frequency: 'monthly' as const, isActive: true, isShared: false },
      { itemType: 'expense' as const, amount: '1200', frequency: 'monthly' as const, isActive: true, isShared: false },
      { itemType: 'expense' as const, amount: '600', frequency: 'quarterly' as const, isActive: true, isShared: false },
      { itemType: 'expense' as const, amount: '2400', frequency: 'yearly' as const, isActive: true, isShared: false },
    ]
    const totals = calculateRecurringTotals(items)
    expect(totals.annualIncome.toNumber()).toBe(42000)
    expect(totals.annualExpenses.toNumber()).toBe(1200 * 12 + 600 * 4 + 2400)
    expect(totals.netAnnualCashflow.toNumber()).toBe(totals.annualIncome.toNumber() - totals.annualExpenses.toNumber())
    expect(totals.monthlyIncome.toNumber()).toBe(3500)
  })

  it('ignores inactive items', () => {
    const items = [
      { itemType: 'expense' as const, amount: '1000', frequency: 'monthly' as const, isActive: false, isShared: false },
    ]
    const totals = calculateRecurringTotals(items)
    expect(totals.annualExpenses.toNumber()).toBe(0)
  })

  it('returns zero totals for empty input', () => {
    const totals = calculateRecurringTotals([])
    expect(totals.netAnnualCashflow.toNumber()).toBe(0)
  })

  it('halves shared items to the own-share amount', () => {
    const items = [
      { itemType: 'expense' as const, amount: '1000', frequency: 'monthly' as const, isActive: true, isShared: true },
    ]
    const totals = calculateRecurringTotals(items)
    expect(totals.annualExpenses.toNumber()).toBe(1000 * 12 / 2)
    expect(totals.monthlyExpenses.toNumber()).toBe(500)
  })
})

// ─── calculateOneTimeExpensesTotal ──────────────────────────────────────────

describe('calculateOneTimeExpensesTotal', () => {
  it('sums full amounts for non-shared expenses', () => {
    const total = calculateOneTimeExpensesTotal([
      { amount: '500', isShared: false },
      { amount: '250', isShared: false },
    ])
    expect(total.toNumber()).toBe(750)
  })

  it('halves shared expenses to the own-share amount', () => {
    const total = calculateOneTimeExpensesTotal([
      { amount: '1000', isShared: true },
      { amount: '200', isShared: false },
    ])
    expect(total.toNumber()).toBe(700)
  })

  it('returns zero for empty input', () => {
    const total = calculateOneTimeExpensesTotal([])
    expect(total.toNumber()).toBe(0)
  })
})

// ─── calculatePercentChange ─────────────────────────────────────────────────

describe('calculatePercentChange', () => {
  it('returns the relative change as a decimal', () => {
    const change = calculatePercentChange(d(1150), d(1000))
    expect(change?.toNumber()).toBeCloseTo(0.15)
  })

  it('returns a negative decimal when current is lower than previous', () => {
    const change = calculatePercentChange(d(800), d(1000))
    expect(change?.toNumber()).toBeCloseTo(-0.2)
  })

  it('returns null when there is no previous amount to compare against', () => {
    expect(calculatePercentChange(d(500), d(0))).toBeNull()
  })
})

// ─── calculateSavingsRate ───────────────────────────────────────────────────

describe('calculateSavingsRate', () => {
  it('returns the surplus as a fraction of income', () => {
    const rate = calculateSavingsRate(d(700), d(3500))
    expect(rate?.toNumber()).toBeCloseTo(0.2)
  })

  it('returns a negative decimal when spending exceeds income', () => {
    const rate = calculateSavingsRate(d(-200), d(3500))
    expect(rate?.toNumber()).toBeCloseTo(-200 / 3500)
  })

  it('returns null when there is no income to compare against', () => {
    expect(calculateSavingsRate(d(0), d(0))).toBeNull()
  })
})

// ─── calculateBufferMonths / classifyBufferMonths ──────────────────────────

describe('calculateBufferMonths', () => {
  it('divides liquid savings by monthly expenses', () => {
    const months = calculateBufferMonths(d(9000), d(1800))
    expect(months?.toNumber()).toBe(5)
  })

  it('returns null when there are no expenses to compare against', () => {
    expect(calculateBufferMonths(d(9000), d(0))).toBeNull()
  })
})

describe('classifyBufferMonths', () => {
  it('labels less than 3 months as krap', () => {
    expect(classifyBufferMonths(d(2.9))).toBe('krap')
  })

  it('labels 3 to 6 months as gezond', () => {
    expect(classifyBufferMonths(d(3))).toBe('gezond')
    expect(classifyBufferMonths(d(6))).toBe('gezond')
  })

  it('labels more than 6 months as ruim', () => {
    expect(classifyBufferMonths(d(6.1))).toBe('ruim')
  })
})

// ─── calculatePassiveIncomeCoverage ─────────────────────────────────────────

describe('calculatePassiveIncomeCoverage', () => {
  it('returns passive income as a fraction of monthly expenses', () => {
    const coverage = calculatePassiveIncomeCoverage(d(540), d(1800))
    expect(coverage?.toNumber()).toBeCloseTo(0.3)
  })

  it('returns null when there are no expenses to compare against', () => {
    expect(calculatePassiveIncomeCoverage(d(540), d(0))).toBeNull()
  })
})

// ─── determineFinancialHealthSignal ─────────────────────────────────────────

describe('determineFinancialHealthSignal', () => {
  it('flags a krap buffer as the highest-priority warning', () => {
    const signal = determineFinancialHealthSignal(d(0.2), d(1.5))
    expect(signal).toEqual({ level: 'warning', reason: 'buffer_krap', bufferMonths: d(1.5) })
  })

  it('flags a negative savings rate when the buffer is not krap', () => {
    const signal = determineFinancialHealthSignal(d(-0.1), d(5))
    expect(signal).toEqual({ level: 'warning', reason: 'savings_rate_negative', savingsRate: d(-0.1) })
  })

  it('prioritizes a krap buffer over a negative savings rate', () => {
    const signal = determineFinancialHealthSignal(d(-0.1), d(1))
    expect(signal).toEqual({ level: 'warning', reason: 'buffer_krap', bufferMonths: d(1) })
  })

  it('returns a positive signal when savings rate and buffer are both healthy', () => {
    const signal = determineFinancialHealthSignal(d(0.2), d(5))
    expect(signal).toEqual({ level: 'positive', savingsRate: d(0.2), bufferMonths: d(5) })
  })

  it('returns a positive signal with only savings rate when buffer data is missing', () => {
    const signal = determineFinancialHealthSignal(d(0.2), null)
    expect(signal).toEqual({ level: 'positive', savingsRate: d(0.2), bufferMonths: null })
  })

  it('returns a positive signal with only buffer months when income data is missing', () => {
    const signal = determineFinancialHealthSignal(null, d(5))
    expect(signal).toEqual({ level: 'positive', savingsRate: null, bufferMonths: d(5) })
  })

  it('returns null when there is no data at all', () => {
    expect(determineFinancialHealthSignal(null, null)).toBeNull()
  })
})

// ─── calculateMortgageAmortizationForYear ───────────────────────────────────

describe('calculateMortgageAmortizationForYear', () => {
  it('interest_only: full year of interest on the unchanged balance, no principal', () => {
    const terms: MortgageTerms = {
      type: 'interest_only',
      originalAmount: d(300000),
      annualInterestRate: d(0.04),
      startDate: new Date(2020, 0, 1),
      termMonths: 240,
    }
    const result = calculateMortgageAmortizationForYear(terms, 2021)
    expect(result.interestPaid.toNumber()).toBeCloseTo(12000)
    expect(result.principalRepaid.toNumber()).toBe(0)
  })

  it('linear: principal repayment is constant every month regardless of year', () => {
    const terms: MortgageTerms = {
      type: 'linear',
      originalAmount: d(120000),
      annualInterestRate: d(0.03),
      startDate: new Date(2020, 0, 1),
      termMonths: 120, // 10 years, 1000/month principal
    }
    const year1 = calculateMortgageAmortizationForYear(terms, 2020)
    const year2 = calculateMortgageAmortizationForYear(terms, 2021)
    expect(year1.principalRepaid.toNumber()).toBeCloseTo(12000)
    expect(year2.principalRepaid.toNumber()).toBeCloseTo(12000)
    // Balance declines over the year, so interest paid should drop year over year.
    expect(year2.interestPaid.toNumber()).toBeLessThan(year1.interestPaid.toNumber())
  })

  it('annuity: interest + principal sums to the constant monthly payment each full year', () => {
    const terms: MortgageTerms = {
      type: 'annuity',
      originalAmount: d(250000),
      annualInterestRate: d(0.035),
      startDate: new Date(2020, 0, 1),
      termMonths: 360, // 30 years
    }
    const year1 = calculateMortgageAmortizationForYear(terms, 2020)
    const monthlyPayment = year1.interestPaid.plus(year1.principalRepaid).dividedBy(12)
    const year5 = calculateMortgageAmortizationForYear(terms, 2024)
    // Annuity: total payment (rente + aflossing) stays constant, but the
    // interest/principal split shifts toward principal over time.
    expect(year5.interestPaid.plus(year5.principalRepaid).dividedBy(12).toNumber()).toBeCloseTo(monthlyPayment.toNumber(), 2)
    expect(year5.interestPaid.toNumber()).toBeLessThan(year1.interestPaid.toNumber())
    expect(year5.principalRepaid.toNumber()).toBeGreaterThan(year1.principalRepaid.toNumber())
  })

  it('returns zero for a year entirely before the mortgage started', () => {
    const terms: MortgageTerms = {
      type: 'annuity',
      originalAmount: d(250000),
      annualInterestRate: d(0.035),
      startDate: new Date(2020, 0, 1),
      termMonths: 360,
    }
    const result = calculateMortgageAmortizationForYear(terms, 2019)
    expect(result.interestPaid.toNumber()).toBe(0)
    expect(result.principalRepaid.toNumber()).toBe(0)
  })

  it('returns zero for a year entirely after the mortgage is fully repaid', () => {
    const terms: MortgageTerms = {
      type: 'linear',
      originalAmount: d(120000),
      annualInterestRate: d(0.03),
      startDate: new Date(2000, 0, 1),
      termMonths: 120,
    }
    const result = calculateMortgageAmortizationForYear(terms, 2020)
    expect(result.interestPaid.toNumber()).toBe(0)
    expect(result.principalRepaid.toNumber()).toBe(0)
  })

  it('throws on a non-positive original amount', () => {
    const terms: MortgageTerms = {
      type: 'linear', originalAmount: d(0), annualInterestRate: d(0.03),
      startDate: new Date(2020, 0, 1), termMonths: 120,
    }
    expect(() => calculateMortgageAmortizationForYear(terms, 2020)).toThrow()
  })

  it('throws on a non-positive term', () => {
    const terms: MortgageTerms = {
      type: 'linear', originalAmount: d(120000), annualInterestRate: d(0.03),
      startDate: new Date(2020, 0, 1), termMonths: 0,
    }
    expect(() => calculateMortgageAmortizationForYear(terms, 2020)).toThrow()
  })

  it('throws on a negative interest rate', () => {
    const terms: MortgageTerms = {
      type: 'linear', originalAmount: d(120000), annualInterestRate: d(-0.01),
      startDate: new Date(2020, 0, 1), termMonths: 120,
    }
    expect(() => calculateMortgageAmortizationForYear(terms, 2020)).toThrow()
  })
})

// ─── calculateRentalPeriodCashflowForYear ────────────────────────────────────

describe('calculateRentalPeriodCashflowForYear', () => {
  it('counts a full-year monthly period as 12 months', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(1000), frequency: 'monthly', startDate: '2024-01-01', endDate: null },
    ]
    const result = calculateRentalPeriodCashflowForYear(periods, 2024)
    expect(result.income.toNumber()).toBe(12000)
    expect(result.costs.toNumber()).toBe(0)
  })

  it('prorates a period that starts mid-year', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(1000), frequency: 'monthly', startDate: '2024-07-01', endDate: null },
    ]
    const result = calculateRentalPeriodCashflowForYear(periods, 2024)
    // juli t/m december = 6 maanden
    expect(result.income.toNumber()).toBe(6000)
  })

  it('prorates a period that ends mid-year', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'cost', amount: d(150), frequency: 'monthly', startDate: '2023-01-01', endDate: '2024-03-31' },
    ]
    const result = calculateRentalPeriodCashflowForYear(periods, 2024)
    // januari t/m maart = 3 maanden
    expect(result.costs.toNumber()).toBe(450)
  })

  it('excludes a period entirely outside the target year', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(1000), frequency: 'monthly', startDate: '2020-01-01', endDate: '2020-12-31' },
    ]
    const result = calculateRentalPeriodCashflowForYear(periods, 2024)
    expect(result.income.toNumber()).toBe(0)
  })

  it('counts a "once" period fully in its own year, not others', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'cost', amount: d(2500), frequency: 'once', startDate: '2024-05-15', endDate: null },
    ]
    expect(calculateRentalPeriodCashflowForYear(periods, 2024).costs.toNumber()).toBe(2500)
    expect(calculateRentalPeriodCashflowForYear(periods, 2025).costs.toNumber()).toBe(0)
  })

  it('sums income and costs from multiple overlapping periods', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(1200), frequency: 'monthly', startDate: '2023-06-01', endDate: null },
      { cashflowType: 'cost', amount: d(180), frequency: 'monthly', startDate: '2024-01-01', endDate: null },
    ]
    const result = calculateRentalPeriodCashflowForYear(periods, 2024)
    expect(result.income.toNumber()).toBe(14400)
    expect(result.costs.toNumber()).toBe(2160)
  })

  it('throws on a negative amount', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(-100), frequency: 'monthly', startDate: '2024-01-01', endDate: null },
    ]
    expect(() => calculateRentalPeriodCashflowForYear(periods, 2024)).toThrow()
  })

  it('throws on an unknown frequency', () => {
    const periods: RentalPeriodInput[] = [
      { cashflowType: 'rental_income', amount: d(100), frequency: 'weekly' as RentalPeriodInput['frequency'], startDate: '2024-01-01', endDate: null },
    ]
    expect(() => calculateRentalPeriodCashflowForYear(periods, 2024)).toThrow()
  })
})

// ─── lastNMonths / buildMonthlyCashflowSeries ────────────────────────────────

describe('lastNMonths', () => {
  it('returns n months ending at asOf, oldest first', () => {
    const months = lastNMonths(3, new Date(2024, 2, 15)) // 15 maart 2024
    expect(months).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('handles a year boundary', () => {
    const months = lastNMonths(3, new Date(2024, 0, 10)) // 10 januari 2024
    expect(months).toEqual(['2023-11', '2023-12', '2024-01'])
  })
})

describe('buildMonthlyCashflowSeries', () => {
  const months3 = ['2024-01', '2024-02', '2024-03']

  it('applies a flat monthly income item across all months', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'income', frequency: 'monthly', isShared: false, amounts: [{ amount: d(3000).toString(), effectiveDate: '2023-01-01' }] },
    ]
    const result = buildMonthlyCashflowSeries(items, [], months3)
    for (const point of result) {
      expect(point.income.toNumber()).toBe(3000)
      expect(point.expenses.toNumber()).toBe(0)
    }
  })

  it('uses the amount that was effective in each month when it changes mid-range', () => {
    const items: RecurringItemHistoryInput[] = [
      {
        itemType: 'expense', frequency: 'monthly', isShared: false,
        amounts: [
          { amount: d(100).toString(), effectiveDate: '2023-06-01' },
          { amount: d(120).toString(), effectiveDate: '2024-02-01' },
        ],
      },
    ]
    const result = buildMonthlyCashflowSeries(items, [], months3)
    expect(result.find(p => p.month === '2024-01')!.expenses.toNumber()).toBe(100)
    expect(result.find(p => p.month === '2024-02')!.expenses.toNumber()).toBe(120)
    expect(result.find(p => p.month === '2024-03')!.expenses.toNumber()).toBe(120)
  })

  it('contributes nothing for months before the item existed', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'income', frequency: 'monthly', isShared: false, amounts: [{ amount: d(500).toString(), effectiveDate: '2024-02-15' }] },
    ]
    const result = buildMonthlyCashflowSeries(items, [], months3)
    expect(result.find(p => p.month === '2024-01')!.income.toNumber()).toBe(0)
    expect(result.find(p => p.month === '2024-02')!.income.toNumber()).toBe(500)
    expect(result.find(p => p.month === '2024-03')!.income.toNumber()).toBe(500)
  })

  it('halves a shared recurring item', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'expense', frequency: 'monthly', isShared: true, amounts: [{ amount: d(200).toString(), effectiveDate: '2023-01-01' }] },
    ]
    const result = buildMonthlyCashflowSeries(items, [], months3)
    expect(result[0].expenses.toNumber()).toBe(100)
  })

  it('adds one-time expenses only in their own month, halved when shared', () => {
    const expenses: MonthlyOneTimeExpenseInput[] = [
      { amount: d(1000).toString(), expenseDate: '2024-02-10', isShared: false },
      { amount: d(400).toString(), expenseDate: '2024-02-20', isShared: true },
    ]
    const result = buildMonthlyCashflowSeries([], expenses, months3)
    expect(result.find(p => p.month === '2024-01')!.expenses.toNumber()).toBe(0)
    expect(result.find(p => p.month === '2024-02')!.expenses.toNumber()).toBe(1200)
    expect(result.find(p => p.month === '2024-03')!.expenses.toNumber()).toBe(0)
  })

  it('computes net as income minus expenses', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'income', frequency: 'monthly', isShared: false, amounts: [{ amount: d(3000).toString(), effectiveDate: '2023-01-01' }] },
      { itemType: 'expense', frequency: 'monthly', isShared: false, amounts: [{ amount: d(3500).toString(), effectiveDate: '2023-01-01' }] },
    ]
    const result = buildMonthlyCashflowSeries(items, [], ['2024-01'])
    expect(result[0].net.toNumber()).toBe(-500)
  })

  it('throws on an unknown itemType', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'savings' as RecurringItemHistoryInput['itemType'], frequency: 'monthly', isShared: false, amounts: [{ amount: d(100).toString(), effectiveDate: '2023-01-01' }] },
    ]
    expect(() => buildMonthlyCashflowSeries(items, [], ['2024-01'])).toThrow()
  })

  it('throws on an unknown frequency', () => {
    const items: RecurringItemHistoryInput[] = [
      { itemType: 'income', frequency: 'weekly' as RecurringItemHistoryInput['frequency'], isShared: false, amounts: [{ amount: d(100).toString(), effectiveDate: '2023-01-01' }] },
    ]
    expect(() => buildMonthlyCashflowSeries(items, [], ['2024-01'])).toThrow()
  })
})
