#!/usr/bin/env node

/*
 * Adds the shared camera credential to imported cameras without writing the
 * secret to source files, manifests, logs, or command output. The production
 * server must retain the same CAMERA_SECRET_KEY or re-encrypt before a key
 * rotation.
 */

const { createCipheriv, createHash, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function encrypt(plainText, keyMaterial) {
  const key = createHash("sha256").update(keyMaterial).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const payload = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${payload.toString("hex")}`;
}

async function main() {
  const username = required("SIGES_CAMERA_DEFAULT_USERNAME");
  const password = required("SIGES_CAMERA_DEFAULT_PASSWORD");
  const cameraKey = required("CAMERA_SECRET_KEY");
  const prisma = new PrismaClient();
  try {
    const cameras = await prisma.camera.findMany({ select: { id: true, streamPasswordEncrypted: true } });
    if (!cameras.length) throw new Error("No cameras found. Import the inventory first.");
    const withoutCredentials = cameras.filter((camera) => !camera.streamPasswordEncrypted);
    await prisma.$transaction(withoutCredentials.map((camera) =>
      prisma.camera.update({
        where: { id: camera.id },
        data: {
          streamUsername: username,
          streamPasswordEncrypted: encrypt(password, cameraKey),
          streamTransport: "TCP",
          previewEnabled: false,
        },
      })
    ));
    console.log(JSON.stringify({
      camerasFound: cameras.length,
      credentialsAdded: withoutCredentials.length,
      credentialsAlreadyPresent: cameras.length - withoutCredentials.length,
      previewEnabled: false,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
