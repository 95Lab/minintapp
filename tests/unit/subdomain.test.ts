import {describe,it,expect,vi,afterEach} from "vitest";
import {SubdomainSchema,permittedAppHostname} from "@/lib/api/subdomain-schema";
import {GenerateRequestSchema,TemplateCreateRequestSchema} from "@/engine/api/request-schemas";
import {runtimePublicUrl} from "@/lib/runtime-plane/public-url";
afterEach(()=>vi.unstubAllEnvs());
describe("subdomain validation and navigation",()=>{
 it("normalizes valid names and refuses reserved, nested or random-id names",()=>{
  expect(SubdomainSchema.parse(" My-Workshop ")).toBe("my-workshop");
  for(const name of ["www","api","mail","ingress","dashboard","a".repeat(24),"ab","-bad","bad-","my.app","my_app","https://evil.test","ápp", "a".repeat(41)])expect(SubdomainSchema.safeParse(name).success,name).toBe(false);
  expect(GenerateRequestSchema.parse({prompt:"poll",subdomain:"My-Poll"}).subdomain).toBe("my-poll");
  expect(TemplateCreateRequestSchema.parse({templateId:"topic-poll",subdomain:"my-poll"}).subdomain).toBe("my-poll");
 });
 it("only permits one label in the approved domain",()=>{
  const id="a".repeat(24);expect(permittedAppHostname("my-poll.minintapp.io.vn",id,"minintapp.io.vn")).toBe(true);
  for(const name of ["www.minintapp.io.vn","my-poll.evil.test","nested.my-poll.minintapp.io.vn"])expect(permittedAppHostname(name,id,"minintapp.io.vn")).toBe(false);
 });
 it("uses assigned custom runtime origin while preserving host credentials on the platform",()=>{
  const id="a".repeat(24);vi.stubEnv("PLATFORM_ROLE","runtime");vi.stubEnv("RUNTIME_APP_ID",id);vi.stubEnv("RUNTIME_HOSTNAME","my-poll.minintapp.io.vn");vi.stubEnv("APP_ORIGIN","https://my-poll.minintapp.io.vn");
  expect(runtimePublicUrl(id)).toBe(`https://my-poll.minintapp.io.vn/rooms/${id}`);
  expect(runtimePublicUrl("b".repeat(24))).toBe(`https://minintapp.io.vn/rooms/${"b".repeat(24)}`);
  vi.stubEnv("APP_ORIGIN","https://not-assigned.evil.test");expect(runtimePublicUrl(id)).toBeUndefined();
 });
});
