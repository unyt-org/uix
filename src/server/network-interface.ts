/** Custom ROUDINI stuff */

import { Datex } from "datex-core-legacy/mod.ts";

@endpoint export abstract class network {
	/** get sign and encryption keys for an alias */
    @property static async get_keys(endpoint: Datex.Endpoint) {
        // console.log("GET keys for " +endpoint)
        const keys = await Datex.Crypto.getExportedKeysForEndpoint(endpoint);
        return keys;
    }
}