// Llena la sala demo-final con una conversación de ejemplo y pide el análisis.
// Antes: ejecutar supabase/seed-demo-final.sql (crea la sala y los miembros).
// Uso: node scripts/seed-demo-final.mjs
// Variables opcionales: ENLAZA_URL, ENLAZA_ROOM, ENLAZA_TOKEN.

const BASE = (process.env.ENLAZA_URL || "https://enlaza-green.vercel.app").replace(/\/$/, "");
const ROOM = process.env.ENLAZA_ROOM || "demo-final";
const TOKEN = process.env.ENLAZA_TOKEN || "demo-hackatob";

const ANA = { miembro: "Ana", ia: "chatgpt", conversation_id: "ana_informe", nombre_chat: "Informe biblioteca" };
const LUIS = { miembro: "Luis", ia: "gemini", conversation_id: "luis_codigo", nombre_chat: "Código biblioteca" };

const script = [
  [ANA, "prompt", "Estoy haciendo el informe escrito de un sistema de gestión de biblioteca para el curso de Programación. Ayúdame con la introducción y el objetivo general."],
  [ANA, "respuesta", "Introducción: Las bibliotecas universitarias necesitan registrar libros, usuarios y préstamos. Objetivo general: desarrollar un sistema en Python que permita registrar libros, socios y préstamos, y consultar qué libros están disponibles."],
  [LUIS, "prompt", "Voy a programar un sistema de biblioteca en Python. Escríbeme la lista de requisitos funcionales y un diagrama de clases para empezar."],
  [LUIS, "respuesta", "Requisitos: RF1 registrar libros, RF2 registrar socios, RF3 prestar un libro, RF4 devolver un libro, RF5 buscar por título o autor. Clases: Libro(isbn, titulo, autor, disponible), Socio(id, nombre, correo), Prestamo(libro, socio, fecha_prestamo, fecha_devolucion), Biblioteca(gestiona todo)."],
  [ANA, "prompt", "Ahora escribe la sección de requisitos funcionales del informe y descríbeme el diagrama de clases para dibujarlo."],
  [ANA, "respuesta", "Requisitos funcionales: registrar libros, registrar usuarios, realizar préstamos, registrar devoluciones y buscar libros. Diagrama de clases: Libro, Usuario, Prestamo y Catalogo, con Catalogo agregando muchos Libro y Prestamo relacionando un Usuario con un Libro."],
  [LUIS, "prompt", "Quiero guardar los datos en una base SQLite. Dame el script para crear las tablas libros, socios y prestamos."],
  [LUIS, "respuesta", "CREATE TABLE libros (isbn TEXT PRIMARY KEY, titulo TEXT, autor TEXT, disponible INTEGER DEFAULT 1); CREATE TABLE socios (id INTEGER PRIMARY KEY, nombre TEXT, correo TEXT); CREATE TABLE prestamos (id INTEGER PRIMARY KEY, isbn TEXT REFERENCES libros, socio_id INTEGER REFERENCES socios, fecha_prestamo TEXT, fecha_devolucion TEXT). Usa el módulo sqlite3 de Python y un archivo biblioteca.db."],
  [ANA, "prompt", "Redacta la sección de diseño del informe: cómo se guardan los datos del sistema."],
  [ANA, "respuesta", "Diseño de persistencia: los datos se guardan en un archivo datos.json con tres listas (libros, usuarios y prestamos). Al iniciar, el programa lee el JSON y al salir lo vuelve a escribir. Se eligió JSON porque no requiere instalar un motor de base de datos."],
  [LUIS, "prompt", "Escríbeme la función prestar_libro(isbn, socio_id) usando sqlite3 que verifique que el libro esté disponible."],
  [LUIS, "respuesta", "def prestar_libro(conn, isbn, socio_id):\n    cur = conn.execute('SELECT disponible FROM libros WHERE isbn = ?', (isbn,))\n    fila = cur.fetchone()\n    if not fila or fila[0] == 0:\n        raise ValueError('Libro no disponible')\n    conn.execute('UPDATE libros SET disponible = 0 WHERE isbn = ?', (isbn,))\n    conn.execute(\"INSERT INTO prestamos (isbn, socio_id, fecha_prestamo) VALUES (?, ?, date('now'))\", (isbn, socio_id))\n    conn.commit()"],
  [ANA, "prompt", "¿Qué secciones me faltan para entregar el informe el viernes? Ya tengo introducción, requisitos y diseño."],
  [ANA, "respuesta", "Te faltan: conclusiones, bibliografía y referencias al código final. El enunciado del curso también suele pedir un plan de pruebas con casos de prueba y un manual de usuario; confirma con tu compañero quién los hace."],
];

async function post(path, body) {
  const res = await fetch(`${BASE}/api/rooms/${ROOM}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-room-token": TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return text;
}

const start = Date.now() - script.length * 4 * 60_000;
const run = Date.now().toString(36);
for (const [index, [who, tipo, texto]] of script.entries()) {
  await post("/events", {
    event_id: `demofinal_${run}_${String(index + 1).padStart(2, "0")}`,
    tipo,
    ...who,
    proyecto: "Sistema de gestión de biblioteca",
    texto,
    tiempo: new Date(start + index * 4 * 60_000).toISOString(),
  });
  console.log(`evento ${index + 1}/${script.length} ok (${who.miembro} ${tipo})`);
}

console.log("análisis:", await post("/analyze"));
console.log(`Sala: ${BASE}/join/${ROOM}?t=${TOKEN}`);
