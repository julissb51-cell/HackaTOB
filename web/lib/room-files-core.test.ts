import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanUrl, contextFiles, detectLinks, kindFromFile, kindFromUrl, parseFileBody, pathBelongsToRoom, storageFileName, type RoomFile } from "./room-files-core";

test("kindFromUrl reconoce Docs, Drive, Figma y PDF", () => {
  assert.equal(kindFromUrl("https://docs.google.com/document/d/abc/edit"), "docs");
  assert.equal(kindFromUrl("https://drive.google.com/drive/folders/x"), "drive");
  assert.equal(kindFromUrl("https://www.figma.com/file/x"), "figma");
  assert.equal(kindFromUrl("https://ejemplo.com/a.pdf?x=1"), "pdf");
  assert.equal(kindFromUrl("https://github.com/a/b"), "link");
  assert.equal(kindFromFile("boceto.PNG"), "image");
  assert.equal(kindFromFile("datos.bin"), "file");
});

test("cleanUrl rechaza esquemas peligrosos y credenciales", () => {
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("https://user:pw@ejemplo.com"), null);
  assert.equal(cleanUrl("https://localhost"), null);
  assert.equal(cleanUrl(" https://ejemplo.com/x "), "https://ejemplo.com/x");
});

test("detectLinks saca enlaces sin puntuación final y sin repetir", () => {
  const text = "Mira https://docs.google.com/document/d/1/edit, y (https://figma.com/file/2). Otra vez https://docs.google.com/document/d/1/edit.";
  assert.deepEqual(detectLinks(text), ["https://docs.google.com/document/d/1/edit", "https://figma.com/file/2"]);
  assert.deepEqual(detectLinks("sin enlaces"), []);
});

test("parseFileBody valida enlaces y subidas", () => {
  assert.deepEqual(parseFileBody({ url: "ftp://x.com" }), { ok: false, error: "url no válida" });
  const link = parseFileBody({ url: "https://figma.com/file/2" });
  assert.ok(link.ok && link.draft.kind === "link" && link.draft.name === "figma.com/file/2");
  assert.deepEqual(parseFileBody({ name: "a.pdf", size: 11 * 1024 * 1024 }), { ok: false, error: "el archivo pasa de 10 MB" });
  const sign = parseFileBody({ name: "a.pdf", size: 100, mime: "application/pdf" });
  assert.ok(sign.ok && sign.step === "sign");
});

test("pathBelongsToRoom exige la carpeta de la sala", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(pathBelongsToRoom(`sala-1/${id}/a.pdf`, "sala-1"), true);
  assert.equal(pathBelongsToRoom(`otra/${id}/a.pdf`, "sala-1"), false);
  assert.equal(pathBelongsToRoom(`sala-1/${id}/../x`, "sala-1"), false);
  assert.equal(storageFileName("Informe final (v2).pdf"), "Informe-final-v2-.pdf");
});

test("contextFiles devuelve los 20 más recientes", () => {
  const files: RoomFile[] = Array.from({ length: 25 }, (_, i) => ({
    id: String(i), kind: "link", name: `n${i}`, url: `https://e.com/${i}`, uploaded: false, size: null, mime: null,
    addedBy: "Ana", addedByUser: null, source: "manual", createdAt: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));
  const out = contextFiles(files);
  assert.equal(out.length, 20);
  assert.equal(out[0].nombre, "n24");
  assert.deepEqual(Object.keys(out[0]), ["nombre", "tipo", "url", "subido", "agregado_por", "origen", "fecha"]);
});
