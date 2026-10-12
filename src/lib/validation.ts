// Validaciones puras compartidas por cliente y servidor.
// IMPORTANTE: este modulo no debe importar nada de Node ni de librerias de servidor
// (bcryptjs, jsonwebtoken), porque los componentes cliente lo incluyen en su bundle.

// RFC 5321 limita la longitud del correo a 254 caracteres (previene ataques ReDoS)
export const EMAIL_MAX_LENGTH = 254;

// Limita contrasenas excesivas para prevenir sobrecarga de CPU en el hashing de bcrypt
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  if (email.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(email.trim());
}
