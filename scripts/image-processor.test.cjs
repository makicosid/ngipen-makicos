const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const sharp = require("sharp");

// Load the existing TypeScript modules for Node's built-in test runner without
// adding another runtime or development dependency.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { processImage } = require(path.join(__dirname, "../lib/image/processor.ts"));
const {
  ImageValidationError,
  validateImage,
} = require(path.join(__dirname, "../lib/image/validation.ts"));

async function makeImage(width, height, format = "jpeg", background = { r: 220, g: 30, b: 50, alpha: 1 }) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background,
    },
  })[format]().toBuffer();
}

async function expectValidationCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ImageValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("poster preset outputs WebP within 600px bounds", async () => {
  const source = await makeImage(1200, 800);
  const result = await processImage(source, "poster", { declaredMimeType: "image/jpeg" });
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.extension, "webp");
  assert.deepEqual([result.width, result.height], [600, 400]);
  assert.ok(result.size > 0);
});

test("rental preset outputs WebP within 500px bounds", async () => {
  const source = await makeImage(1200, 800);
  const result = await processImage(source, "rental", { declaredMimeType: "image/jpeg" });
  assert.deepEqual([result.width, result.height], [500, 333]);
});

test("avatar preset crops to 256x256", async () => {
  const source = await makeImage(600, 400);
  const result = await processImage(source, "avatar", { declaredMimeType: "image/jpeg" });
  assert.deepEqual([result.width, result.height], [256, 256]);
});

test("documentation preset outputs WebP within 600px bounds", async () => {
  const source = await makeImage(1200, 800);
  const result = await processImage(source, "documentation", { declaredMimeType: "image/jpeg" });
  assert.deepEqual([result.width, result.height], [600, 400]);
});

test("PNG transparency is preserved in WebP output", async () => {
  const source = await makeImage(320, 200, "png", { r: 0, g: 0, b: 0, alpha: 0 });
  const result = await processImage(source, "poster", { declaredMimeType: "image/png" });
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.hasAlpha, true);
});

test("JPEG, PNG, and WebP signatures are detected", async () => {
  for (const [format, mime] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ]) {
    const source = await makeImage(32, 24, format);
    const result = await validateImage(source, { declaredMimeType: mime });
    assert.equal(result.mimeType, mime);
  }
});

test("rejects unsupported file signatures", async () => {
  await expectValidationCode(validateImage(Buffer.from("not an image")), "UNSUPPORTED_FORMAT");
});

test("rejects a declared MIME type that differs from file bytes", async () => {
  const source = await makeImage(32, 24, "jpeg");
  await expectValidationCode(
    validateImage(source, { declaredMimeType: "image/png" }),
    "MIME_MISMATCH",
  );
});

test("rejects files above the configured byte limit", async () => {
  const source = await makeImage(32, 24);
  await expectValidationCode(validateImage(source, { maxBytes: 10 }), "FILE_TOO_LARGE");
});

test("rejects images above the configured pixel limit", async () => {
  const source = await makeImage(300, 200);
  await expectValidationCode(validateImage(source, { maxPixels: 1000 }), "IMAGE_TOO_LARGE");
});

test("rejects corrupt image data with a supported signature", async () => {
  const corruptJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
  await expectValidationCode(validateImage(corruptJpeg), "INVALID_IMAGE");
});
