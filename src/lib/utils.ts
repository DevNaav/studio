
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Unit Conversion Utilities

const conversionFactors: { [key: string]: number } = {
  // Length
  mm: 0.001,
  cm: 0.01,
  m: 1,
  inch: 0.0254,
  foot: 0.3048,
  feet: 0.3048,
  yard: 0.9144,
  // Weight
  kg: 1,
  ton: 1000,
  lb: 0.453592,
  quintal: 100,
  // Volume
  'm³': 1000,
  'ft³': 28.3168,
  liters: 1,
  gallons: 3.78541,
  // Area
  'm²': 1,
  'ft²': 0.092903,
  'cm²': 0.0001,
};

export const unitCategories = {
  length: ['mm', 'cm', 'm', 'inch', 'foot', 'feet', 'yard'],
  weight: ['kg', 'ton', 'lb', 'quintal'],
  volume: ['m³', 'ft³', 'liters', 'gallons'],
  area: ['m²', 'ft²', 'cm²'],
};

export function getUnitCategory(unit: string): keyof typeof unitCategories | null {
  for (const category in unitCategories) {
    if ((unitCategories as any)[category].includes(unit)) {
      return category as keyof typeof unitCategories;
    }
  }
  return null;
}

export function convertUnits(value: number, fromUnit: string, toUnit: string): number | null {
  const fromCategory = getUnitCategory(fromUnit);
  const toCategory = getUnitCategory(toUnit);

  if (!fromCategory || !toCategory || fromCategory !== toCategory) {
    return null; // Cannot convert between different categories
  }

  const fromFactor = conversionFactors[fromUnit];
  const toFactor = conversionFactors[toUnit];
  
  if (fromFactor === undefined || toFactor === undefined) {
      return null; // One of the units is not defined
  }

  // First, convert the value to the base unit of its category
  let baseValue;
  if(fromCategory === 'volume') {
      baseValue = value * fromFactor; // base is liters
  } else {
      baseValue = value * fromFactor; // base is meters, kg, or m²
  }
  
  // Then, convert from the base unit to the target unit
  const result = baseValue / toFactor;

  return result;
}

export function formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null) {
        return 'Rs. 0.00';
    }
    return `Rs. ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
