export class CloudflareDNS {
  constructor(private readonly zone: string, private readonly token: string, private readonly target: string,
    private readonly request: typeof fetch = fetch, private readonly writesApproved = false) {}
  private async api(path: string, init?: RequestInit, allowMissing = false) {
    if (init?.method && init.method !== "GET" && !this.writesApproved) throw new Error("DNS writes require explicit approval");
    const response = await this.request(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(this.zone)}/dns_records${path}`, {
      ...init, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
    });
    if (allowMissing && response.status === 404) return null;
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error("Cloudflare DNS operation failed");
    return body.result;
  }
  async available(hostname:string):Promise<boolean>{const records=await this.api(`?name=${encodeURIComponent(hostname)}&per_page=100`);return records.length===0;}
  async ensure(hostname: string, appId: string): Promise<string> {
    const marker = `minintapp:${appId}`;
    const records = await this.api(`?name=${encodeURIComponent(hostname)}&per_page=100`);
    const own = records.find((record: { comment?: string }) => record.comment === marker);
    if (records.length && (!own || records.some((record: {comment?:string})=>record.comment!==marker))) throw new Error("DNS hostname already owned");
    const record = { type: "CNAME", name: hostname, content: this.target, proxied: true, ttl: 1, comment: marker };
    const result = await this.api(own ? `/${own.id}` : "", { method: own ? "PUT" : "POST", body: JSON.stringify(record) });
    return result.id;
  }
  async remove(id: string, appId: string) {
    const record = await this.api(`/${encodeURIComponent(id)}`, undefined, true);
    if (!record) return;
    if (record.comment !== `minintapp:${appId}`) throw new Error("DNS ownership mismatch");
    await this.api(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
