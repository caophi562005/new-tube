import { db } from "@/db";
import { commentReactions, comments, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  lt,
  or,
} from "drizzle-orm";
import z from "zod";

export const commentsRouter = createTRPCRouter({
  remove: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [deletedComment] = await db
        .delete(comments)
        .where(and(eq(comments.id, id), eq(comments.userId, userId)))
        .returning();

      if (!deletedComment) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return deletedComment;
    }),

  create: protectedProcedure
    .input(
      z.object({
        videoId: z.uuid(),
        value: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;

      const [createdComment] = await db
        .insert(comments)
        .values({
          userId,
          videoId,
          value: input.value,
        })
        .returning();

      return createdComment;
    }),

  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.uuid(),
        cursor: z
          .object({
            id: z.uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { clerkUserId } = ctx;
      const { videoId, cursor, limit } = input;

      let userId;

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      if (user) {
        userId = user.id;
      }

      const viewerReactions = db.$with("viewer_reactions").as(
        db
          .select({
            commentId: commentReactions.commentId,
            type: commentReactions.type,
          })
          .from(commentReactions)
          .where(inArray(commentReactions.userId, userId ? [userId] : [])),
      );

      const totalData$ = db
        .select({
          count: count(),
        })
        .from(comments)
        .where(eq(comments.videoId, videoId));

      const data$ = db
        .with(viewerReactions)
        .select({
          ...getTableColumns(comments),
          user: users,
          viewerReaction: viewerReactions.type,
          likeCount: db.$count(
            commentReactions,
            and(
              eq(commentReactions.commentId, comments.id),
              eq(commentReactions.type, "like"),
            ),
          ),
          dislikeCount: db.$count(
            commentReactions,
            and(
              eq(commentReactions.commentId, comments.id),
              eq(commentReactions.type, "dislike"),
            ),
          ),
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .leftJoin(viewerReactions, eq(viewerReactions.commentId, comments.id))
        .where(
          and(
            eq(comments.videoId, videoId),
            cursor
              ? or(
                  lt(comments.updatedAt, cursor.updatedAt),
                  and(
                    eq(comments.updatedAt, cursor.updatedAt),
                    lt(comments.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(comments.updatedAt))
        .limit(limit + 1);

      const [data, totalData] = await Promise.all([data$, totalData$]);

      const hashMore = data.length > limit;

      // Remove last element if hasMore is true
      if (hashMore) {
        data.pop();
      }

      // Get next cursor
      const lastItem = data[data.length - 1];
      const nextCursor = hashMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        totalCount: totalData[0].count,
        items: data,
        nextCursor,
      };
    }),
});
