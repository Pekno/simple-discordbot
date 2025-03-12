/**
 * Interface representing a queued API request
 * Used by MainApi to manage request queue and rate limiting
 */
export interface ApiRequest {
	/**
	 * The encoded URL to request
	 */
	url: string;

	/**
	 * Request options including method, headers, data, etc.
	 */
	options: any;

	/**
	 * Promise resolve function to call when the request succeeds
	 */
	resolve: (value: any) => void;

	/**
	 * Promise reject function to call when the request fails
	 */
	reject: (reason?: any) => void;
}
