"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONScalar = void 0;
const graphql_1 = require("graphql");
exports.JSONScalar = new graphql_1.GraphQLScalarType({
    name: 'JSON',
    description: 'The JSON scalar type represents JSON objects as a string.',
    serialize(value) {
        return value;
    },
    parseValue(value) {
        return value;
    },
    parseLiteral(ast) {
        if (ast.kind === graphql_1.Kind.STRING) {
            return JSON.parse(ast.value);
        }
        return null;
    },
});
//# sourceMappingURL=scalars.js.map