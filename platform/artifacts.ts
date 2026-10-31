import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AppId, ImageDigest, RuntimeSeedSchema, type RuntimeSeed } from "./contracts";
function storage() {
  for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) if (!process.env[key]) throw new Error(`Missing ${key}`);
  return new S3Client({ region: process.env.S3_REGION || "us-east-1", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT,
    maxAttempts: 2, requestHandler: { requestTimeout: 15000, connectionTimeout: 5000 },
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
}
export async function ensureArtifactBucket() {
  const client = storage();
  try {
    try { await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET! })); }
    catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET! }));
    }
  } finally { client.destroy(); }
}
export async function removeArtifacts(id: string) {
  AppId.parse(id); const client = storage();
  try {
    let cursor: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET!, Prefix: `apps/${id}/`, ContinuationToken: cursor }));
      if (page.Contents?.length) {
        const result = await client.send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET!, Delete: { Objects: page.Contents.map((object) => ({ Key: object.Key! })) } }));
        if (result.Errors?.length) throw new Error("Artifact deletion incomplete");
      }
      cursor = page.NextContinuationToken;
    } while (cursor);
  } finally { client.destroy(); }
}
export async function putArtifact(seed: RuntimeSeed, image: string, version = 1) {
  RuntimeSeedSchema.parse(seed); ImageDigest.parse(image);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("Invalid artifact version");
  const client = storage();
  const key = `apps/${seed.id}/versions/${version}/manifest.json`;
  const body = JSON.stringify({ seed, image, version });
  try {
    try { await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key,
      Body: body, ContentType: "application/json", IfNoneMatch: "*" })); }
    catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 412) throw error;
      const existing = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
      const saved = JSON.parse(await existing.Body!.transformToString());
      if (JSON.stringify(saved) !== body) throw new Error("Immutable artifact mismatch");
    }
  } finally { client.destroy(); }
}

export async function putBackup(id: string, data: Uint8Array) {
  AppId.parse(id);
  const client = storage();
  try {
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: `apps/${id}/backups/${Date.now()}.json`, Body: data, ContentType: "application/json" }));
  } finally { client.destroy(); }
}
