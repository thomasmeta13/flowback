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

  type BreathingSettings {
    speed: Float!
    pauseDuration: Float!
  }

  type SartResult {
    id: ID!
    user_id: String!
    session_id: String
    total_trials: Int!
    correct_go_trials: Int!
    correct_no_go_trials: Int!
    commission_errors: Int!
    omission_errors: Int!
    average_reaction_time: Float!
    accuracy_percentage: Float!
    test_type: String!
    started_at: String!
    completed_at: String!
    duration_ms: Int!
    trial_details: JSON
    created_at: String!
    updated_at: String!
  }

  type SartAnalytics {
    averageAccuracy: Float!
    averageReactionTime: Float!
    improvementTrend: Float!
    totalTests: Int!
    latestScore: Float!
  }

  type SartSessionCompletion {
    session: Session!
    sartResult: SartResult!
  }

  input SartResultInput {
    userId: String!
    sessionId: String
    totalTrials: Int!
    correctGoTrials: Int!
    correctNoGoTrials: Int!
    commissionErrors: Int!
    omissionErrors: Int!
    averageReactionTime: Float!
    accuracyPercentage: Float!
    testType: String
    startedAt: String!
    completedAt: String!
    durationMs: Int!
    trialDetails: JSON
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
    diagnostic_step: Int
    diagnostic_complete: Boolean
    diagnostic_data: JSON
  }

  type Library {
    id: ID!
    title: String!
    description: String
    content: String
    length: Int
    estimated_time: String
    file_url: String
    file_type: String
    uploaded_by: String
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
    getBreathingSettings(userId: ID!): BreathingSettings
    userBadges(userId: ID!): [UserBadge!]!
    allBadges: [Badge!]!
    flows: [Flow]
    flowBySlug(slug: String!): Flow
    sartResults(userId: String!): [SartResult!]!
    latestSartResult(userId: String!): SartResult
    sartAnalytics(userId: String!): SartAnalytics!
  }

  type Diagnostic {
    id: ID!
    user_id: ID!
    reading_speed: Int
    breathing_rate: Int
    memory_score: Int
    focus_score: Int
    started_at: String
    completed_at: String
    device_id: String
  }

  input DiagnosticInput {
    user_id: ID!
    reading_speed: Int
    breathing_rate: Int
    memory_score: Int
    focus_score: Int
    started_at: String
    completed_at: String
    device_id: String
  }

  type Mutation {
    createUser(
      email: String!
      auth_provider: String!
      display_name: String
    ): User!

    createDiagnostic(input: DiagnosticInput!): Diagnostic!

    saveBreathingSettings(
      userId: ID!
      speed: Float!
      pauseDuration: Float!
    ): BreathingSettings!

    loginWithGoogle(idToken: String!): User!

    loginWithApple(idToken: String!): User!

    createDocument(userId: ID!, title: String!, content: String, fileUrl: String, fileType: String): Library

    saveSartResult(input: SartResultInput!): SartResult!
    createSartSession(userId: String!): Session!
    completeSartSession(sessionId: String!, sartResults: SartResultInput!): SartSessionCompletion!

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

  type QuizQuestion {
    question: String!
    options: [String!]!
    correctAnswer: Int!   # 0..3
    category: String!     # "memorization" | "comprehension"
  }

  extend type Mutation {
    generateQuiz(excerpt: String!): [QuizQuestion!]!
  }

  extend type Mutation {
    getSignedUploadUrl(userId: ID!, fileName: String!): SignedUploadPayload!
  }

  type PictureWordImage {
    id: String!
    url: String!
    alt: String!
    photographer: String!
  }

  type PictureWordPair {
    id: String!
    sentence: String!
    image: PictureWordImage!
    searchTerm: String!
  }

  type PictureWordContent {
    pairs: [PictureWordPair!]!
    totalGenerated: Int!
    sessionDuration: Int!
    theme: String!
    fallback: Boolean
  }

  extend type Mutation {
    generatePictureWordContent(duration: Int!, theme: String, userId: ID!): PictureWordContent!
  }
`;
