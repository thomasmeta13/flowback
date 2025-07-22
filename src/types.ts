export const typeDefs = `#graphql
  scalar JSON

  type User {
    id: ID!
    email: String!
    auth_provider: String!
    created_at: String!
    last_login: String
    profile_completed: Boolean!
    display_name: String
    timezone: String!
  }

  type Exercise {
    id: ID!
    name: String!
    type: String!
    duration: Int!
    difficulty_level: Int!
    description: String
    instructions: JSON
    required_level: Int!
    xp_reward: Int!
    focus_reward: Int!
    is_unlocked: Boolean!
  }

  type FlowExercise {
    id: ID!
    sequence_order: Int!
    exercise: Exercise!
  }

  type Flow {
    id: ID!
    slug: String!
    name: String!
    description: String
    type: String
    duration: Int
    difficulty_level: Int
    exercises: [FlowExercise!]!
  }

  type Session {
    id: ID!
    user_id: ID!
    exercise_id: ID!
    duration: Int!
    start_time: String!
    end_time: String
    focus_increase: Int
    xp_gained: Int
    completed_exercises_count: Int!
    performance_metrics: JSON
    used_warmups: Boolean
  }

  type UserProgress {
    id: ID!
    user_id: ID!
    level: Int!
    xp: Int!
    max_xp: Int!
    streak_count: Int!
    last_streak_update: String
    total_points: Int!
    highest_streak: Int!
  }

  type Library {
    id: ID!
    title: String!
    description: String
    content: String
    length: Int
    estimated_time: String
    created_at: String
    updated_at: String
    is_document: Boolean
  }

  type ReadingProgress {
    id: ID!
    user_id: ID!
    book_id: ID!
    words_flashed: Int!
    word_count: Int!
    last_position: Int!
    created_at: String!
    updated_at: String!
  }

  type BookProgressDetails {
    content: String!
    wordCount: Int!
    last_position: Int!
    remainingContent: String!
  }

  type Badge {
    id: ID!
    title: String!
    subtitle: String
    icon_url: String
    condition_type: String
    condition_value: Int
  }

  type UserBadge {
    id: ID!
    badge: Badge!
    unlocked_at: String!
  }

  type Query {
    exercises: [Exercise!]!
    exercise(id: ID!): Exercise
    userProgress(userId: ID!): UserProgress
    userSessions(userId: ID!): [Session!]!
    users: [User!]!
    user(id: ID!): User
    libraryBooks(userId: ID!): [Library!]!
    getBookProgress(userId: ID!, bookId: ID!): ReadingProgress
    getBookRemainingContent(userId: ID!, bookId: ID!): String
    getBookProgressDetails(userId: ID!, bookId: ID!): BookProgressDetails
    userBadges(userId: ID!): [UserBadge!]!
    allBadges: [Badge!]!
    flows: [Flow]
    flowBySlug(slug: String!): Flow
  }

  type Mutation {
    createUser(
      email: String!
      auth_provider: String!
      display_name: String
    ): User!

    loginWithGoogle(idToken: String!): User!

    loginWithApple(idToken: String!): User!

    createDocument(userId: ID!, title: String!, content: String!): Library

    createSession(
      userId: ID!
      exerciseId: ID!
      duration: Int!
      startTime: String!
    ): Session!
    
    completeSession(
      sessionId: ID!
      endTime: String!
      focusIncrease: Int
      xpGained: Int
      performanceMetrics: JSON
    ): Session!

    completeExercise(
      userId: ID!
      exerciseId: ID!
      duration: Int!
      performanceMetrics: JSON
      questionsAnswered: Int
      correctAnswers: Int
      scorePercent: Int
      quizDetails: JSON
    ): UserProgress!

    updateReadingProgress(
      userId: ID!
      bookId: ID!
      wordsFlashed: Int!
      wordCount: Int!
      lastPosition: Int!
    ): ReadingProgress!
  }

  type SignedUploadPayload {
    signedUrl: String!
    filePath: String!
    publicUrl: String!
  }

  extend type Mutation {
    getSignedUploadUrl(userId: ID!, fileName: String!): SignedUploadPayload!
  }
`;
