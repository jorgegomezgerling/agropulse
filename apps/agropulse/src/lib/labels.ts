import type { CommandAction, CommandStatus, Role } from "@/types";

export const roleLabels: Record<Role, string> = {
  producer: "Productor",
  operator: "Operador de riego",
  advisor: "Asesor",
};

export const commandStatusLabels: Record<CommandStatus, string> = {
  pending: "Pendiente",
  applied: "Aplicado",
  failed: "Falló",
  cancelled: "Cancelado",
};

export function commandActionLabel(
  action: CommandAction,
  durationMin: number | null,
): string {
  if (action === "open") return "Abrir";
  if (action === "close") return "Cerrar";
  return `Regar ${durationMin ?? "?"} min`;
}
