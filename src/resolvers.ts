import { handleSupabaseError, supabaseAdmin } from "./db/supabase";
import { jwtDecode } from "jwt-decode";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import { OAuth2Client } from "google-auth-library";
import OpenAI from "openai";
import crypto from "node:crypto";

// --- Quiz gen setup ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  maxRetries: 0,
  timeout: 8000, // hard cap to avoid long gens
});

// very small in-memory cache
const QUIZ_CACHE = new Map<string, { at: number; items: any[] }>();
const QUIZ_TTL_MS = 5 * 60 * 1000;

const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex");
// keep excerpt small → fewer tokens → faster
const clip = (t: string, n = 1800) =>
  t.length <= n ? t : t.slice((t.length - n) / 2, (t.length - n) / 2 + n);

const QUIZ_SYSTEM =
  "You generate 8 SAT-style MCQs strictly answerable from the excerpt. No explanations.";
const makePrompt = (ex: string) => `EXCERPT:
"""${ex}"""

Make exactly 8 MCQs: 4 memorization + 4 comprehension.
Return JSON only:
{"items":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"category":"memorization|comprehension"}]}`;

async function extractTextFromPDF(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error("❌ Failed to fetch PDF:", response.status, url);
      throw new Error(`Failed to fetch PDF from ${url}`);
    }

    const buffer = await response.arrayBuffer();
    const parsed = await pdf(Buffer.from(buffer));

    if (!parsed.text || parsed.text.trim() === "") {
      throw new Error("PDF parsed but contains no text");
    }

    return parsed.text;
  } catch (err: any) {
    console.error("❌ PDF parsing failed:", err.message);
    throw new Error("Invalid PDF structure");
  }
}

const LLM_TIMEOUT_MS = Number(process.env.QUIZ_TIMEOUT_MS ?? 12000);

function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race<T>([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("LLM_TIMEOUT")), ms)
    ),
  ]);
}

