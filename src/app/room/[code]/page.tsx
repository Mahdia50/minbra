import type { Metadata } from "next";
import { RoomClient } from "./RoomClient";

export const metadata: Metadata = {
  title: "الغرفة",
};

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
