declare module 'json-schema-empty' {
  import { JSONSchema7 } from 'json-schema';
  export default function empty(schema: JSONSchema7): object;
}
