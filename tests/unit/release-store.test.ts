import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
const { dbRef } = vi.hoisted(() => ({ dbRef: { value: null as unknown } }));
vi.mock("../../platform/store", () => {
  const query = async (sql: string, params?: unknown[]) => {
    const result = await (dbRef.value as PGlite).query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  return { pool: { query, connect: async () => ({ query, release() {} }) } };
});
import { manageDeployment, completeRelease, release, ensureInitialRelease, specDigest } from "../../platform/release-store";
import { composeSpec } from "@/lib/app-spec/app-spec-examples";
import type { Deployment } from "../../platform/contracts";
const db = new PGlite();
const id = "a".repeat(24), other = "b".repeat(24);
const image1 = `ghcr.io/95lab/minintapp@sha256:${"1".repeat(64)}`, image2 = `ghcr.io/95lab/minintapp@sha256:${"2".repeat(64)}`;
const seed = { id, spec: composeSpec(), prompt: "vote", ownerId: "owner", hostTokenHash: "c".repeat(64), createdAt: 1, expiresAt: Date.now()+60000 };
beforeAll(async () => { dbRef.value = db; await db.exec(await readFile("platform/schema.sql", "utf8")); });
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec("TRUNCATE app_logs,app_releases,deployment_events,artifacts,deployments,workers CASCADE");
  await db.query("INSERT INTO workers(id,agent_url,capacity,available_images) VALUES('worker','http://worker:19090',3,$1)", [[image1,image2]]);
  for (const appId of [id,other]) await db.query(`INSERT INTO deployments(id,owner_id,state,input,seed,host_token_hash,hostname,image,worker_id,expires_at)
    VALUES($1,'owner','RUNNING','{}',$2,$3,$4,$5,'worker',now()+interval '1 hour')`, [appId, { ...seed, id: appId }, seed.hostTokenHash, `${appId}.test`, image1]);
  await ensureInitialRelease({ id, image: image1, seed } as Deployment);
  await db.query("UPDATE app_releases SET status='SUCCEEDED' WHERE app_id=$1",[id]);
  await db.query("UPDATE deployments SET active_version=1 WHERE id=$1", [id]);
});
async function current() { return (await db.query<Deployment>("SELECT * FROM deployments WHERE id=$1",[id])).rows[0]; }
it("creates immutable sequential releases, rejects duplicate/stale requests and promotes only the matching job", async () => {
  await manageDeployment(id,{action:"deploy",image:image2,expectedVersion:1});
  const pending = await current(); expect(pending).toMatchObject({active_version:1,requested_version:2,state:"QUEUED",image:image1,revision:2});
  await expect(manageDeployment(id,{action:"deploy",image:image2,expectedVersion:1})).rejects.toMatchObject({code:"deployment_pending"});
  await db.query("UPDATE deployments SET state='DEPLOYING' WHERE id=$1",[id]);
  const target = (await release(id,2))!;
  await expect(completeRelease({...pending,revision:1},target)).rejects.toThrow("current");
  await completeRelease(pending,target);
  expect(await current()).toMatchObject({active_version:2,requested_version:null,state:"RUNNING",image:image2});
  await expect(manageDeployment(id,{action:"rollback",version:1,expectedVersion:1})).rejects.toMatchObject({code:"invalid_request"});
  await expect(db.query("UPDATE app_releases SET image=$2 WHERE app_id=$1 AND version=1",[id,image2])).rejects.toThrow("Immutable");
});
it("rolls back only to a successful compatible version belonging to this app, and records recovery atomically", async () => {
  await manageDeployment(id,{action:"deploy",image:image2,expectedVersion:1});
  await db.query("UPDATE deployments SET state='DEPLOYING' WHERE id=$1",[id]);
  await completeRelease(await current(),(await release(id,2))!);
  await manageDeployment(id,{action:"rollback",version:1,expectedVersion:2});
  const rollback = (await release(id,3))!; expect(rollback).toMatchObject({image:image1,rollback_of:1,previous_version:2,spec_digest:specDigest(seed)});
  await db.query("UPDATE deployments SET state='DEPLOYING' WHERE id=$1",[id]);
  await completeRelease(await current(),(await release(id,2))!,3);
  expect(await release(id,3)).toMatchObject({status:"FAILED"});
  expect(await current()).toMatchObject({active_version:2,requested_version:null});
  await expect(manageDeployment(other,{action:"rollback",version:1,expectedVersion:1})).rejects.toMatchObject({code:"invalid_request"});
  await db.query("UPDATE app_releases SET status='FAILED' WHERE app_id=$1 AND version=1",[id]);
  await expect(manageDeployment(id,{action:"rollback",version:1,expectedVersion:2})).rejects.toMatchObject({code:"invalid_request"});
});
it("refuses images unavailable on the worker and does not mutate an expired app", async () => {
  await db.query("UPDATE workers SET available_images=$1",[[image1]]);
  await expect(manageDeployment(id,{action:"deploy",image:image2,expectedVersion:1})).rejects.toMatchObject({code:"runtime_unavailable"});
  expect(await current()).toMatchObject({active_version:1,requested_version:null,state:"RUNNING"});
  await db.query("UPDATE deployments SET expires_at=now()-interval '1 second' WHERE id=$1",[id]);
  await expect(manageDeployment(id,{action:"suspend"})).rejects.toMatchObject({code:"app_gone"});
});
it("persists state transition logs without seed, tokens or participant data", async () => {
  await manageDeployment(id,{action:"suspend"});
  const logs = (await db.query("SELECT message FROM app_logs WHERE app_id=$1 ORDER BY id",[id])).rows;
  expect(logs).toEqual([{message:"state: RUNNING"},{message:"state: SUSPENDED"}]);
  expect(JSON.stringify(logs)).not.toContain(seed.hostTokenHash);
});
