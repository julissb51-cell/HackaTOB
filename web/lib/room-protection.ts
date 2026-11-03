/** Salas de la presentación: no se pueden borrar ni desde la app ni desde la base. */
export const PROTECTED_ROOMS: readonly string[] = ["demo", "demo-final", "demo-ensayo", "prueba-f6"];

export function isProtectedRoom(id: string): boolean {
  return PROTECTED_ROOMS.includes(id);
}

export type RoomRemoval = "delete" | "leave" | "protected";

/** Qué puede hacer la persona con la sala desde el menú: borrarla (dueña), salirse, o nada (demo). */
export function removalFor(roomId: string, owner: boolean): RoomRemoval {
  if (owner) return isProtectedRoom(roomId) ? "protected" : "delete";
  return "leave";
}
