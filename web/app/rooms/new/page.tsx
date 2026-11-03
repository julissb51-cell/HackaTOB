import { redirect } from "next/navigation";

// "Nueva sala" ahora se crea al instante desde /rooms; este enlace viejo lleva allá.
export default function NewRoomPage() {
  redirect("/rooms");
}
