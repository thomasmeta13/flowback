import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { json } from 'body-parser';
import cors from 'cors';
import express from 'express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../src/types';
import { resolvers } from '../src/resolvers';
import { JSONScalar } from '../src/scalars';

const app = express();

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

// Create Apollo Server
const server = new ApolloServer({
  schema,
});

// Start server
async function startServer() {
  await server.start();
  
  app.use(
    '/api/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Add authentication context here
        return { token: req.headers.token };
      },
    })
  );
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
});

export default app; 