import { FusionRoot } from "@/components/fusion-root";
import { LoadingScreen } from "@/components/loading-screen";

export default function Loading() {
  return (
    <FusionRoot>
      <LoadingScreen label="room" />
    </FusionRoot>
  );
}
