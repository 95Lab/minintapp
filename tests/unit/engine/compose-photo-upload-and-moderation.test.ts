// Photos: the upload route checks the real file type, size and caps; the photo route serves only with a
// valid signature; results show a photo to its author and the host, and to everyone once the host
// approves it — and never a photo id that isn't the answering person's own upload.
import { beforeEach, describe, expect, it } from "vitest";
import { AppSpecSchema, type ComposeBlock } from "@/engine/app-spec/app-spec-schema";
import { examplePhotoContest } from "@/engine/app-spec/app-spec-examples-compose-photo";
import { POST as upload } from "@/app/api/engine/apps/[id]/photos/route";
import { GET as servePhoto } from "@/app/api/engine/apps/[id]/photos/[photoId]/route";
import { appsRepository, participantHashFor, resetMemoryStore } from "@/engine/db/apps-repository";
import { composeBlock } from "@/engine/blocks/compose/compose-block";
import { MAX_PHOTO_BYTES } from "@/engine/blocks/compose/compose-atoms-schema";
import { computeResults } from "@/engine/responses/compute-results";
import type { AppRecord } from "@/engine/db/apps-repository";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const tokenA = "token-aaaaaaaaaaaaaaaa";
const tokenB = "token-bbbbbbbbbbbbbbbb";

let app: AppRecord;
const params = () => ({ params: Promise.resolve({ id: app.id }) });
const photoParams = (photoId: string) => ({ params: Promise.resolve({ id: app.id, photoId }) });
const post = (token: string, body: Uint8Array, block = "photos") =>
  upload(new Request(`http://x/api/engine/apps/${app.id}/photos?block=${block}`, { method: "POST", headers: { "x-participant-token": token, "content-type": "image/png" }, body: new Blob([body as BlobPart]) }), params());

beforeEach(async () => {
  resetMemoryStore();
  ({ app } = await appsRepository().createApp({ spec: AppSpecSchema.parse(structuredClone(examplePhotoContest)), prompt: "t", lifetimeMs: 3_600_000 }));
});

describe("photo upload route", () => {
  it("stores a real image and returns an id tied to the uploader", async () => {
    const res = await post(tokenA, PNG);
    expect(res.status).toBe(200);
    const { photoId } = await res.json();
    expect(photoId).toMatch(new RegExp(`^p-${participantHashFor(app.id, tokenA).slice(0, 12)}-[a-z0-9]{10}$`));
  });

  it("refuses non-images (by content, not header), oversize files and blocks without a photo input", async () => {
    expect((await post(tokenA, new TextEncoder().encode("<svg onload=alert(1)>"))).status).toBe(415);
    expect((await post(tokenA, new Uint8Array(MAX_PHOTO_BYTES + 1))).status).toBe(413);
    expect((await post(tokenA, PNG, "nope")).status).toBe(400);
  });

  it("caps photos per person", async () => {
    for (let i = 0; i < 25; i++) expect((await post(tokenA, PNG)).status).toBe(200);
    const res = await post(tokenA, PNG);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "photo_limit" });
  });
});

describe("photo visibility", () => {
  async function postAnswer(token: string, photoId: string, itemId: string) {
    const outcome = await appsRepository().submitResponse(app.id, {
      blockId: "photos",
      itemId,
      participantHash: participantHashFor(app.id, token),
      displayName: token === tokenA ? "An" : "Bình",
      payload: { kind: "compose", values: { photo: photoId } },
    });
    expect(outcome).toBe("ok");
  }
  const board = async (viewer: { isHost: boolean; participantHash: string | null }) => {
    const current = (await appsRepository().findApp(app.id))!;
    const results = computeResults(current, await appsRepository().listResponses(app.id), viewer)[0];
    const view = results && "views" in results ? results.views[0] : null;
    return view?.kind === "board" ? view.items : [];
  };

  it("shows a photo to its author and the host, to everyone after approval, and serves it only with the signature", async () => {
    const { photoId } = await (await post(tokenA, PNG)).json();
    await postAnswer(tokenA, photoId, "e-a1aaaaaa");
    const author = { isHost: false, participantHash: participantHashFor(app.id, tokenA) };
    const other = { isHost: false, participantHash: participantHashFor(app.id, tokenB) };

    expect(await board(other)).toEqual([]);
    expect((await board(author))[0]).toMatchObject({ approved: false, mine: true });
    const hostItem = (await board({ isHost: true, participantHash: null }))[0];
    expect(hostItem).toMatchObject({ photoId, approved: false });

    // the signed URL serves the bytes; a forged or missing signature gets nothing
    const url = new URL(hostItem.photo!, "http://x");
    const ok = await servePhoto(new Request(url), photoParams(photoId));
    expect(ok.status).toBe(200);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);
    expect((await servePhoto(new Request(`http://x${url.pathname}?s=forged`), photoParams(photoId))).status).toBe(404);
    expect((await servePhoto(new Request(`http://x${url.pathname}`), photoParams(photoId))).status).toBe(404);

    // host approves → everyone sees it (and the participant never learns the photo id)
    const block = app.spec.blocks[0] as ComposeBlock;
    const approve = composeBlock.hostActions!.approve(block, app.runtime, { args: { photoId, on: true }, random: Math.random, answers: [] });
    expect(approve.ok).toBe(true);
    if (approve.ok) await appsRepository().updateApp(app.id, { runtime: approve.runtime });
    const seen = (await board(other))[0];
    expect(seen).toMatchObject({ approved: true, mine: false });
    expect(seen.photoId).toBeUndefined();
  });

  it("gives the host every photo waiting for approval, ahead of the liked ones, with its caption", async () => {
    const { photoId } = await (await post(tokenA, PNG)).json();
    const outcome = await appsRepository().submitResponse(app.id, {
      blockId: "photos",
      itemId: "e-a2aaaaaa",
      participantHash: participantHashFor(app.id, tokenA),
      displayName: "An",
      payload: { kind: "compose", values: { photo: photoId, caption: "Biển chiều" } },
    });
    expect(outcome).toBe("ok");
    const hostItems = await board({ isHost: true, participantHash: null });
    expect(hostItems[0]).toMatchObject({ approved: false, text: "Biển chiều" });
  });

  it("never shows someone else's upload submitted as one's own answer", async () => {
    const { photoId } = await (await post(tokenA, PNG)).json();
    await postAnswer(tokenB, photoId, "e-b1bbbbbb");
    expect(await board({ isHost: true, participantHash: null })).toEqual([]);
  });
});
