import Link from "next/link";
import { VideoGetManyOutput } from "../../type";
import { VideoInfo } from "./video-info";
import { VideoThumbnail } from "./video-thumbnail";

interface VideoGridCardProps {
  data: VideoGetManyOutput["items"][number];
  onRemove?: () => void;
}

export const VideoGridCard = ({ data, onRemove }: VideoGridCardProps) => {
  return (
    <div className="flex flex-col w-full group gap-3">
      <Link href={`/videos/${data.id}`} className="relative">
        <VideoThumbnail
          title={data.title}
          duration={data.duration}
          imageUrl={data.thumbnailUrl}
          previewUrl={data.previewUrl}
        />
      </Link>
      <VideoInfo data={data} onRemove={onRemove} />
    </div>
  );
};
