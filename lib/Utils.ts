const DEFAULT_OPTIONS = { limit: Infinity };
const DEFAULT_QUERY = { gl: 'US', hl: 'en' };

const DEFAULT_CONTEXT = {
	client: {
		utcOffsetMinutes: -300,
		gl: 'US',
		hl: 'en',
		clientName: 'WEB',
		clientVersion: '<important information>',
	},
	user: {},
	request: {},
};

const CONSENT_COOKIE = 'SOCS=CAI';

// Import requirements
import { request } from 'undici';

// Import types
import { YtplOptions } from '../';

class UTILS {
	/**
	 * Extracts a substring between two specified delimiters.
	 *
	 * @param {string} haystack - The string to search within.
	 * @param {RegExp | string} left - The left delimiter as a string or RegExp.
	 * @param {string} right - The right delimiter as a string.
	 *
	 * @returns {string} The extracted substring, or an empty string if not found.
	 */
	public between(
		haystack: string,
		left: RegExp | string,
		right: string
	): string {
		let pos: number;

		if (left instanceof RegExp) {
			const match = haystack.match(left);

			if (!match) {
				return '';
			}

			pos = match.index + match[0].length;
		} else {
			pos = haystack.indexOf(left);

			if (pos === -1) {
				return '';
			}

			pos += left.length;
		}

		haystack = haystack.slice(pos);
		pos = haystack.indexOf(right);

		if (pos === -1) {
			return '';
		}

		haystack = haystack.slice(0, pos);

		return haystack;
	}

	/**
	 * Attempts to extract and parse a JSON string between two delimiters.
	 *
	 * @param {string} body - The string to search within.
	 * @param {RegExp | string} left - The left delimiter.
	 * @param {string} right - The right delimiter.
	 * @param {boolean} [addEndCurly=false] - Whether to append '}' to the extracted string.
	 *
	 * @returns {any} The parsed JSON object or `null` if parsing fails.
	 */
	public tryParseBetween(
		body: string,
		left: RegExp | string,
		right: string,
		addEndCurly: boolean = false
	): any {
		try {
			let data = this.between(body, left, right);

			if (!data) return null;
			if (addEndCurly) data += '}';

			return JSON.parse(data);
		} catch (e) {
			return null;
		}
	}

	/**
	 * Parses the response body to extract JSON data and API-related information.
	 *
	 * @param {string} body - The response body as a string.
	 * @param {YtplOptions} [options={}] - Additional options for customization.
	 *
	 * @returns {BodyContext} Extracted JSON data, API key, and request context.
	 */
	public parseBody(body: string, options: YtplOptions = {}): BodyContext {
		const json =
			this.tryParseBetween(body, 'var ytInitialData = ', '};', true) ||
			this.tryParseBetween(body, 'window["ytInitialData"] = ', '};', true) ||
			this.tryParseBetween(body, 'var ytInitialData = ', ';</script>') ||
			this.tryParseBetween(body, 'window["ytInitialData"] = ', ';</script>');

		const apiKey =
			this.between(body, 'INNERTUBE_API_KEY":"', '"') ||
			this.between(body, 'innertubeApiKey":"', '"');

		const clientVersion =
			this.between(body, 'INNERTUBE_CONTEXT_CLIENT_VERSION":"', '"') ||
			this.between(body, 'innertube_context_client_version":"', '"');

		const context = JSON.parse(JSON.stringify(DEFAULT_CONTEXT));
		context.client.clientVersion = clientVersion;

		if (options.gl) context.client.gl = options.gl;
		if (options.hl) context.client.hl = options.hl;
		if (options.utcOffsetMinutes)
			context.client.utcOffsetMinutes = options.utcOffsetMinutes;

		return { json, apiKey, context };
	}

	/**
	 * Extracts text from a `ParseContext` object.
	 *
	 * @param {ParseContext} value - The text data structure.
	 *
	 * @returns {string} The extracted text.
	 */
	public parseText(value: ParseContext): string {
		return value.simpleText || value.runs.map(a => a.text).join('');
	}

	/**
	 * Extracts and converts a numerical value from text.
	 *
	 * @param {ParseContext} value - The text data structure.
	 *
	 * @returns {number} The parsed number.
	 */
	public parseNumFromText(value: ParseContext): number {
		return Number(this.parseText(value).replace(/\D+/g, ''));
	}

