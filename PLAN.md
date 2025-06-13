# FlowNow Backend Implementation Plan

## Database Schema

### 1. Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  auth_provider VARCHAR(50) NOT NULL, -- 'apple' or 'google'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  preferences JSONB, -- Stores initial steps selections and other preferences
  profile_completed BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  display_name VARCHAR(255),
  bio TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{"email": true, "push": true}',
  last_activity TIMESTAMP WITH TIME ZONE,
  device_info JSONB, -- Stores device type, OS version, etc.
  app_version VARCHAR(20),
  last_sync TIMESTAMP WITH TIME ZONE,
  offline_data JSONB -- Stores data for offline mode
);
```

### 2. User Stats Table
```sql
CREATE TABLE user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  focus_score INTEGER DEFAULT 0,
  reading_speed_score INTEGER DEFAULT 0,
  persistence_score INTEGER DEFAULT 0,
  calmness_score INTEGER DEFAULT 0,
  memory_score INTEGER DEFAULT 0,
  flow_time_score INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

### 3. User Progress Table
```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  max_xp INTEGER DEFAULT 100,
  streak_count INTEGER DEFAULT 0,
  last_streak_update TIMESTAMP WITH TIME ZONE,
  total_points INTEGER DEFAULT 0,
  highest_streak INTEGER DEFAULT 0,
  UNIQUE(user_id)
);
```

### 4. Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  duration INTEGER NOT NULL, -- in seconds
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  focus_increase INTEGER,
  xp_gained INTEGER,
  completed_exercises_count INTEGER DEFAULT 0,
  performance_metrics JSONB -- Stores detailed metrics like accuracy, speed, etc.
);
```

### 5. Exercises Table
```sql
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'warmup' or 'main'
  duration INTEGER NOT NULL, -- in seconds
  difficulty_level INTEGER NOT NULL,
  description TEXT,
  instructions JSONB,
  required_level INTEGER DEFAULT 1,
  xp_reward INTEGER NOT NULL,
  focus_reward INTEGER NOT NULL,
  is_unlocked BOOLEAN DEFAULT TRUE
);
```

### 6. User Documents Table
```sql
CREATE TABLE user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL, -- 'pdf', 'txt', or 'json'
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_status VARCHAR(50) DEFAULT 'pending',
  question_count INTEGER DEFAULT 0,
  content_text TEXT, -- Stores processed text content
  file_size INTEGER NOT NULL, -- in bytes
  last_accessed TIMESTAMP WITH TIME ZONE
);
```

### 7. Generated Questions Table
```sql
CREATE TABLE generated_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES user_documents(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  difficulty_level INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE
);
```

### 8. Quiz Results Table
```sql
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES user_documents(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  completion_time INTEGER NOT NULL, -- in seconds
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  difficulty_level INTEGER NOT NULL
);
```

## Leveling System

### XP Thresholds
- Level 1: 0-100 XP
- Level 2: 101-250 XP
- Level 3: 251-500 XP
- Level 4: 501-1000 XP
- Level 5: 1001-2000 XP
- Level 6: 2001-4000 XP
- Level 7: 4001-8000 XP
- Level 8: 8001-16000 XP
- Level 9: 16001-32000 XP
- Level 10: 32001+ XP

### XP Rewards
- Exercise completion: 10-50 XP (based on difficulty)
- Quiz completion: 20-100 XP (based on score and difficulty)
- Daily streak bonus: +10% XP for each consecutive day
- Perfect quiz score: +25% bonus XP

## Exercise Unlocking System

Exercises are unlocked based on:
1. User level
2. Previous exercise completion
3. Performance metrics

Unlock requirements:
- Warmup exercises: Available from level 1
- Main exercises:
  - Level 1-2: Basic exercises
  - Level 3-5: Intermediate exercises
  - Level 6-10: Advanced exercises

## Streak System

### Rules
- 24-hour period for streak maintenance
- Must complete at least one exercise per day
- Streak breaks if no activity for 24 hours

### Streak Bonuses
- 3-day streak: +10% XP bonus
- 7-day streak: +25% XP bonus
- 14-day streak: +50% XP bonus
- 30-day streak: +100% XP bonus

### Streak Break Handling
- Show streak break screen
- Display highest streak achieved
- Offer motivation message
- Provide quick-start option for new streak

## Question Generation System

### Rules
- Maximum 5 questions per document
- Questions regenerated on each quiz attempt
- Difficulty scaling based on user level
- OpenAI integration for question generation

### Difficulty Levels
- Level 1-3: Basic comprehension questions
- Level 4-6: Intermediate analysis questions
- Level 7-10: Advanced synthesis questions

## Implementation Steps

1. **Project Setup**
   - Initialize Node.js project
   - Set up TypeScript
   - Configure GraphQL server
   - Set up Supabase connection
   - Configure Railway deployment

2. **Authentication System**
   - Implement Supabase Auth
   - Set up JWT handling
   - Create auth middleware
   - Implement social login (Apple/Google)

3. **Database Setup**
   - Create Supabase project
   - Implement database schema
   - Set up migrations
   - Create seed data

4. **Core API Implementation**
   - User management endpoints
   - Exercise management
   - Progress tracking
   - Session recording

5. **File Handling System**
   - Implement file upload
   - Set up Supabase storage
   - Create file processing pipeline
   - Implement file type validation

6. **Question Generation System**
   - Set up OpenAI integration
   - Implement question generation logic
   - Create difficulty scaling system
   - Implement quiz result tracking

7. **Progress System**
   - Implement leveling system
   - Create streak tracking
   - Set up XP rewards
   - Implement exercise unlocking

8. **Monitoring & Logging**
   - Set up error tracking
   - Implement performance monitoring
   - Create logging system
   - Set up alerts

9. **Testing & Documentation**
   - Write unit tests
   - Create integration tests
   - Generate API documentation
   - Create deployment documentation

10. **Deployment**
    - Set up Railway configuration
    - Configure environment variables
    - Set up CI/CD pipeline
    - Implement monitoring

## Technology Stack

- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- API: GraphQL
- Authentication: Supabase Auth
- File Storage: Supabase Storage
- AI Integration: OpenAI
- Deployment: Railway
- Monitoring: Sentry/New Relic
- Testing: Jest
- Documentation: GraphQL Playground

## Environment Variables

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
OPENAI_API_KEY=your_openai_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development/production
RAILWAY_TOKEN=your_railway_token
```

## API Rate Limits

- Authentication endpoints: 10 requests/minute
- Exercise endpoints: 30 requests/minute
- File upload endpoints: 5 requests/minute
- Question generation: 3 requests/minute
- General endpoints: 60 requests/minute

## Security Measures

- JWT token validation
- Rate limiting
- File type validation
- Input sanitization
- CORS configuration
- Secure headers
- API key rotation
- Regular security audits

## Mobile-Specific Considerations

### API Optimization
- Implement response compression
- Use efficient data formats (JSON)
- Implement pagination for large datasets
- Cache frequently accessed data
- Optimize image and file downloads

### Offline Support
- Implement data synchronization
- Store offline changes locally
- Handle conflict resolution
- Implement retry mechanisms
- Track sync status

### Network Handling
- Implement exponential backoff for retries
- Handle network timeouts gracefully
- Provide offline indicators
- Implement request queuing
- Handle background/foreground transitions

### Performance
- Minimize payload sizes
- Implement efficient caching
- Use connection pooling
- Optimize database queries
- Implement request batching

### Security
- Implement secure token storage
- Handle session timeouts
- Implement secure offline storage
- Protect sensitive data
- Implement proper error handling