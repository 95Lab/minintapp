import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { AppId, RuntimeSeedSchema, type RuntimeSeed } from "./contracts";
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
export async function putArtifact(seed: RuntimeSeed, image: string) {
  RuntimeSeedSchema.parse(seed);
  const client = storage();
  try {
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: `apps/${seed.id}/versions/1/manifest.json`,
      Body: JSON.stringify({ seed, image, version: 1 }), ContentType: "application/json" }));
  } finally { client.destroy(); }
}
export async function putBackup(id: string, data: Uint8Array) {
  AppId.parse(id);
  const client = storage();
  try {
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: `apps/${id}/backups/${Date.now()}.json`, Body: data, ContentType: "application/json" }));
  } finally { client.destroy(); }
}
