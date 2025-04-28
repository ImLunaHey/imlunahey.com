import { JSONSchema7 } from 'json-schema';
import { deref } from './deref';
import merge from './merge';
import _integer from './integer';

function _array<T>(schema: JSONSchema7, global: JSONSchema7): T[] {
  const { items, minItems } = schema;

  if (items instanceof Array) {
    return items.map((item) => empty(item as JSONSchema7, global)) as T[];
  } else if (minItems && items) {
    // we need at least this amount of items
    return Array.from(new Array(minItems), () => empty(items as JSONSchema7, global)) as T[];
  } else {
    // minItems is not given or we don't know item
    // type, so jsut make empty array
    return [];
  }
}

function _object(schema: JSONSchema7, global: JSONSchema7) {
  const { required, properties } = schema;

  if (!required) {
    // no required fields, return empty object
    return {};
  }

  return required.reduce((prev, next) => {
    const s = properties?.[next];
    if (!s) throw new Error(`property \`${next}\` not defined on object`);
    prev[next] = empty(s as JSONSchema7, global);
    return prev;
  }, {} as Record<string, unknown>);
}

function empty(schema: JSONSchema7, global: JSONSchema7) {
  const { type, default: default_, enum: enum_, oneOf, anyOf, allOf } = schema;

  if (default_) {
    // if a default is given, return that
    return default_;
  } else if (enum_) {
    // if it is an enum, just use an enum value
    // json schema enums must have at least one value
    return enum_[0];
  } else if (type) {
    // type is given
    const t = type instanceof Array ? type.sort()[0] : type;

    switch (t) {
      case 'array':
        return _array(schema, global);

      case 'boolean':
        return false;

      case 'integer':
      case 'number':
        return _integer(schema);

      case 'null':
        return null;

      case 'object':
        return _object(schema, global);

      case 'string':
        return '';

      default:
        throw new Error(`cannot create value of type ${type}`);
    }
  } else if (allOf) {
    // merge schema's and follow that
    return empty(merge(allOf), global);
  } else if (anyOf) {
    // any of the schema's is ok so pick the first
    // todo: is this deterministic?
    return empty(anyOf[0] as JSONSchema7, global);
  } else if (oneOf) {
    // one of the schema's is ok so pick the first
    // todo: is this deterministic?
    return empty(oneOf[0] as JSONSchema7, global);
  }

  throw new Error(`cannot generate data from schema ${schema}`);
}

const make = (schema: JSONSchema7) => {
  const s = deref(schema);
  return empty(s, s);
};

export default make;