export const resolvers = {
  Query: {
    exercises: async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from("exercises")
          .select("*");

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    exercise: async (_: any, { id }: { id: string }) => {
      try {
        const { data, error } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin.from("users").select("*");

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    user: async (_: any, { id }: { id: string }) => {
      try {
        const { data, error } = await supabaseAdmin
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

    sartResults: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabaseAdmin
          .from("sart_results")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return [];
      }
    },

    latestSartResult: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabaseAdmin
          .from("sart_results")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return null;
      }
    },

    sartAnalytics: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabaseAdmin
          .from("sart_results")
          .select(
            "accuracy_percentage, average_reaction_time, commission_errors, omission_errors, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            averageAccuracy: 0,
            averageReactionTime: 0,
            improvementTrend: 0,
            totalTests: 0,
            latestScore: 0,
          };
        }

        const totalTests = data.length;
        const averageAccuracy =
          data.reduce((sum, result) => sum + result.accuracy_percentage, 0) /
          totalTests;
        const averageReactionTime =
          data.reduce((sum, result) => sum + result.average_reaction_time, 0) /
          totalTests;
        const latestScore = data[data.length - 1].accuracy_percentage;

        // Calculate improvement trend (latest vs first)
        const firstScore = data[0].accuracy_percentage;
        const improvementTrend = totalTests > 1 ? latestScore - firstScore : 0;

        return {
          averageAccuracy,
          averageReactionTime,
          improvementTrend,
          totalTests,
          latestScore,
        };
      } catch (error) {
        handleSupabaseError(error);
        return {
          averageAccuracy: 0,
          averageReactionTime: 0,
          improvementTrend: 0,
          totalTests: 0,
          latestScore: 0,
        };
      }
    },

    getBreathingSettings: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabaseAdmin
          .from("user_settings")
          .select("breathing_speed, breathing_pause_duration")
          .eq("user_id", userId)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        return data
          ? {
              speed: data.breathing_speed,
              pauseDuration: data.breathing_pause_duration,
            }
          : null;
      } catch (error) {
        handleSupabaseError(error);
        return null;
      }
    },

    libraryBooks: async (_: any, { userId }: { userId: string }) => {
      try {
        const { data, error } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin
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
      const { data, error } = await supabaseAdmin.from("badges").select("*");

      if (error) throw new Error(error.message);
      return data;
    },

    getBookProgress: async (
      _: any,
      { userId, bookId }: { userId: string; bookId: string }
    ) => {
      const { data, error } = await supabaseAdmin
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
      const { data: book, error: bookError } = await supabaseAdmin
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
      const { data: progress, error: progressError } = await supabaseAdmin
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
      const { data: book, error: bookError } = await supabaseAdmin
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
      const { data: progress, error: progressError } = await supabaseAdmin
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
        const { error: updateError } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin.from("flows").select("*");
        if (error) throw error;
        return data;
      } catch (error) {
        handleSupabaseError(error);
        return []; // Return empty array as fallback
      }
    },

    flowBySlug: async (_: any, { slug }: { slug: string }) => {
      try {
        const { data, error } = await supabaseAdmin
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
    getSignedUploadUrl: async (
      _: any,
      { userId, fileName }: { userId: string; fileName: string }
    ) => {
      const filePath = `${userId}/${Date.now()}_${fileName}`;
      const { data, error } = await supabaseAdmin.storage
        .from("pdf-uploads")
        .createSignedUploadUrl(filePath, { upsert: true });

      if (error) throw error;

      return {
        signedUrl: data.signedUrl,
        filePath,
        publicUrl: `https://ezwoigvemjyknhuopfym.supabase.co/storage/v1/object/public/pdf-uploads/${filePath}`,
      };
    },
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
        const { data, error } = await supabaseAdmin
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

    saveSartResult: async (_: any, { input }: { input: any }) => {
      try {
        const {
          userId,
          sessionId,
          totalTrials,
          correctGoTrials,
          correctNoGoTrials,
          commissionErrors,
          omissionErrors,
          averageReactionTime,
          accuracyPercentage,
          testType,
          startedAt,
          completedAt,
          durationMs,
          trialDetails,
        } = input;

        console.log("Saving SART result:", {
          userId,
          sessionId,
          totalTrials,
          accuracyPercentage,
          testType,
        });

        const { data, error } = await supabaseAdmin
          .from("sart_results")
          .insert([
            {
              user_id: userId,
              session_id: sessionId,
              total_trials: totalTrials,
              correct_go_trials: correctGoTrials,
              correct_no_go_trials: correctNoGoTrials,
              commission_errors: commissionErrors,
              omission_errors: omissionErrors,
              average_reaction_time: averageReactionTime,
              accuracy_percentage: accuracyPercentage,
              test_type: testType || "full",
              started_at: startedAt,
              completed_at: completedAt,
              duration_ms: durationMs,
              trial_details: trialDetails,
            },
          ])
          .select()
          .maybeSingle();

        if (error) {
          console.error("Error saving SART result:", error);
          throw error;
        }

        console.log("SART result saved successfully:", data);
        return data;
      } catch (error) {
        console.error("Error in saveSartResult mutation:", error);
        handleSupabaseError(error);
        throw error;
      }
    },

    createSartSession: async (_: any, { userId }: { userId: string }) => {
      try {
        // Create a session specifically for SART test
        const startTime = new Date().toISOString();

        // Get SART exercise ID (you might need to create this exercise in your exercises table)
        const { data: sartExercise, error: exerciseError } = await supabaseAdmin
          .from("exercises")
          .select("id")
          .eq("slug", "sart-test") // or however you identify the SART exercise
          .maybeSingle();

        if (exerciseError) {
          console.error("Error finding SART exercise:", exerciseError);
          // If no specific SART exercise exists, you might want to create a generic one
          // or handle this case differently
        }

        const { data: session, error: sessionError } = await supabaseAdmin
          .from("sessions")
          .insert([
            {
              user_id: userId,
              exercise_id: sartExercise?.id || null, // Use null if no specific exercise
              duration: 0, // Will be updated when completed
              start_time: startTime,
              completed_exercises_count: 0,
              used_warmups: false,
            },
          ])
          .select()
          .maybeSingle();

        if (sessionError) {
          console.error("Error creating SART session:", sessionError);
          throw sessionError;
        }

        console.log("SART session created:", session);
        return session;
      } catch (error) {
        console.error("Error in createSartSession mutation:", error);
        handleSupabaseError(error);
        throw error;
      }
    },

    completeSartSession: async (
      _: any,
      {
        sessionId,
        sartResults,
      }: {
        sessionId: string;
        sartResults: any;
      }
    ) => {
      try {
        const endTime = new Date().toISOString();

        // Update the session
        const { data: session, error: sessionError } = await supabaseAdmin
          .from("sessions")
          .update({
            end_time: endTime,
            duration: sartResults.durationMs / 1000, // Convert to seconds
            completed_exercises_count: 1,
            performance_metrics: {
              sartAccuracy: sartResults.accuracyPercentage,
              sartReactionTime: sartResults.averageReactionTime,
              sartCommissionErrors: sartResults.commissionErrors,
              sartOmissionErrors: sartResults.omissionErrors,
            },
          })
          .eq("id", sessionId)
          .select()
          .maybeSingle();

        if (sessionError) {
          console.error("Error updating SART session:", sessionError);
          throw sessionError;
        }

        // Save the detailed SART results
        const sartData = await sartResults(null, {
          input: {
            ...sartResults,
            sessionId,
          },
        });

        return {
          session,
          sartResult: sartData,
        };
      } catch (error) {
        console.error("Error in completeSartSession mutation:", error);
        handleSupabaseError(error);
        throw error;
      }
    },

    createDiagnostic: async (_: any, { input }: { input: any }) => {
      const {
        user_id,
        reading_speed,
        breathing_rate,
        memory_score,
        focus_score,
        started_at,
        completed_at,
        device_id,
      } = input;

      const { data, error } = await supabaseAdmin
        .from("diagnostic")
        .insert([
          {
            user_id,
            reading_speed,
            breathing_rate,
            memory_score,
            focus_score,
            started_at,
            completed_at,
            device_id,
          },
        ])
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    saveBreathingSettings: async (
      _: any,
      {
        userId,
        speed,
        pauseDuration,
      }: {
        userId: string;
        speed: number;
        pauseDuration: number;
      }
    ) => {
      try {
        // Check if settings exist for user
        const { data: existing, error: checkError } = await supabaseAdmin
          .from("user_settings")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (checkError && checkError.code !== "PGRST116") {
          throw checkError;
        }

        let result;

        if (existing) {
          // Update existing settings
          const { data, error } = await supabaseAdmin
            .from("user_settings")
            .update({
              breathing_speed: speed,
              breathing_pause_duration: pauseDuration,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .select()
            .single();

          if (error) throw error;
          result = data;
        } else {
          // Create new settings
          const { data, error } = await supabaseAdmin
            .from("user_settings")
            .insert([
              {
                user_id: userId,
                breathing_speed: speed,
                breathing_pause_duration: pauseDuration,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (error) throw error;
          result = data;
        }

        return {
          speed: result.breathing_speed,
          pauseDuration: result.breathing_pause_duration,
        };
      } catch (error) {
        handleSupabaseError(error);
        throw error;
      }
    },

    loginWithGoogle: async (_: any, { idToken }: { idToken: string }) => {
      try {
        const client = new OAuth2Client(
          "1075159909088-v4ja77t2ot5ulrfchal1ma0rjcfqe089.apps.googleusercontent.com"
        );
        const ticket = await client.verifyIdToken({
          idToken,
          audience:
            "1075159909088-v4ja77t2ot5ulrfchal1ma0rjcfqe089.apps.googleusercontent.com",
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
          throw new Error("Invalid Google token");
        }

        const email = payload.email.toLowerCase();
        const display_name = payload.name || email.split("@")[0];

        // Check if user already exists
        const { data: existingUser, error: existingError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingUser) {
          // ✅ Update last_login timestamp (optional)
          await supabaseAdmin
            .from("users")
            .update({ last_login: new Date().toISOString() })
            .eq("id", existingUser.id);

          return existingUser;
        }

        // ✅ Create new user
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from("users")
          .insert([
            {
              email,
              auth_provider: "google",
              display_name,
              profile_completed: false,
              timezone: "UTC",
              last_login: new Date().toISOString(),
            },
          ])
          .select()
          .maybeSingle();

        if (insertError) throw insertError;

        return newUser;
      } catch (error) {
        handleSupabaseError(error);
        throw error;
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
        const { data: existingUser, error: findError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (findError) throw findError;

        if (existingUser) {
          return existingUser;
        }

        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin
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
        const normalizedDuration =
          duration > 3600 * 24 ? Math.round(duration / 1000) : duration;
        const { data, error } = await supabaseAdmin
          .from("sessions")
          .insert([
            {
              user_id: userId,
              exercise_id: exerciseId,
              duration: normalizedDuration,
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
        const { data, error } = await supabaseAdmin
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
        fileUrl,
        fileType,
      }: {
        userId: string;
        title: string;
        content?: string;
        fileUrl?: string;
        fileType?: string;
      }
    ) => {
      try {
        const isPDF = fileType === "pdf";
        const finalContent =
          isPDF && fileUrl
            ? await extractTextFromPDF(fileUrl) // Define this
            : content || "";

        const wordList = finalContent.trim().split(/\s+/);
        const wordCount = wordList.length;
        const estimatedTime = Math.ceil(wordCount / 200);

        const { data, error } = await supabaseAdmin
          .from("library")
          .insert([
            {
              title,
              content: finalContent,
              description: isPDF
                ? "User uploaded PDF"
                : "User uploaded document",
              estimated_time: estimatedTime,
              length: wordCount,
              is_document: true,
              uploaded_by: userId,
              file_url: fileUrl,
              file_type: fileType,
            },
          ])
          .select()
          .maybeSingle();

        if (error) throw error;
        return data;
      } catch (error) {
        console.error("createDocument error:", error);
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
        const { data: exercise, error: exerciseError } = await supabaseAdmin
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
        const { data: session, error: sessionError } = await supabaseAdmin
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

          const { data: currentProgress, error: progressError } =
            await supabaseAdmin
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
            const { error: updateError } = await supabaseAdmin
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
            const { error: createError } = await supabaseAdmin
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
        const { data: currentProgress, error: progressError } =
          await supabaseAdmin
            .from("user_progress")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (progressError && progressError.code === "PGRST116") {
          console.log("No existing progress found, creating new progress...");
          const { data: newProgress, error: createError } = await supabaseAdmin
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
        const { data: updatedProgress, error: updateError } =
          await supabaseAdmin
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
        const { data: currentProgress, error: progressError } =
          await supabaseAdmin
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
          const { data, error: updateError } = await supabaseAdmin
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
          const { data, error: createError } = await supabaseAdmin
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
    generateQuiz: async (_: any, { excerpt }: { excerpt: string }) => {
      try {
        if (!excerpt || typeof excerpt !== "string") return [];

        const clipped = clip(excerpt, 1200); // smaller → faster
        const key = sha1("v1|" + clipped);
        const now = Date.now();

        const hit = QUIZ_CACHE.get(key);
        if (hit && now - hit.at < QUIZ_TTL_MS) return hit.items;

        const r = await withTimeout(
          openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            max_tokens: 500,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: QUIZ_SYSTEM },
              { role: "user", content: makePrompt(clipped) },
            ],
          }),
          LLM_TIMEOUT_MS
        );

        let items: any[] = [];
        try {
          const json = r.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(json);
          items = Array.isArray(parsed.items) ? parsed.items.slice(0, 8) : [];
        } catch {
          items = [];
        }

        const clean = items.map((q) => ({
          question: String(q?.question ?? "").trim(),
          options: (Array.isArray(q?.options) ? q.options : [])
            .slice(0, 4)
            .map(String),
          correctAnswer: Math.min(
            Math.max(Number(q?.correctAnswer ?? 0), 0),
            3
          ),
          category:
            q?.category === "memorization" ? "memorization" : "comprehension",
        }));

        QUIZ_CACHE.set(key, { at: now, items: clean });
        return clean;
      } catch (e) {
        console.warn("generateQuiz failed:", (e as any)?.message || e);
        return []; // ✅ never throw
      }
    },
    // Add this to your GraphQL resolvers
    generatePictureWordContent: async (
      _: any,
      {
        duration,
        theme = "nature",
        userId,
      }: {
        duration: number;
        theme?: string;
        userId: string;
      }
    ) => {
      try {
        // Calculate how many unique pairs we need
        const IMAGE_DISPLAY_DURATION = 3000; // 3 seconds per pair
        const requiredPairs = Math.ceil(
          (duration * 1000) / IMAGE_DISPLAY_DURATION
        );

        // Add 20% buffer to ensure no repetition
        const pairsToGenerate = Math.ceil(requiredPairs * 1.2);

        console.log(
          `Generating ${pairsToGenerate} unique pairs for ${duration}s session`
        );

        // Generate sentences using OpenAI
        const sentencePrompt = `Generate ${pairsToGenerate} unique, meditative sentences about ${theme}. 
    Each sentence should be:
    - 8-15 words long
    - Calming and contemplative
    - About natural elements, emotions, or peaceful concepts
    - Completely different from each other
    - Suitable for meditation practice
    
    Return as JSON array of strings only, no explanations:
    ["sentence1", "sentence2", ...]`;

        const sentenceResponse = await withTimeout(
          openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.8, // Higher creativity for variety
            max_tokens: 1000,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You generate diverse, meditative sentences for mindfulness practice. Return valid JSON only.",
              },
              {
                role: "user",
                content: `{"sentences": ${sentencePrompt}}`,
              },
            ],
          }),
          LLM_TIMEOUT_MS
        );

        let sentences: string[] = [];
        try {
          const json = sentenceResponse.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(json);
          sentences = Array.isArray(parsed.sentences) ? parsed.sentences : [];
        } catch (error) {
          console.error("Error parsing sentences:", error);
          sentences = [];
        }

        // Generate image search terms using OpenAI
        const imagePrompt = `Generate ${pairsToGenerate} unique image search terms for peaceful, meditative images.
    Each term should be:
    - 1-3 words only
    - Related to nature, wellness, or tranquility
    - Suitable for finding calming stock photos
    - Completely different from each other
    
    Examples: "mountain lake", "forest path", "ocean waves", "sunset sky"
    
    Return as JSON array of strings:`;

        const imageResponse = await withTimeout(
          openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.9, // High creativity for diverse terms
            max_tokens: 500,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You generate diverse search terms for peaceful stock photos. Return valid JSON only.",
              },
              {
                role: "user",
                content: `{"searchTerms": ${imagePrompt}}`,
              },
            ],
          }),
          LLM_TIMEOUT_MS
        );

        let imageSearchTerms: string[] = [];
        try {
          const json = imageResponse.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(json);
          imageSearchTerms = Array.isArray(parsed.searchTerms)
            ? parsed.searchTerms
            : [];
        } catch (error) {
          console.error("Error parsing image terms:", error);
          imageSearchTerms = [];
        }

        // Fetch images from Pexels using generated search terms
        const imageUrls: Array<{
          id: string;
          url: string;
          alt: string;
          photographer: string;
        }> = [];

        for (
          let i = 0;
          i < Math.min(imageSearchTerms.length, pairsToGenerate);
          i++
        ) {
          try {
            const searchTerm = imageSearchTerms[i];
            const response = await fetch(
              `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`,
              {
                headers: {
                  Authorization: process.env.PEXELS_API_KEY!,
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.photos && data.photos.length > 0) {
                const photo = data.photos[0];
                imageUrls.push({
                  id: `ai_${photo.id}_${Date.now()}_${i}`,
                  url: photo.src.medium,
                  alt: searchTerm,
                  photographer: photo.photographer,
                });
              }
            }
          } catch (error) {
            console.error(
              `Error fetching image for term "${imageSearchTerms[i]}":`,
              error
            );
          }
        }

        // Create pairs, ensuring we have enough content
        const pairs = [];
        const maxPairs = Math.max(sentences.length, imageUrls.length);

        for (let i = 0; i < pairsToGenerate && i < maxPairs; i++) {
          pairs.push({
            id: `pair_${Date.now()}_${i}`,
            sentence:
              sentences[i % sentences.length] ||
              `The universe holds infinite mysteries waiting to be discovered.`,
            image: imageUrls[i % imageUrls.length] || {
              id: `fallback_${i}`,
              url: "https://images.pexels.com/photos/814499/pexels-photo-814499.jpeg",
              alt: "peaceful nature",
              photographer: "Pexels",
            },
            searchTerm:
              imageSearchTerms[i % imageSearchTerms.length] || "nature",
          });
        }

        // Store session content for quiz generation later
        await supabaseAdmin.from("session_content").insert([
          {
            user_id: userId,
            session_id: `session_${Date.now()}_${userId}`,
            content_type: "picture_word_pairs",
            content_data: pairs,
            duration: duration,
            created_at: new Date().toISOString(),
          },
        ]);

        return {
          pairs,
          totalGenerated: pairs.length,
          sessionDuration: duration,
          theme,
        };
      } catch (error) {
        console.error("Error generating picture-word content:", error);

        // Fallback to basic content if AI generation fails
        const fallbackPairs = [];
        const fallbackSentences = [
          "The mountain stands tall against the horizon.",
          "Waves crash against the shore with rhythmic persistence.",
          "The forest whispers secrets to those who listen.",
          "Stars twinkle like distant memories in the night sky.",
          "The desert stretches endlessly toward the horizon.",
        ];

        for (let i = 0; i < 20; i++) {
          fallbackPairs.push({
            id: `fallback_${i}`,
            sentence: fallbackSentences[i % fallbackSentences.length],
            image: {
              id: `fallback_img_${i}`,
              url: "https://images.pexels.com/photos/814499/pexels-photo-814499.jpeg",
              alt: "peaceful nature",
              photographer: "Pexels",
            },
            searchTerm: "nature",
          });
        }

        return {
          pairs: fallbackPairs,
          totalGenerated: fallbackPairs.length,
          sessionDuration: duration,
          theme,
          fallback: true,
        };
      }
    },
  },
  Flow: {
    exercises: async (parent: any) => {
      // parent.id is the flow id
      const { data, error } = await supabaseAdmin
        .from("flow_exercises")
        .select("id, sequence_order, exercise:exercises(*)")
        .eq("flow_id", parent.id)
        .order("sequence_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  },
};
