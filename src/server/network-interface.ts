/** Custom ROUDINI stuff */

import { Datex, expose, scope } from "datex-core-legacy/mod.ts";

@scope("network") abstract class network {
	/** get sign and encryption keys for an alias */
    @expose static async get_keys(endpoint: Datex.Endpoint) {
        // console.log("GET keys for " +endpoint)
        const keys = await Datex.Crypto.getExportedKeysForEndpoint(endpoint);
        return keys;
    }
}