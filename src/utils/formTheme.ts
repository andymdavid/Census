import type React from 'react';
import type { FormTheme } from '../types/formSchema';

export const defaultFormTheme: FormTheme = {
  primaryColor: '#4f46e5',
  backgroundColor: '#f5f6fa',
  textColor: '#1f2937',
  fontFamily: 'Inter, sans-serif',
  logoUrl: '',
};

const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

const parseHexColor = (value: string) => {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  const hex = normalized.slice(1);
  const full = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex;
  const parsed = Number.parseInt(full, 16);
  if (Number.isNaN(parsed)) return null;
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const toHexColor = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => clamp(channel).toString(16).padStart(2, '0'))
    .join('')}`;

const mixColors = (base: string, target: string, weight: number) => {
  const left = parseHexColor(base);
  const right = parseHexColor(target);
  if (!left || !right) {
    return base;
  }
  return toHexColor(
    Math.round(left.r * (1 - weight) + right.r * weight),
    Math.round(left.g * (1 - weight) + right.g * weight),
    Math.round(left.b * (1 - weight) + right.b * weight)
  );
};

const getLuminance = (value: string) => {
  const rgb = parseHexColor(value);
  if (!rgb) return 0;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const isLightColor = (value: string) => getLuminance(value) > 0.58;

export const normalizeHexColor = (value: string) => {
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) {
    return null;
  }
  return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
};

export const buildFormThemeStyles = (
  theme?: Partial<FormTheme> | null
): React.CSSProperties | undefined => {
  if (!theme) {
    return undefined;
  }

  const primaryColor = normalizeHexColor(theme.primaryColor ?? '') ?? defaultFormTheme.primaryColor;
  const backgroundColor =
    normalizeHexColor(theme.backgroundColor ?? '') ?? defaultFormTheme.backgroundColor;
  const textColor = normalizeHexColor(theme.textColor ?? '') ?? defaultFormTheme.textColor;
  const fontFamily = theme.fontFamily?.trim() || defaultFormTheme.fontFamily;

  const backgroundIsLight = isLightColor(backgroundColor);
  const primaryContrast = isLightColor(primaryColor) ? '#0f172a' : '#ffffff';
  const surfaceColor = backgroundIsLight
    ? mixColors(backgroundColor, '#ffffff', 0.72)
    : mixColors(backgroundColor, '#ffffff', 0.12);
  const surfaceMutedColor = backgroundIsLight
    ? mixColors(backgroundColor, '#ffffff', 0.48)
    : mixColors(backgroundColor, '#ffffff', 0.06);
  const borderColor = backgroundIsLight
    ? mixColors(textColor, backgroundColor, 0.82)
    : mixColors(textColor, backgroundColor, 0.7);
  const mutedTextColor = mixColors(textColor, backgroundColor, 0.38);
  const softTextColor = mixColors(textColor, backgroundColor, 0.56);

  return {
    '--color-primary': primaryColor,
    '--color-primary-dark': mixColors(primaryColor, '#000000', 0.16),
    '--color-primary-contrast': primaryContrast,
    '--color-primary-soft': mixColors(primaryColor, backgroundColor, 0.84),
    '--color-background': backgroundColor,
    '--color-card': surfaceColor,
    '--color-card-muted': surfaceMutedColor,
    '--color-text': textColor,
    '--color-text-light': mutedTextColor,
    '--color-text-lighter': softTextColor,
    '--color-border': borderColor,
    '--color-button-primary': primaryColor,
    '--color-button-primary-hover': mixColors(primaryColor, '#000000', 0.14),
    fontFamily,
  } as React.CSSProperties;
};
