import { Injectable } from '@nestjs/common';

export enum Currency {
  MKD = 'MKD',
  EUR = 'EUR',
}

export enum Market {
  MK = 'MK', // North Macedonia
  KS = 'KS', // Kosovo
}

@Injectable()
export class CurrencyService {
  // Fixed platform reference exchange rate: 1 EUR = 61.5 MKD
  private readonly EXCHANGE_RATE = 61.5;

  /**
   * Get the exchange rate (fixed platform rate)
   */
  getExchangeRate(): number {
    return this.EXCHANGE_RATE;
  }

  /**
   * Get base currency for a market
   * MK sellers list in MKD, KS sellers list in EUR
   */
  getBaseCurrencyForMarket(market: Market): Currency {
    return market === Market.MK ? Currency.MKD : Currency.EUR;
  }

  /**
   * Convert amount from one currency to another using the fixed exchange rate
   */
  convert(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): number {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    if (fromCurrency === Currency.EUR && toCurrency === Currency.MKD) {
      // EUR to MKD: multiply by exchange rate
      return amount * this.EXCHANGE_RATE;
    }

    if (fromCurrency === Currency.MKD && toCurrency === Currency.EUR) {
      // MKD to EUR: divide by exchange rate
      return amount / this.EXCHANGE_RATE;
    }

    throw new Error(`Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`);
  }

  /**
   * Round amount according to currency rules:
   * - MKD: no decimals (round to nearest integer)
   * - EUR: 2 decimals
   */
  round(amount: number, currency: Currency): number {
    if (currency === Currency.MKD) {
      return Math.round(amount);
    }

    if (currency === Currency.EUR) {
      return Math.round(amount * 100) / 100;
    }

    throw new Error(`Unsupported currency: ${currency}`);
  }

  /**
   * Convert and round in one operation
   */
  convertAndRound(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): number {
    const converted = this.convert(amount, fromCurrency, toCurrency);
    return this.round(converted, toCurrency);
  }

  /**
   * Determine buyer currency from shipping address country
   * North Macedonia -> MKD, Kosovo -> EUR
   */
  getBuyerCurrencyFromCountry(country: string): Currency {
    const normalizedCountry = country.toLowerCase().trim();
    
    if (
      normalizedCountry === 'north macedonia' ||
      normalizedCountry === 'macedonia' ||
      normalizedCountry === 'mk'
    ) {
      return Currency.MKD;
    }

    if (
      normalizedCountry === 'kosovo' ||
      normalizedCountry === 'ks'
    ) {
      return Currency.EUR;
    }

    // Default to MKD if country not recognized
    return Currency.MKD;
  }
}

