export function parseAmountInput(value: unknown) {
  if (typeof value === "number") {
    return { amount: value, currency: undefined as "USD" | "ARS" | undefined };
  }

  const rawValue = String(value ?? "").trim();
  const currency = /usd/i.test(rawValue) ? "USD" : /ars/i.test(rawValue) ? "ARS" : undefined;
  const numericPortion = rawValue
    .replace(/usd/gi, "")
    .replace(/ars/gi, "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!numericPortion) {
    return { amount: 0, currency };
  }

  const lastCommaIndex = numericPortion.lastIndexOf(",");
  const lastDotIndex = numericPortion.lastIndexOf(".");
  const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);

  const normalized =
    decimalSeparatorIndex >= 0
      ? `${numericPortion.slice(0, decimalSeparatorIndex).replace(/[.,]/g, "")}.${numericPortion
          .slice(decimalSeparatorIndex + 1)
          .replace(/[.,]/g, "")}`
      : numericPortion.replace(/[.,]/g, "");

  const amount = Number(normalized);
  return { amount: Number.isFinite(amount) ? amount : 0, currency };
}
