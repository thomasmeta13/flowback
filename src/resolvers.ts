import { verifyGoogleToken } from "./auth/google";
import { supabase, handleSupabaseError } from "./db/supabase";
import { jwtDecode } from "jwt-decode";

export const resolvers = {
  Query: {
    exercises: async () => {
      try {
        const { data, error } = await supabase.from("exercises").select("*");

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    exercise: async (_: any, { id }: { id: string }) => {
      try {
        const { data, error } = await supabase
          .from("exercises")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    userProgress: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    userSessions: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("user_id", userId);

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    users: async () => {
      try {
        const { data, error } = await supabase.from("users").select("*");

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    user: async (_: any, { id }: { id: string }) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    libraryBooks: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabase
          .from("library")
          .select("*")
          .or(`uploaded_by.eq.${userId},uploaded_by.is.null`);

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return [];
      }
    },

    userBadges: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabase
          .from("user_badges")
          .select("*, badge:badges(*)")
          .eq("user_id", userId);

        if (error) throw error;

        const result = data
          .filter((item: any) => item.badge != null)
          .map((item: any) => ({
            id: item.id,
            unlocked_at: item.unlocked_at,
            badge: item.badge,
          }));

        return result;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    allBadges: async () => {
      const { data, error } = await supabase.from("badges").select("*");

      if (error) throw new Error(error.message);
      return data;
    },

    getBookProgress: async (
      _: any,
      { userId, bookId }: { userId: string; bookId: string }
    ) => {
      const { data, error } = await supabase
        .from("reading_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    getBookRemainingContent: async (
      _: any,
      { userId, bookId }: { userId: string; bookId: string }
    ) => {
      // 1. Fetch the book
      const { data: book, error: bookError } = await supabase
        .from("library")
        .select("content")
        .eq("id", bookId)
        .maybeSingle();
      if (bookError) throw bookError;
      if (!book || !book.content) {
        console.log(
          "[getBookRemainingContent] Book not found or has no content"
        );
        return "";
      }

      // 2. Fetch the reading progress
      const { data: progress, error: progressError } = await supabase
        .from("reading_progress")
        .select("last_position")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle();
      if (progressError) throw progressError;

      // 3. Calculate remaining content
      const words = book.content.split(" ");
      const lastPosition = progress?.last_position || 0;
      if (lastPosition >= words.length) {
        console.log("[getBookRemainingContent] last_position >= words.length");
        return "";
      }
      const remaining = words.slice(lastPosition).join(" ");
      return remaining;
    },

    getBookProgressDetails: async (
      _: any,
      { userId, bookId }: { userId: string; bookId: string }
    ) => {
      // 1. Fetch the book
      const { data: book, error: bookError } = await supabase
        .from("library")
        .select("content")
        .eq("id", bookId)
        .maybeSingle();
      if (bookError) throw bookError;
      if (!book || !book.content)
        return {
          content: "",
          wordCount: 0,
          last_position: 0,
          remainingContent: "",
        };

      // 2. Fetch the reading progress
      const { data: progress, error: progressError } = await supabase
        .from("reading_progress")
        .select("last_position")
        .eq("user_id", userId)
        .eq("book_id", bookId)
        .maybeSingle();
      if (progressError) throw progressError;

      // 3. Calculate remaining content with bounds checking
      const words = book.content.trim().split(/\s+/);
      const wordCount = words.length;
      let last_position = progress?.last_position || 0;

      // Reset progress if last_position is invalid
      if (last_position >= wordCount) {
        console.log(
          "[getBookProgressDetails] Invalid last_position:",
          last_position,
          "resetting to 0"
        );
        last_position = 0;
        // Update the reading progress in the database
        const { error: updateError } = await supabase
          .from("reading_progress")
          .update({ last_position: 0 })
          .eq("user_id", userId)
          .eq("book_id", bookId);
        if (updateError) {
          console.error(
            "[getBookProgressDetails] Error resetting progress:",
            updateError
          );
        }
      }

      const remainingContent = words.slice(last_position).join(" ");
      return {
        content: book.content,
        wordCount,
        last_position,
        remainingContent,
      };
    },

    flows: async () => {
      try {
        const { data, error } = await supabase.from("flows").select("*");
        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    flowBySlug: async (_: any, { slug }: { slug: string }) => {
      try {
        const { data, error } = await supabase
          .from("flows")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },
  },

  Mutation: {
    createUser: async (
      _: any,
      {
        email,
        auth_provider,
        display_name,
      }: {
        email: string;
        auth_provider: string;
        display_name?: string;
      }
    ) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .insert([
            {
              email,
              auth_provider,
              display_name,
              profile_completed: false,
              timezone: "UTC",
            },
          ])
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    loginWithGoogle: async (_: any, { idToken }: { idToken: string }) => {
      try {
        const payload = await verifyGoogleToken(idToken);
        if (!payload || !payload.email) {
          throw new Error("Invalid Google token");
        }

        const email = payload.email;
        const display_name = payload.name || email.split("@")[0];

        const { data: existingUser, error: existingError } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingUser) {
          await supabase
            .from("users")
            .update({ last_login: new Date().toISOString() })
            .eq("id", existingUser.id);

          return existingUser;
        }

        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert([
            {
              email,
              auth_provider: "google",
              display_name,
              profile_completed: false,
              timezone: "UTC",
            },
          ])
          .select()
          .maybeSingle();

        if (insertError) throw insertError;

        return newUser;
      } catch (error) {
        handleSupabaseError(error);
        throw error; // Re-throw to be handled by GraphQL
      }
    },

    loginWithApple: async (_: any, { idToken }: { idToken: string }) => {
      try {
        // Decode Apple JWT to extract email & sub
        const decoded = jwtDecode(idToken);
        if (
          !decoded ||
          typeof decoded !== "object" ||
          !("email" in decoded) ||
          !("sub" in decoded)
        ) {
          throw new Error("Invalid Apple token");
        }

        const email = decoded.email as string;

        // Check if user exists
        const { data: existingUser, error: findError } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (findError) throw findError;

        if (existingUser) {
          return existingUser;
        }

        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert([
            {
              email,
              auth_provider: "apple",
              profile_completed: false,
              timezone: "UTC",
            },
          ])
          .select()
          .maybeSingle();

        if (createError) throw createError;

        return newUser;
      } catch (err) {
        handleSupabaseError(err);
        throw err; // Re-throw to be handled by GraphQL
      }
    },

    createSession: async (
      _: any,
      {
        userId,
        exerciseId,
        duration,
        startTime,
        usedWarmups,
      }: {
        userId: string;
        exerciseId: number;
        duration: number;
        startTime: string;
        usedWarmups: boolean;
      }
    ) => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .insert([
            {
              user_id: userId,
              exercise_id: exerciseId,
              duration,
              start_time: startTime,
              completed_exercises_count: 0,
              used_warmups: usedWarmups,
            },
          ])
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    completeSession: async (
      _: any,
      {
        sessionId,
        endTime,
        focusIncrease,
        xpGained,
        performanceMetrics,
        usedWarmups,
      }: {
        sessionId: string;
        endTime: string;
        focusIncrease?: number;
        xpGained?: number;
        performanceMetrics?: any;
        usedWarmups?: boolean;
      }
    ) => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .update({
            end_time: endTime,
            focus_increase: focusIncrease,
            xp_gained: xpGained,
            performance_metrics: performanceMetrics,
            used_warmups: usedWarmups,
          })
          .eq("id", sessionId)
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        throw error; // Re-throw to be handled by GraphQL
      }
    },

    createDocument: async (
      _: any,
      {
        userId,
        title,
        content,
      }: {
        userId: string;
        title: string;
        content: string;
      }
    ) => {
      try {
        const { data, error } = await supabase
          .from("library")
          .insert([
            {
              title,
              content,
              description: "User uploaded document",
              estimated_time: Math.ceil(content.split(/\s+/).length / 200),
              length: content.split(/\s+/).length,
              is_document: true,
              uploaded_by: userId,
            },
          ])
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
      }
    },

    completeExercise: async (
      _: any,
      {
        userId,
        exerciseId,
        duration,
        performanceMetrics,
        questionsAnswered,
        correctAnswers,
        scorePercent,
        quizDetails,
      }: {
        userId: string;
        exerciseId: string;
        duration: number;
        performanceMetrics?: any;
        questionsAnswered?: number;
        correctAnswers?: number;
        scorePercent?: number;
        quizDetails?: any;
      }
    ) => {
      try {
        console.log("Starting completeExercise mutation with:", {
          userId,
          exerciseId,
          duration,
          performanceMetrics,
          questionsAnswered,
          correctAnswers,
          scorePercent,
          quizDetails,
        });

        // Debug: Log performanceMetrics and article.id
        console.log("DEBUG: performanceMetrics:", performanceMetrics);
        console.log(
          "DEBUG: performanceMetrics.source:",
          performanceMetrics?.source
        );
        console.log(
          "DEBUG: performanceMetrics.article:",
          performanceMetrics?.article
        );
        console.log(
          "DEBUG: performanceMetrics.article.id:",
          performanceMetrics?.article?.id
        );

        // 1. Get the exercise to get XP and focus rewards
        console.log("Fetching exercise details...");
        const { data: exercise, error: exerciseError } = await supabase
          .from("exercises")
          .select("*")
          .eq("id", parseInt(exerciseId))
          .maybeSingle();

        if (exerciseError) {
          console.error("Error fetching exercise:", exerciseError);
          throw exerciseError;
        }
        console.log("Exercise details:", exercise);

        // 2. Create a new session
        console.log("Creating new session...");
        const startTime = new Date().toISOString();
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .insert([
            {
              user_id: userId,
              exercise_id: parseInt(exerciseId),
              duration,
              start_time: startTime,
              end_time: new Date().toISOString(),
              focus_increase: exercise.focus_reward,
              xp_gained: exercise.xp_reward,
              completed_exercises_count: 1,
              performance_metrics: performanceMetrics,
              questions_answered: questionsAnswered,
              correct_answers: correctAnswers,
              score_percent: scorePercent,
              quiz_details: quizDetails,
            },
          ])
          .select()
          .maybeSingle();

        if (sessionError) {
          console.error("Error creating session:", sessionError);
          throw sessionError;
        }
        console.log("Session created:", session);

        // 3. Update reading progress if this is a library exercise
        if (
          (performanceMetrics?.source === "library" ||
            performanceMetrics?.source === "document") &&
          performanceMetrics?.article
        ) {
          const article = performanceMetrics.article;
          const wordRange = performanceMetrics.wordRange;

          const words = article.content.trim().split(/\s+/);
          const totalWords = words.length;

          const validatedTo = Math.min(wordRange?.to || 0, totalWords);
          const validatedFrom = Math.min(wordRange?.from || 0, validatedTo);
          const newWordsFlashed = validatedTo;
          const newWordCount = validatedTo - validatedFrom;
          const newLastPosition = validatedTo;

          // 🔁 Use different ID ranges or `article.source` to distinguish between library and document
          const bookId = article.id;

          const { data: currentProgress, error: progressError } = await supabase
            .from("reading_progress")
            .select("*")
            .eq("user_id", userId)
            .eq("book_id", bookId)
            .maybeSingle();

          if (progressError && progressError.code !== "PGRST116") {
            console.error("Error fetching reading progress:", progressError);
            throw progressError;
          }

          if (currentProgress) {
            const { error: updateError } = await supabase
              .from("reading_progress")
              .update({
                words_flashed: newWordsFlashed,
                word_count: newWordCount,
                last_position: newLastPosition,
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentProgress.id);

            if (updateError) {
              console.error("Error updating reading progress:", updateError);
              throw updateError;
            }
          } else {
            const { error: createError } = await supabase
              .from("reading_progress")
              .insert([
                {
                  user_id: userId,
                  book_id: bookId,
                  words_flashed: newWordsFlashed,
                  word_count: newWordCount,
                  last_position: newLastPosition,
                },
              ]);

            if (createError) {
              console.error("Error creating reading progress:", createError);
              throw createError;
            }
          }
        }

        // 4. Get current user progress or create new if doesn't exist
        console.log("Fetching user progress...");
        const { data: currentProgress, error: progressError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (progressError && progressError.code === "PGRST116") {
          console.log("No existing progress found, creating new progress...");
          const { data: newProgress, error: createError } = await supabase
            .from("user_progress")
            .insert([
              {
                user_id: userId,
                level: 1,
                xp: exercise.xp_reward,
                max_xp: 100,
                streak_count: 1,
                last_streak_update: new Date().toISOString(),
                total_points: exercise.xp_reward,
                highest_streak: 1,
              },
            ])
            .select()
            .maybeSingle();

          if (createError) {
            console.error("Error creating new progress:", createError);
            throw createError;
          }
          console.log("New progress created:", newProgress);
          return newProgress;
        }

        if (progressError) {
          console.error("Error fetching progress:", progressError);
          throw progressError;
        }
        console.log("Current progress:", currentProgress);

        // 5. Calculate new XP and level
        const newXp = (currentProgress?.xp || 0) + exercise.xp_reward;
        const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
        const newMaxXp = newLevel * newLevel * 100;

        console.log("Calculated new progress:", {
          newXp,
          newLevel,
          newMaxXp,
          xpReward: exercise.xp_reward,
          currentXp: currentProgress?.xp,
        });

        // 6. Update user progress
        console.log("Updating user progress...");
        const { data: updatedProgress, error: updateError } = await supabase
          .from("user_progress")
          .upsert({
            id: currentProgress?.id,
            user_id: userId,
            level: newLevel,
            xp: newXp,
            max_xp: newMaxXp,
            total_points:
              (currentProgress?.total_points || 0) + exercise.xp_reward,
            // Update streak if this is the first exercise today
            streak_count:
              currentProgress?.last_streak_update &&
              new Date().toDateString() ===
                new Date(currentProgress.last_streak_update).toDateString()
                ? currentProgress.streak_count
                : (currentProgress?.streak_count || 0) + 1,
            last_streak_update: new Date().toISOString(),
            highest_streak: Math.max(
              currentProgress?.highest_streak || 0,
              currentProgress?.streak_count || 0
            ),
          })
          .select()
          .maybeSingle();

        if (updateError) {
          console.error("Error updating progress:", updateError);
          throw updateError;
        }
        console.log("Progress updated successfully:", updatedProgress);

        return updatedProgress;
      } catch (error) {
        console.error("Error in completeExercise mutation:", error);
        handleSupabaseError(error);
      }
    },
    updateReadingProgress: async (
      _: any,
      {
        userId,
        bookId,
        wordsFlashed,
        wordCount,
        lastPosition,
      }: {
        userId: string;
        bookId: string;
        wordsFlashed: number;
        wordCount: number;
        lastPosition: number;
      }
    ) => {
      try {
        // Get current reading progress
        const { data: currentProgress, error: progressError } = await supabase
          .from("reading_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("book_id", bookId)
          .maybeSingle();

        if (progressError && progressError.code !== "PGRST116") {
          console.error("Error fetching reading progress:", progressError);
          throw progressError;
        }

        // Update or create reading progress
        if (currentProgress) {
          console.log(
            "Updating existing reading progress:",
            currentProgress.id
          );
          const { data, error: updateError } = await supabase
            .from("reading_progress")
            .update({
              words_flashed: wordsFlashed,
              word_count: wordCount,
              last_position: lastPosition,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentProgress.id)
            .select()
            .single();

          if (updateError) {
            console.error("Error updating reading progress:", updateError);
            throw updateError;
          }
          return data;
        } else {
          console.log(
            "Creating new reading progress for user:",
            userId,
            "book:",
            bookId
          );
          const { data, error: createError } = await supabase
            .from("reading_progress")
            .insert([
              {
                user_id: userId,
                book_id: bookId,
                words_flashed: wordsFlashed,
                word_count: wordCount,
                last_position: lastPosition,
              },
            ])
            .select()
            .single();

          if (createError) {
            console.error("Error creating reading progress:", createError);
            throw createError;
          }
          return data;
        }
      } catch (error) {
        console.error("Error in updateReadingProgress:", error);
        throw error;
      }
    },
  },
  Flow: {
    exercises: async (parent: any) => {
      // parent.id is the flow id
      const { data, error } = await supabase
        .from("flow_exercises")
        .select("id, sequence_order, exercise:exercises(*)")
        .eq("flow_id", parent.id)
        .order("sequence_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  },
};
