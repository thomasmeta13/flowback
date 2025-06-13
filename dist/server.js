"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const dotenv_1 = require("dotenv");
const http_1 = require("http");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const schema_1 = require("@graphql-tools/schema");
const types_1 = require("./types");
const resolvers_1 = require("./resolvers");
const scalars_1 = require("./scalars");
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
const schema = (0, schema_1.makeExecutableSchema)({
    typeDefs: types_1.typeDefs,
    resolvers: {
        ...resolvers_1.resolvers,
        JSON: scalars_1.JSONScalar
    }
});
const wsServer = new ws_1.WebSocketServer({
    server: httpServer,
    path: '/graphql',
});
const serverCleanup = (0, ws_2.useServer)({ schema }, wsServer);
const server = new server_1.ApolloServer({
    schema,
    plugins: [
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await serverCleanup.dispose();
                    },
                };
            },
        },
    ],
});
async function startServer() {
    await server.start();
    app.use('/graphql', (0, express4_1.expressMiddleware)(server, {
        context: async ({ req }) => {
            return { token: req.headers.token };
        },
    }));
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
        console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
    });
}
startServer().catch((err) => {
    console.error('Error starting server:', err);
});
//# sourceMappingURL=server.js.map