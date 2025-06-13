import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import { json } from 'body-parser';
import { config } from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './types';
import { resolvers } from './resolvers';
import { JSONScalar } from './scalars';

// Load environment variables
config();

const app = express();
const httpServer = createServer(app);

// Basic middleware
app.use(cors());
app.use(json());

const schema = makeExecutableSchema({ 
  typeDefs, 
  resolvers: {
    ...resolvers,
    JSON: JSONScalar
  }
});

// Create WebSocket server
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

const serverCleanup = useServer({ schema }, wsServer);

// Create Apollo Server
const server = new ApolloServer({
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

// Start server
async function startServer() {
  await server.start();
  
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Add authentication context here
        return { token: req.headers.token };
      },
    })
  );

  // For local development
  if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
      console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
    });
  }
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
});

// Export the Express API
export default app; 