# HTTP Tunneling

UIX provides [HTTP tunneling over DATEX](./Glossary.md#http-over-datex) per default.
When you start a UIX app, it is instantly available via a unique `unyt.app` domain,
using the endpoint name as a subdomain.

Examples:
 * anonymous endpoint `@@FB20DCCA0C0000000060B778C8E51D44` -> https://FB20DCCA0C0000000060B778C8E51D44.unyt.app
 * endpoint `@example` -> https://example.unyt.app

HTTP Tunneling can be disabled by starting the UIX app with `--http-over-datex=false`.


> [!NOTE]
> We don't recommend to use HTTP tunneling for production.
> There are rate limits and transmission delays, leading to longer page
> loading times. Traffic is encrypted, but can in theory be read and modified
> by the unyt.app relay endpoint.<br>
> You can still use your custom `unyt.app` domain (or other domains that you own)
> when deploying your app on a [docker host](./11%20Deployment.md#remote-docker-hosts)