	/**
	 * Performs a POST request with the given payload.
	 *
	 * @param {string} url - The URL to send the request to.
	 * @param {YtplOptions} opts - Request options.
	 * @param {PayloadContext} payload - The payload to send.
	 *
	 * @returns {Promise<any>} The JSON response body.
	 */
	public async doPost(
		url: string,
		opts: YtplOptions,
		payload: PayloadContext
	): Promise<any> {
		if (!opts) opts = {};

		const reqOpts = Object.assign({}, opts, {
			method: 'POST',
			body: JSON.stringify(payload),
		});

		return request(url, reqOpts as any).then(r => r.body.json());
	}

	/**
	 * Validates and prepares playlist options.
	 *
	 * @param {string} listId - The playlist ID.
	 * @param {YtplOptions} [options={}] - Additional options.
	 *
	 * @returns {any} The validated options.
	 */
	public checkArgs(listId: string, options: YtplOptions = {}): any {
		if (!listId) {
			throw new Error('Playlist ID is mandatory!');
		}

		if (typeof listId !== 'string') {
			throw new Error('Playlist ID must be of type string!');
		}

		let obj: any = Object.assign({}, DEFAULT_OPTIONS, options);
		if (isNaN(obj.limit) || obj.limit <= 0) obj.limit = DEFAULT_OPTIONS.limit;

		obj.query = Object.assign({}, DEFAULT_QUERY, obj.query, { list: listId });

		if (options && options.gl) obj.query.gl = options.gl;
		if (options && options.hl) obj.query.hl = options.hl;
		if (!options.requestOptions) options.requestOptions = {};

		obj.requestOptions = Object.assign({}, options.requestOptions);
		obj.requestOptions.headers = obj.requestOptions.headers
			? JSON.parse(JSON.stringify(obj.requestOptions.headers))
			: {};

		if (!this.getPropInsensitive(obj.requestOptions.headers, 'user-agent')) {
			this.setPropInsensitive(
				obj.requestOptions.headers,
				'user-agent',
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
					'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36'
			);
		}

		const cookie = this.getPropInsensitive(
			obj.requestOptions.headers,
			'cookie'
		);

		if (!cookie) {
			this.setPropInsensitive(
				obj.requestOptions.headers,
				'cookie',
				CONSENT_COOKIE
			);
		} else if (!cookie.includes('SOCS=')) {
			this.setPropInsensitive(
				obj.requestOptions.headers,
				'cookie',
				`${cookie}; ${CONSENT_COOKIE}`
			);
		}

		return obj;
	}

	/**
	 * Finds a property key in an object, ignoring case.
	 *
	 * @param {Record<string, any>} obj - The object to search.
	 * @param {string} prop - The property name to find.
	 *
	 * @returns {string | null} The found key or `null` if not found.
	 */
	public findPropKeyInsensitive(
		obj: Record<string, any>,
		prop: string
	): string {
		return (
			Object.keys(obj).find(p => p.toLowerCase() === prop.toLowerCase()) || null
		);
	}

	/**
	 * Retrieves a property value from an object, ignoring case.
	 *
	 * @param {Record<string, any>} obj - The object to search.
	 * @param {string} prop - The property name.
	 *
	 * @returns {string | undefined} The property value.
	 */
	public getPropInsensitive(obj: Record<string, any>, prop: string): string {
		const key = this.findPropKeyInsensitive(obj, prop);
		return key && obj[key];
	}

	/**
	 * Sets a property value in an object, ignoring case.
	 *
	 * @param {Record<string, any>} obj - The object to modify.
	 * @param {string} prop - The property name.
	 * @param {any} value - The value to set.
	 *
	 * @returns {string | null} The matched property key, or `null` if not found.
	 */
	public setPropInsensitive(
		obj: Record<string, any>,
		prop: string,
		value: any
	): string {
		const key = this.findPropKeyInsensitive(obj, prop);
		obj[key || prop] = value;
		return key;
	}
}

interface BodyContext {
	json: any;
	apiKey: string;
	context: any;
}

interface ParseContext {
	simpleText: string;
	runs: { text: string }[];
}

interface PayloadContext {
	context: any;
	browseId?: string;
	continuation?: string;
}

export default Object.assign(new UTILS(), {});
