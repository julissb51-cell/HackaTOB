# Ensayo local: JSON contra SQLite

Muestra para practicar el aviso de contradicción y la corrección. **No es la presentación ni una sala de producción.** No crea cuentas, no borra datos y no manda eventos a https://enlaza-green.vercel.app.

Los textos viven en `web/fixtures/biblioteca-json-sqlite.json`. `web/lib/demo-biblioteca.test.ts` los corre con el analista de reglas, sin Gemini y sin navegador. Eso no reemplaza una prueba manual en ChatGPT, Gemini o Claude con la extensión conectada.

## Quién hace qué

| Persona | Parte | IA de la muestra |
|---|---|---|
| Ana | Informe escrito | ChatGPT |
| Luis | Código | Gemini |
| Sofía | Presentación | no entra en este choque |

Sala de la muestra: tema «Sistema de gestión de biblioteca (muestra)», entrega `2026-11-06`.

## 1. El choque

Luis, en Gemini, envía:

> Quiero guardar los datos de la biblioteca en SQLite. Dame el script para crear las tablas libros, socios y prestamos.

La respuesta de la muestra dice que use `sqlite3` y `biblioteca.db`, y trae `CREATE TABLE` de libros, socios y prestamos.

Ana, en ChatGPT, envía:

> Redacta la sección de diseño del informe: cómo se guardan los datos del sistema de biblioteca.

La respuesta de la muestra dice que los datos van en `datos.json` y que se eligió JSON.

### Qué debe pasar

Sin llamar a Gemini (la prueba tira un error a propósito):

- Hay una **contradicción** para **Ana** y otra para **Luis**. Las dos nombran JSON y SQLite.
- El contexto de Ana incluye su contradicción y su parte «Informe escrito». No incluye un aviso cuyo destinatario sea solo Luis.
- El avance descuenta al menos 3 puntos por esa contradicción.
- Si el análisis guardado viene de reglas, el resumen del contexto sigue siendo el cálculo local. Los avisos de esa persona sí se conservan.

## 2. La corrección

Ana envía este prompt:

> Corrige el diseño: ya no usamos datos.json. Los datos van en SQLite, en biblioteca.db, igual que el código de Luis.

La respuesta de la muestra cierra así: se deja `datos.json` y la persistencia queda en SQLite.

### Qué debe pasar

La decisión vigente es la del mensaje más reciente de cada persona, no la tecnología que más se repitió antes. Como el cierre de Ana nombra SQLite al final, **ya no hay contradicción de almacenamiento** entre Ana y Luis.

## Lo que esta muestra no prueba

- No abre ChatGPT, Gemini ni Claude.
- No inicia sesión en la web publicada.
- No inserta filas en Supabase.
- Copilot no entra en este ensayo.
