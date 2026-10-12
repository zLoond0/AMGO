// Secreto fijo y exclusivo de pruebas. Jest no carga .env.local, y el código de
// producción no tiene ningún valor por defecto.
process.env.JWT_SECRET = "secreto-de-pruebas-jest-solo-para-tests-0123456789";
process.env.DATABASE_URL = "file:./test.db";
