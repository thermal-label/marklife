import type { RotateDirection } from '@thermal-label/contracts';

/**
 * Marklife chassis rotate landscape input clockwise (`90`).
 *
 * Direct-thermal heads are mounted with the leading edge at the top —
 * same as labelife's TSPL/ESC chassis. Confirm once on hardware with a
 * landscape "F" print on 50 × 30 mm gap stock.
 */
export const ROTATE_DIRECTION: RotateDirection = 90;
