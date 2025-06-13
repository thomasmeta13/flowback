import { GraphQLScalarType, Kind } from 'graphql';

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'The JSON scalar type represents JSON objects as a string.',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return JSON.parse(ast.value);
    }
    return null;
  },
}); 