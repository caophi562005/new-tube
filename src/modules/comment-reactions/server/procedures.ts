import { db } from "@/db";
import { commentReactions } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";

export const commentReactionsRouter = createTRPCRouter({
  like: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { commentId } = input;

      const [existingCommentReactionLike] = await db
        .select()
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, userId),
            eq(commentReactions.type, "like"),
          ),
        );

      if (existingCommentReactionLike) {
        const [deletedCommentReaction] = await db
          .delete(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, commentId),
              eq(commentReactions.userId, userId),
            ),
          )
          .returning();

        return deletedCommentReaction;
      }

      const [createCommentReaction] = await db
        .insert(commentReactions)
        .values({
          userId,
          commentId,
          type: "like",
        })
        .onConflictDoUpdate({
          target: [commentReactions.userId, commentReactions.commentId],
          set: {
            type: "like",
          },
        })
        .returning();

      return createCommentReaction;
    }),

  dislike: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { commentId } = input;

      const [existingCommentReactionDislike] = await db
        .select()
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, userId),
            eq(commentReactions.type, "dislike"),
          ),
        );

      if (existingCommentReactionDislike) {
        const [deletedCommentReaction] = await db
          .delete(commentReactions)
          .where(
            and(
              eq(commentReactions.commentId, commentId),
              eq(commentReactions.userId, userId),
            ),
          )
          .returning();

        return deletedCommentReaction;
      }

      const [createCommentReaction] = await db
        .insert(commentReactions)
        .values({
          userId,
          commentId,
          type: "dislike",
        })
        .onConflictDoUpdate({
          target: [commentReactions.userId, commentReactions.commentId],
          set: {
            type: "dislike",
          },
        })
        .returning();

      return createCommentReaction;
    }),
});
