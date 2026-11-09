import { expect, it } from 'vitest';
import {
  DOCUMENT_MAX_BYTES,
  bytesToBase64,
  documentMime,
  matchesMagic,
  validateDocumentMeta,
} from './documentFile';

it('accepts_pdf_jpeg_png_by_type_or_extension', () => {
  expect(documentMime('a.pdf', '')).toBe('application/pdf');
  expect(documentMime('foto.JPG', '')).toBe('image/jpeg');
  expect(documentMime('x', 'image/png')).toBe('image/png');
  expect(documentMime('nota.txt', 'text/plain')).toBeNull();
});

it('rejects_disallowed_type_size_and_name_with_spanish_messages', () => {
  expect(validateDocumentMeta({ name: 'nota.txt', size: 10, type: 'text/plain' })).toMatch(
    /PDF, JPEG o PNG/,
  );
  expect(
    validateDocumentMeta({ name: 'a.pdf', size: DOCUMENT_MAX_BYTES + 1, type: 'application/pdf' }),
  ).toMatch(/máximo/);
  expect(validateDocumentMeta({ name: 'a..pdf', size: 10, type: 'application/pdf' })).toMatch(
    /\.\./,
  );
  expect(validateDocumentMeta({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toMatch(
    /vacío/,
  );
  expect(validateDocumentMeta({ name: 'informe.pdf', size: 10, type: 'application/pdf' })).toBe(
    null,
  );
});

it('checks_magic_bytes_against_the_mime', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4');
  expect(matchesMagic(pdf, 'application/pdf')).toBe(true);
  expect(matchesMagic(pdf, 'image/png')).toBe(false);
});

it('encodes_base64_without_data_url_prefix', () => {
  expect(bytesToBase64(new TextEncoder().encode('%PDF'))).toBe('JVBERg==');
});
