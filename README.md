# FlowNow Backend

Backend service for the FlowNow meditation and focus training app, built with Node.js, Express, and GraphQL.

## Features

- GraphQL API with subscriptions support
- Supabase integration for database and authentication
- Real-time updates for meditation sessions
- File upload and processing
- Question generation with OpenAI
- Progress tracking and leveling system
- Streak system with bonuses
- Mobile-optimized API responses

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Supabase account
- OpenAI API key
- Railway account (for deployment)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

## Project Structure

```
src/
├── config/         # Configuration files
├── graphql/        # GraphQL schema and resolvers
│   ├── resolvers/  # GraphQL resolvers
│   └── schemas/    # GraphQL type definitions
├── models/         # Database models
├── services/       # Business logic
└── utils/          # Utility functions
```

## API Documentation

The GraphQL API documentation is available at `/graphql` when running the server.

## Deployment

The application is configured for deployment on Railway. See the deployment documentation for details.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC # flowback
