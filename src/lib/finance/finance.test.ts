import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { calculateXirr } from './xirr'
import { calculateCostBasis, calculateQuantityHeld } from './cost-basis'
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
