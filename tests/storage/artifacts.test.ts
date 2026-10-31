import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { S3Client, GetObjectCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { ensureArtifactBucket, putArtifact, putBackup, removeArtifacts } from "../../platform/artifacts";
import { composeSpec } from "../../src/lib/app-spec/app-spec-examples";
it("stores private version manifests and SQLite backups and deletes only the selected app prefix", async () => {
  process.env.S3_ENDPOINT = "http://127.0.0.1:19009";
  process.env.S3_ACCESS_KEY_ID = "minint-integration";
  process.env.S3_SECRET_ACCESS_KEY = "only-local-testing-123456789";
  process.env.S3_BUCKET = `minint-test-${randomBytes(6).toString("hex")}`;
  const id = randomBytes(12).toString("hex"), other = randomBytes(12).toString("hex");
  const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  try {
    await ensureArtifactBucket();
    const seed = { id, spec: composeSpec(), prompt: "storage test", ownerId: "test", hostTokenHash: "a".repeat(64), createdAt: Date.now(), expiresAt: Date.now()+60000 };
    await putArtifact(seed, `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`);
    await putArtifact({ ...seed, id: other }, `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`);
    const saved = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `apps/${id}/versions/1/manifest.json` }));
    expect(JSON.parse(await saved.Body!.transformToString()).seed.id).toBe(id);
    await putBackup(id, new Uint8Array([1,2,3]));
    await removeArtifacts(id);
    await expect(client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `apps/${id}/versions/1/manifest.json` }))).rejects.toThrow();
    const retained = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `apps/${other}/versions/1/manifest.json` }));
    expect(retained.ContentType).toBe("application/json");
  } finally {
    await removeArtifacts(id); await removeArtifacts(other);
    await client.send(new DeleteBucketCommand({ Bucket: process.env.S3_BUCKET }));
    client.destroy();
  }
});

it("keeps version manifests immutable while permitting an identical retry", async () => {
  process.env.S3_ENDPOINT = "http://127.0.0.1:19009";
  process.env.S3_ACCESS_KEY_ID = "minint-integration";
  process.env.S3_SECRET_ACCESS_KEY = "only-local-testing-123456789";
  process.env.S3_BUCKET = `minint-version-test-${randomBytes(6).toString("hex")}`;
  const id = randomBytes(12).toString("hex");
  const seed = { id,spec:composeSpec(),prompt:"version test",ownerId:"test",hostTokenHash:"a".repeat(64),createdAt:Date.now(),expiresAt:Date.now()+60000 };
  const image = `ghcr.io/95lab/minintapp@sha256:${"a".repeat(64)}`;
  const client = new S3Client({endpoint:process.env.S3_ENDPOINT,region:"us-east-1",forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});
  try {
    await ensureArtifactBucket();
    await putArtifact(seed,image,2); await putArtifact(seed,image,2);
    await expect(putArtifact(seed,`ghcr.io/95lab/minintapp@sha256:${"b".repeat(64)}`,2)).rejects.toThrow("Immutable");
    const saved = await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:`apps/${id}/versions/2/manifest.json`}));
    expect(JSON.parse(await saved.Body!.transformToString())).toMatchObject({version:2,image});
  } finally { await removeArtifacts(id);await client.send(new DeleteBucketCommand({Bucket:process.env.S3_BUCKET}));client.destroy(); }
});
