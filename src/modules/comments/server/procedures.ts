import { db } from "@/db";
import { comments, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
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
    .query(async ({ input }) => {
      const { videoId, cursor, limit } = input;

      const totalData$ = db
        .select({
          count: count(),
        })
        .from(comments)
        .where(eq(comments.videoId, videoId));

      const data$ = db
        .select({
          ...getTableColumns(comments),
          user: users,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
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
