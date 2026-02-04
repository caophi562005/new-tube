import { db } from "@/db";
import { videoViews } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

export const videoViewsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;
      const { videoId } = input;

      const [existingVideoViews] = await db
        .select()
        .from(videoViews)
        .where(
          and(eq(videoViews.videoId, videoId), eq(videoViews.userId, userId)),
        );

      if (existingVideoViews) {
        return existingVideoViews;
      }

      const [existingVideoView] = await db
        .select()
        .from(videoViews)
        .where(
          and(
            eq(videoViews.videoId, input.videoId),
            eq(videoViews.userId, userId),
          ),
        );

      if (existingVideoView) {
        throw new TRPCError({
          code: "BAD_REQUEST",
        });
      }

      const [createVideoView] = await db
        .insert(videoViews)
        .values({
          userId,
          videoId,
        })
        .returning();

      return createVideoView;
    }),
});
