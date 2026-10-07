function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error ?? "");
}

export function isNetworkError(error: unknown): boolean {
  const message = messageOf(error).toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network error")
  );
}

// Traduce errores de Supabase y de nuestros RPC a mensajes para el usuario
export function friendlyError(error: unknown): string {
  const message = messageOf(error);
  if (isNetworkError(error))
    return "Sin conexión con el servidor. Revisá tu red y reintentá.";
  if (message.includes("Invalid login credentials"))
    return "Email o contraseña incorrectos.";
  if (message.includes("Email not confirmed"))
    return "El usuario no está confirmado en Supabase.";
  if (message.includes("VALVE_BUSY"))
    return "Ya hay un comando pendiente en esta válvula. Esperá a que se aplique o cancelalo.";
  if (message.includes("FORBIDDEN"))
    return "Tu rol no tiene permiso para esta acción.";
  if (message.includes("INVALID_DURATION"))
    return "La duración tiene que estar entre 1 y 120 minutos.";
  if (message.includes("NOT_PENDING"))
    return "Ese comando ya no está pendiente.";
  if (message.includes("NOT_FOUND"))
    return "No se encontró el elemento. Puede que no pertenezca a tu establecimiento.";
  if (message.includes("JWT expired"))
    return "Tu sesión venció. Volvé a iniciar sesión.";
  return message || "Ocurrió un error inesperado.";
}
