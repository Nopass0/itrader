import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatCurrency(
  amount: number,
  currency: string = "RUB",
  locale: string = "ru-RU"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(
  number: number,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2,
  locale: string = "ru-RU"
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(number)
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function truncateString(str: string, length: number = 30): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export const statusLabels: Record<number, string> = {
  1: "Ожидает",
  2: "В процессе",
  3: "Частично завершена",
  4: "Обрабатывается",
  5: "Ожидает подтверждения",
  6: "Отменена",
  7: "Завершена",
  8: "Отклонена",
}