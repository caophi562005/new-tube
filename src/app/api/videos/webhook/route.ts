import { db } from "@/db";
import { videos } from "@/db/schema";
import { mux } from "@/lib/mux";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from "@mux/mux-node/resources/webhooks";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { UTApi } from "uploadthing/server";

const SIGNING_SECRET = process.env["MUX_WEBHOOK_SECRET"];

type WebhookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export async function POST(req: NextRequest) {
  if (!SIGNING_SECRET) {
    throw new Error("Missing MUX_WEBHOOK_SECRET");
  }

  const headersPayload = await headers();
  const muxSignature = headersPayload.get("Mux-Signature");

  if (!muxSignature) {
    return new Response("No signature found", { status: 401 });
  }

  const payload = await req.json();

  const body = JSON.stringify(payload);

  mux.webhooks.verifySignature(
    body,
    {
      "mux-signature": muxSignature,
    },
    SIGNING_SECRET,
  );

  switch (payload.type as WebhookEvent["type"]) {
    case "video.asset.created": {
      const data = payload.data as VideoAssetCreatedWebhookEvent["data"];
      if (!data.upload_id) {
        return new Response("No upload_id found", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxAssetId: data.id,
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.ready": {
      const data = payload.data as VideoAssetReadyWebhookEvent["data"];
      const playbackId = data.playback_ids?.[0].id;

      if (!data.upload_id) {
        return new Response("No upload_id found", { status: 400 });
      }

      if (!playbackId) {
        return new Response("No playback_id found", { status: 400 });
      }

      const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.png`;
      const tempPreviewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
      const duration = data.duration ? Math.round(data.duration * 1000) : 0;

      const utapi = new UTApi();
      const [uploadedThumbnailUrl, uploadedPreviewUrl] =
        await utapi.uploadFilesFromUrl([tempThumbnailUrl, tempPreviewUrl]);

      if (!uploadedThumbnailUrl.data || !uploadedPreviewUrl.data) {
        return new Response("Failed to upload thumbnail or preview", {
          status: 500,
        });
      }

      const { key: thumbnailKey, ufsUrl: thumbnailUrl } =
        uploadedThumbnailUrl.data;
      const { key: previewKey, ufsUrl: previewUrl } = uploadedPreviewUrl.data;

      await db
        .update(videos)
        .set({
          muxStatus: data.status,
          muxPlaybackId: playbackId,
          muxAssetId: data.id,
          thumbnailKey,
          previewKey,
          thumbnailUrl,
          previewUrl,
          duration,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.errored": {
      const data = payload.data as VideoAssetErroredWebhookEvent["data"];

      if (!data.upload_id) {
        return new Response("No upload_id found", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.deleted": {
      const data = payload.data as VideoAssetDeletedWebhookEvent["data"];

      if (!data.upload_id) {
        return new Response("No upload_id found", { status: 400 });
      }

      await db.delete(videos).where(eq(videos.muxUploadId, data.upload_id));
      break;
    }

    case "video.asset.track.ready": {
      const data = payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
        asset_id: string;
      };

      // Typescript doesn't know that asset_id is defined
      const assetId = data.asset_id;
      const trackId = data.id;
      const status = data.status;

      if (!assetId) {
        return new Response("No asset_id found", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxTrackStatus: status,
          muxTrackId: trackId,
          muxAssetId: assetId,
        })
        .where(eq(videos.muxAssetId, assetId));
      break;
    }

    default:
      break;
  }

  return new Response(null, { status: 200 });
}
