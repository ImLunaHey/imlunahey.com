import { JSONSchema7 } from 'json-schema';

// create smallest number that satisfies:
// it bigger than minimum and it is mulitple of multipleOf
const minmul = (minimum: number, multipleOf: number, exclusive: number | undefined) => {
  // if we can return 0, we do that
  if (minimum < 0 || (!exclusive && minimum <= 0)) {
    return 0;
  }

  const min = exclusive ? minimum + 1 : minimum;
  const rest = min % multipleOf;

  if (rest === 0) {
    return min;
  }

  const sign = multipleOf / Math.abs(multipleOf);
  const quot = (min - rest) / multipleOf;

  return (quot + sign) * multipleOf;
};

// create smallest number that satisfies:
// it bigger than minimum and it is mulitple of multipleOf
const maxmul = (maximum: number, multipleOf: number, exclusive: number | undefined) => {
  // this is symmtric to minmul
  const res = -minmul(-maximum, multipleOf, exclusive);
  // eslint-disable-next-line no-compare-neg-zero
  return res === -0 ? 0 : res;
};

const _integer = (schema: JSONSchema7) => {
  // todo
  const { multipleOf, minimum, maximum, exclusiveMinimum, exclusiveMaximum } = schema;

  // check what is defined
  const mo = multipleOf !== undefined;
  const mi = minimum !== undefined;
  const ma = maximum !== undefined;
  if ((mo && mi && ma) || (!mo && mi && ma)) {
    // minimum and maximum
    if ((minimum < 0 || (!exclusiveMinimum && minimum <= 0)) && (maximum > 0 || (!exclusiveMaximum && maximum >= 0))) {
      return 0;
    } else {
      return exclusiveMinimum ? minimum + 1 : minimum;
    }
  } else if (mo && !mi && ma) {
    // multipleOf and maximum
    return maxmul(maximum, multipleOf, exclusiveMaximum);
  } else if (mo && mi && !ma) {
    // multipleOf and minimum
    return minmul(minimum, multipleOf, exclusiveMinimum);
  } else if (mo && !mi && !ma) {
    // only multipleOf
    return 0;
  } else if (!mo && !mi && ma) {
    // only maximum
    if (exclusiveMaximum) {
      return maximum > 0 ? 0 : maximum - 1;
    } else {
      return maximum >= 0 ? 0 : maximum;
    }
  } else if (!mo && mi && !ma) {
    // only minimum
    if (exclusiveMinimum) {
      return minimum < 0 ? 0 : minimum + 1;
    } else {
      return minimum <= 0 ? 0 : minimum;
    }
  }

  // totally free choice
  return 0;
};

export default _integer;
