"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const google_1 = require("./auth/google");
const supabase_1 = require("./db/supabase");
const jwt_decode_1 = require("jwt-decode");
exports.resolvers = {
    Query: {
        exercises: async () => {
            try {
                const { data, error } = await supabase_1.supabase.from("exercises").select("*");
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        exercise: async (_, { id }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("exercises")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        userProgress: async (_, { userId }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("user_progress")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        userSessions: async (_, { userId }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("sessions")
                    .select("*")
                    .eq("user_id", userId);
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        users: async () => {
            try {
                const { data, error } = await supabase_1.supabase.from("users").select("*");
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        user: async (_, { id }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("users")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        libraryBooks: async () => {
            try {
                const { data, error } = await supabase_1.supabase.from("library").select("*");
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        userBadges: async (_, { userId }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("user_badges")
                    .select("*, badge:badges(*)")
                    .eq("user_id", userId);
                if (error)
                    throw error;
                const result = data
                    .filter((item) => item.badge != null)
                    .map((item) => ({
                    id: item.id,
                    unlocked_at: item.unlocked_at,
                    badge: item.badge,
                }));
                return result;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        allBadges: async () => {
            const { data, error } = await supabase_1.supabase.from("badges").select("*");
            if (error)
                throw new Error(error.message);
            return data;
        },
        getBookProgress: async (_, { userId, bookId }) => {
            const { data, error } = await supabase_1.supabase
                .from("reading_progress")
                .select("*")
                .eq("user_id", userId)
                .eq("book_id", bookId)
                .maybeSingle();
            if (error)
                throw error;
            return data;
        },
        getBookRemainingContent: async (_, { userId, bookId }) => {
            const { data: book, error: bookError } = await supabase_1.supabase
                .from("library")
                .select("content")
                .eq("id", bookId)
                .maybeSingle();
            if (bookError)
                throw bookError;
            if (!book || !book.content) {
                console.log("[getBookRemainingContent] Book not found or has no content");
                return "";
            }
            const { data: progress, error: progressError } = await supabase_1.supabase
                .from("reading_progress")
                .select("last_position")
                .eq("user_id", userId)
                .eq("book_id", bookId)
                .maybeSingle();
            if (progressError)
                throw progressError;
            const words = book.content.split(" ");
            const lastPosition = (progress === null || progress === void 0 ? void 0 : progress.last_position) || 0;
            if (lastPosition >= words.length) {
                console.log("[getBookRemainingContent] last_position >= words.length");
                return "";
            }
            const remaining = words.slice(lastPosition).join(" ");
            return remaining;
        },
        getBookProgressDetails: async (_, { userId, bookId }) => {
            const { data: book, error: bookError } = await supabase_1.supabase
                .from("library")
                .select("content")
                .eq("id", bookId)
                .maybeSingle();
            if (bookError)
                throw bookError;
            if (!book || !book.content)
                return {
                    content: "",
                    wordCount: 0,
                    last_position: 0,
                    remainingContent: "",
                };
            const { data: progress, error: progressError } = await supabase_1.supabase
                .from("reading_progress")
                .select("last_position")
                .eq("user_id", userId)
                .eq("book_id", bookId)
                .maybeSingle();
            if (progressError)
                throw progressError;
            const words = book.content.trim().split(/\s+/);
            const wordCount = words.length;
            let last_position = (progress === null || progress === void 0 ? void 0 : progress.last_position) || 0;
            if (last_position >= wordCount) {
                console.log("[getBookProgressDetails] Invalid last_position:", last_position, "resetting to 0");
                last_position = 0;
                const { error: updateError } = await supabase_1.supabase
                    .from("reading_progress")
                    .update({ last_position: 0 })
                    .eq("user_id", userId)
                    .eq("book_id", bookId);
                if (updateError) {
                    console.error("[getBookProgressDetails] Error resetting progress:", updateError);
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
                const { data, error } = await supabase_1.supabase.from("flows").select("*");
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                return [];
            }
        },
        flowBySlug: async (_, { slug }) => {
            try {
                const { data, error } = await supabase_1.supabase
                    .from("flows")
                    .select("*")
                    .eq("slug", slug)
                    .maybeSingle();
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
    },
    Mutation: {
        createUser: async (_, { email, auth_provider, display_name, }) => {
            try {
                const { data, error } = await supabase_1.supabase
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
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        loginWithGoogle: async (_, { idToken }) => {
            try {
                const payload = await (0, google_1.verifyGoogleToken)(idToken);
                if (!payload || !payload.email) {
                    throw new Error("Invalid Google token");
                }
                const email = payload.email;
                const display_name = payload.name || email.split('@')[0];
                const { data: existingUser, error: existingError } = await supabase_1.supabase
                    .from("users")
                    .select("*")
                    .eq("email", email)
                    .maybeSingle();
                if (existingError)
                    throw existingError;
                if (existingUser) {
                    await supabase_1.supabase
                        .from("users")
                        .update({ last_login: new Date().toISOString() })
                        .eq("id", existingUser.id);
                    return existingUser;
                }
                const { data: newUser, error: insertError } = await supabase_1.supabase
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
                if (insertError)
                    throw insertError;
                return newUser;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                throw error;
            }
        },
        loginWithApple: async (_, { idToken }) => {
            try {
                const decoded = (0, jwt_decode_1.jwtDecode)(idToken);
                if (!decoded || typeof decoded !== 'object' || !('email' in decoded) || !('sub' in decoded)) {
                    throw new Error("Invalid Apple token");
                }
                const email = decoded.email;
                const { data: existingUser, error: findError } = await supabase_1.supabase
                    .from("users")
                    .select("*")
                    .eq("email", email)
                    .maybeSingle();
                if (findError)
                    throw findError;
                if (existingUser) {
                    return existingUser;
                }
                const { data: newUser, error: createError } = await supabase_1.supabase
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
                if (createError)
                    throw createError;
                return newUser;
            }
            catch (err) {
                (0, supabase_1.handleSupabaseError)(err);
                throw err;
            }
        },
        createSession: async (_, { userId, exerciseId, duration, startTime, usedWarmups, }) => {
            try {
                const { data, error } = await supabase_1.supabase
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
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        completeSession: async (_, { sessionId, endTime, focusIncrease, xpGained, performanceMetrics, usedWarmups, }) => {
            try {
                const { data, error } = await supabase_1.supabase
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
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
                throw error;
            }
        },
        createDocument: async (_, { userId, title, content, }) => {
            try {
                const { data, error } = await supabase_1.supabase
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
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        completeExercise: async (_, { userId, exerciseId, duration, performanceMetrics, questionsAnswered, correctAnswers, scorePercent, quizDetails, }) => {
            var _a;
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
                console.log("DEBUG: performanceMetrics:", performanceMetrics);
                console.log("DEBUG: performanceMetrics.source:", performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.source);
                console.log("DEBUG: performanceMetrics.article:", performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.article);
                console.log("DEBUG: performanceMetrics.article.id:", (_a = performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.article) === null || _a === void 0 ? void 0 : _a.id);
                console.log("Fetching exercise details...");
                const { data: exercise, error: exerciseError } = await supabase_1.supabase
                    .from("exercises")
                    .select("*")
                    .eq("id", parseInt(exerciseId))
                    .maybeSingle();
                if (exerciseError) {
                    console.error("Error fetching exercise:", exerciseError);
                    throw exerciseError;
                }
                console.log("Exercise details:", exercise);
                console.log("Creating new session...");
                const startTime = new Date().toISOString();
                const { data: session, error: sessionError } = await supabase_1.supabase
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
                if (((performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.source) === "library" ||
                    (performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.source) === "document") &&
                    (performanceMetrics === null || performanceMetrics === void 0 ? void 0 : performanceMetrics.article)) {
                    const article = performanceMetrics.article;
                    const wordRange = performanceMetrics.wordRange;
                    const words = article.content.trim().split(/\s+/);
                    const totalWords = words.length;
                    const validatedTo = Math.min((wordRange === null || wordRange === void 0 ? void 0 : wordRange.to) || 0, totalWords);
                    const validatedFrom = Math.min((wordRange === null || wordRange === void 0 ? void 0 : wordRange.from) || 0, validatedTo);
                    const newWordsFlashed = validatedTo;
                    const newWordCount = validatedTo - validatedFrom;
                    const newLastPosition = validatedTo;
                    const bookId = article.id;
                    const { data: currentProgress, error: progressError } = await supabase_1.supabase
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
                        const { error: updateError } = await supabase_1.supabase
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
                    }
                    else {
                        const { error: createError } = await supabase_1.supabase
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
                console.log("Fetching user progress...");
                const { data: currentProgress, error: progressError } = await supabase_1.supabase
                    .from("user_progress")
                    .select("*")
                    .eq("user_id", userId)
                    .maybeSingle();
                if (progressError && progressError.code === "PGRST116") {
                    console.log("No existing progress found, creating new progress...");
                    const { data: newProgress, error: createError } = await supabase_1.supabase
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
                const newXp = ((currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.xp) || 0) + exercise.xp_reward;
                const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
                const newMaxXp = newLevel * newLevel * 100;
                console.log("Calculated new progress:", {
                    newXp,
                    newLevel,
                    newMaxXp,
                    xpReward: exercise.xp_reward,
                    currentXp: currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.xp,
                });
                console.log("Updating user progress...");
                const { data: updatedProgress, error: updateError } = await supabase_1.supabase
                    .from("user_progress")
                    .upsert({
                    id: currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.id,
                    user_id: userId,
                    level: newLevel,
                    xp: newXp,
                    max_xp: newMaxXp,
                    total_points: ((currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.total_points) || 0) + exercise.xp_reward,
                    streak_count: (currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.last_streak_update) &&
                        new Date().toDateString() ===
                            new Date(currentProgress.last_streak_update).toDateString()
                        ? currentProgress.streak_count
                        : ((currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.streak_count) || 0) + 1,
                    last_streak_update: new Date().toISOString(),
                    highest_streak: Math.max((currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.highest_streak) || 0, (currentProgress === null || currentProgress === void 0 ? void 0 : currentProgress.streak_count) || 0),
                })
                    .select()
                    .maybeSingle();
                if (updateError) {
                    console.error("Error updating progress:", updateError);
                    throw updateError;
                }
                console.log("Progress updated successfully:", updatedProgress);
                return updatedProgress;
            }
            catch (error) {
                console.error("Error in completeExercise mutation:", error);
                (0, supabase_1.handleSupabaseError)(error);
            }
        },
        updateReadingProgress: async (_, { userId, bookId, wordsFlashed, wordCount, lastPosition, }) => {
            try {
                const { data: currentProgress, error: progressError } = await supabase_1.supabase
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
                    console.log("Updating existing reading progress:", currentProgress.id);
                    const { data, error: updateError } = await supabase_1.supabase
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
                }
                else {
                    console.log("Creating new reading progress for user:", userId, "book:", bookId);
                    const { data, error: createError } = await supabase_1.supabase
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
            }
            catch (error) {
                console.error("Error in updateReadingProgress:", error);
                throw error;
            }
        },
    },
    Flow: {
        exercises: async (parent) => {
            const { data, error } = await supabase_1.supabase
                .from("flow_exercises")
                .select("id, sequence_order, exercise:exercises(*)")
                .eq("flow_id", parent.id)
                .order("sequence_order", { ascending: true });
            if (error)
                throw error;
            return data;
        },
    },
};
//# sourceMappingURL=resolvers.js.map