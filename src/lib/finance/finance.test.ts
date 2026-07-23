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
