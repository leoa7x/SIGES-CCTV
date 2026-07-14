import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

@Injectable()
export class CameraSecretService {
  private readonly key = createHash("sha256")
    .update(process.env.CAMERA_SECRET_KEY ?? process.env.JWT_SECRET ?? "dev_secret_change_me")
    .digest();

  encrypt(plainText: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(cipherText: string): string {
    try {
      const [ivHex, payloadHex] = cipherText.split(":");
      if (!ivHex || !payloadHex) throw new Error("Invalid encrypted camera stream password");

      const decipher = createDecipheriv("aes-256-cbc", this.key, Buffer.from(ivHex, "hex"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(payloadHex, "hex")), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      throw new Error("Unable to decrypt camera stream password");
    }
  }
}
