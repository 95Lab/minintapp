# App addresses: random and custom

| Mode | Behavior |
| --- | --- |
| Random | Default 24-character hexadecimal app ID; existing apps remain compatible. |
| Custom | Tagged “Advanced feature”, selected during AI confirmation or before template creation. |
| Valid names | 3–40 ASCII letters/digits/hyphens; no leading/trailing hyphen; blocks system names, ID-shaped names and nested labels. |
| Availability | Debounced UI; server checks database and DNS through a bearer-authenticated worker. 30 checks/minute/IP. No Cloudflare token on the web service. |
| Uniqueness | Transaction lock, unique hostname and DNS check before reservation. Idempotent retries preserve the assigned hostname. |
| DNS | CNAME to ingress; update/delete only records marked `minintapp:<app-id>`. Any differently owned record blocks the operation. |
| URLs | Share links, QR and participant redirects use assigned hostnames. Host privileges stay on the platform, with no credentials in cross-origin URLs. |
| Runtime | Receives its assigned hostname through the environment; existing IPs, networks and apps are unaffected. |

The user approved custom DNS names under `*.minintapp.io.vn` in this session. Root, unowned records and ingress are preserved. Renaming after creation and automatic reuse of historic deployment names are not supported. Availability does not reserve a name; creation rechecks it and the worker still refuses to overwrite DNS changed concurrently.

Non-control-plane environments use random names only; direct custom engine requests are rejected. UI supports Vietnamese, English and Japanese. Mocked unit/E2E checks do not create real DNS records.
