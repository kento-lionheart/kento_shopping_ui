const currencyFormatter = new Intl.NumberFormat('vi-VN');

/** 1 coin = 1 VND (see CLAUDE.md). Amounts come from the API as numbers. */
export function formatCoins(amount: number): string {
  return `${currencyFormatter.format(amount)} coins`;
}
