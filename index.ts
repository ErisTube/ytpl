const BASE_PLIST_URL = 'https://www.youtube.com/playlist?';
const CHANNEL_ONPAGE_REGEXP = /channel_id=UC([\w-]{22,32})"/;
const BASE_API_URL = 'https://www.youtube.com/youtubei/v1/browse?key=';

const PLAYLIST_REGEX = /^(FL|PL|UU|LL|RD)[a-zA-Z0-9-_]{16,41}$/;
const ALBUM_REGEX = /^OLAK5uy_[a-zA-Z0-9-_]{33}$/;
const CHANNEL_REGEX = /^UC[a-zA-Z0-9-_]{22,32}$/;

const YT_HOSTS = ['www.youtube.com', 'youtube.com', 'music.youtube.com'];

// Import requirements
import axios from 'axios';
import { resolve } from 'path';
import { request } from 'undici';
import { encode } from 'querystring';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

// Import utils
import UTILS from './lib/Utils';
import PARSE_ITEM from './lib/ParseItem';

// Import types
import { ParsedItem, YtplOptions, YtplResult } from '.';

class YTPL {
	/**
	 * Searches for a YouTube playlist by query.
	 *
	 * @param {string} query - The playlist URL or ID.
	 * @param {YtplOptions} [options={}] - The options for the request.
	 * @param {number} [rt=3] - The number of retry attempts.
	 *
	 * @returns {Promise<YtplResult>} The parsed playlist data.
	 */
	public async search(
		query: string,
		options: YtplOptions = {},
		rt: number = 3
	): Promise<YtplResult> {
		const listId = await this.getPlaylistId(query);
		const opts = UTILS.checkArgs(listId, options);

		const ref = BASE_PLIST_URL + encode(opts.query);
		const body = await request(ref, opts.requestOptions).then(r =>
			r.body.text()
		);

		const parsed = UTILS.parseBody(body, opts);

		if (!parsed.json) {
			try {
				let browseId = UTILS.between(body, '"key":"browse_id","value":"', '"');

				if (!browseId) browseId = `VL${listId}`;
				if (!parsed.apiKey || !parsed.context.client.clientVersion)
					throw new Error('Missing api key!');

				parsed.json = await UTILS.doPost(BASE_API_URL + parsed.apiKey, opts, {
					context: parsed.context,
					browseId,
				});
			} catch (e) {}
		}

		if (!parsed.json.sidebar) throw new Error('Unknown Playlist!');

		if (!parsed.json) {
			if (rt === 0) {
				this.logger(body);
				throw new Error('Unsupported playlist!');
			}

			return await this.search(query, opts, rt - 1);
		}

		if (parsed.json.alerts && !parsed.json.contents) {
			let error = parsed.json.alerts.find(
				a => a.alertRenderer && a.alertRenderer.type === 'ERROR'
			);

			if (error) throw new Error(UTILS.parseText(error.alertRenderer.text));
		}

		try {
			const info = parsed.json.sidebar.playlistSidebarRenderer.items.find(
				x => Object.keys(x)[0] === 'playlistSidebarPrimaryInfoRenderer'
			).playlistSidebarPrimaryInfoRenderer;

			const thumbnail = (
				info.thumbnailRenderer.playlistVideoThumbnailRenderer ||
				info.thumbnailRenderer.playlistCustomThumbnailRenderer
			).thumbnail.thumbnails.sort((a, b) => b.width - a.width)[0];

			const resp: YtplResult = {
				id: listId,
				thumbnail,
				url: `${BASE_PLIST_URL}list=${listId}`,
				title: UTILS.parseText(info.title),
				totalItems: UTILS.parseNumFromText(info.stats[0]),
				views:
					info.stats.length === 3 ? UTILS.parseNumFromText(info.stats[1]) : 0,
				items: [],
			};

			const itemSectionRenderer =
				parsed.json.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents.find(
					x => Object.keys(x)[0] === 'itemSectionRenderer'
				);

			if (!itemSectionRenderer) throw Error('Empty playlist!');

			const playlistVideoListRenderer =
				itemSectionRenderer.itemSectionRenderer.contents.find(
					x => Object.keys(x)[0] === 'playlistVideoListRenderer'
				);

			if (!playlistVideoListRenderer) throw Error('Empty playlist!');

			const rawVideoList =
				playlistVideoListRenderer.playlistVideoListRenderer.contents;
			resp.items = rawVideoList.map(PARSE_ITEM).filter(a => a);
			// .filter((_, index) => index < opts.limit);

			opts.limit -= resp.items.length;

			const continuation = rawVideoList.find(
				x => Object.keys(x)[0] === 'continuationItemRenderer'
			);

			let token = null;

			if (continuation)
				token =
					continuation.continuationItemRenderer.continuationEndpoint
						.continuationCommand.token;

			if (!token || opts.limit < 1) return resp;

			const nestedResp = await this.parsePage(
				parsed.apiKey,
				token,
				parsed.context,
				opts
			);

			resp.items.push(...nestedResp);
			return resp;
		} catch (e) {
			if (rt === 0) {
				this.logger(body);
				throw new Error(e);
			}

			return await this.search(query, opts, rt - 1);
		}
	}

	/**
	 * Performs an enhanced search for YouTube playlists based on the given query.
	 *
	 * @param {string} query - The search query for finding YouTube playlists.
	 * @param {YtplOptions} [options={}] - Optional search parameters to customize the request.
	 * @param {number} [rt=3] - Number of retry attempts in case of failures.
	 *
	 * @returns {Promise<YtplResult[]>} Resolves with the search results.
	 */
	public async enhancedSearch(
		query: string,
		options: YtplOptions = {},
		rt: number = 3
	): Promise<YtplResult[]> {
		const q = encodeURIComponent(query);
		const url = `https://www.youtube.com/results?search_query=${q}&sp=EgIQAw%253D%253D`;

		try {
			const response = await axios({
				url,
				method: 'GET',

				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				},
			});

			if (!response.data) {
				return [];
			}

			const regex = /"playlistId":"([^"]+)"/g;
			const matches = [...response.data.matchAll(regex)];
			const ids = matches.map(match => match[1]);
			const filteredIds = [...new Set(ids)].slice(0, options?.limit ?? 10);

			const playlists: YtplResult[] = [];

			for (const playlistId of filteredIds) {
				const playlist = await this.search(playlistId, options, rt);

				if (playlist) {
					playlists.push(playlist);
				}
			}

			return playlists;
		} catch (e) {
			throw new Error(`Unable to find playlists with name '${query}'!`);
		}
	}

	/**
	 * Parses additional playlist pages.
	 *
	 * @param {string} apiKey - The YouTube API key.
	 * @param {string} token - The continuation token.
	 * @param {any} context - The request context.
	 * @param {any} opts - The options for the request.
	 *
	 * @returns {Promise<ParsedItem[]>} The parsed video list.
	 */
	public async parsePage(
		apiKey: string,
		token: string,
		context: any,
		opts: any
	): Promise<ParsedItem[]> {
		const json = await UTILS.doPost(
			BASE_API_URL + apiKey,
			opts.requestOptions,
			{
				context,
				continuation: token,
			}
		);

		if (!json.onResponseReceivedActions) return [];

		const wrapper =
			json.onResponseReceivedActions[0].appendContinuationItemsAction
				.continuationItems;

		const parsedItems = wrapper.map(PARSE_ITEM).filter(a => a);
		// .filter((_, index) => index < opts.limit);

		opts.limit -= parsedItems.length;

		const continuation = wrapper.find(
			x => Object.keys(x)[0] === 'continuationItemRenderer'
		);
		let nextToken = null;

		if (continuation)
			nextToken =
				continuation.continuationItemRenderer.continuationEndpoint
					.continuationCommand.token;

		if (!nextToken || opts.limit < 1) return parsedItems;

		const nestedResp = await this.parsePage(apiKey, nextToken, context, opts);
		parsedItems.push(...nestedResp);

		return parsedItems;
	}

	/**
	 * Extracts the playlist ID from a query.
	 *
	 * @param {string} query - The input query.
	 *
	 * @returns {Promise<string>} The playlist ID.
	 */
	public async getPlaylistId(query: string): Promise<string> {
		if (typeof query !== 'string' || !query) {
			throw new Error('The query has to be a string!');
		}

		if (PLAYLIST_REGEX.test(query) || ALBUM_REGEX.test(query)) {
			return query;
		}

		if (CHANNEL_REGEX.test(query)) {
			return `UU${query.substring(2)}`;
		}

		const parsed = new URL(query, BASE_PLIST_URL);

		if (!YT_HOSTS.includes(parsed.host))
			throw new Error('Not a known youtube link!');

		if (parsed.searchParams.has('list')) {
			const listParam = parsed.searchParams.get('list');

			if (PLAYLIST_REGEX.test(listParam) || ALBUM_REGEX.test(listParam)) {
				return listParam;
			}

			if (listParam && listParam.startsWith('RD')) {
				throw new Error('Mixes not supported!');
			}

			throw new Error('Invalid or unknown list query in url!');
		}

		const p = parsed.pathname.substring(1).split('/');

		if (p.length < 2 || p.some(a => !a)) {
			throw new Error(`Unable to find a id in "${query}"!`);
		}

		const maybeType = p[p.length - 2];
		const maybeId = p[p.length - 1];

		if (maybeType === 'channel') {
			if (CHANNEL_REGEX.test(maybeId)) {
				return `UU${maybeId.substring(2)}`;
			}
		} else if (maybeType === 'user') {
			return await this.toChannelList(
				`https://www.youtube.com/user/${maybeId}`
			);
		} else if (maybeType === 'c') {
			return await this.toChannelList(`https://www.youtube.com/c/${maybeId}`);
		}

		throw new Error(`Unable to find a id in "${query}"!`);
	}

	/**
	 * Validates if the provided query is a valid playlist ID.
	 *
	 * @param {string} query - The query to validate.
	 *
	 * @returns {boolean} True if valid, false otherwise.
	 */
	public validateId(query: string): boolean {
		if (typeof query !== 'string' || !query) {
			return false;
		}

		if (PLAYLIST_REGEX.test(query) || ALBUM_REGEX.test(query)) {
			return true;
		}
		if (CHANNEL_REGEX.test(query)) {
			return true;
		}

		const parsed = new URL(query, BASE_PLIST_URL);

		if (!YT_HOSTS.includes(parsed.host)) return false;

		if (parsed.searchParams.has('list')) {
			const listParam = parsed.searchParams.get('list');

			if (PLAYLIST_REGEX.test(listParam) || ALBUM_REGEX.test(listParam)) {
				return true;
			}

			if (listParam && listParam.startsWith('RD')) {
				return false;
			}

			return false;
		}

		const p = parsed.pathname.substring(1).split('/');
		if (p.length < 2 || p.some(a => !a)) return false;

		const maybeType = p[p.length - 2];
		const maybeId = p[p.length - 1];

		if (maybeType === 'channel') {
			if (CHANNEL_REGEX.test(maybeId)) {
				return true;
			}
		} else if (maybeType === 'user') {
			return true;
		} else if (maybeType === 'c') {
			return true;
		}

		return false;
	}

	/**
	 * Converts a channel link to a playlist ID.
	 *
	 * @param {string} ref - The channel reference URL.
	 *
	 * @returns {Promise<string>} The playlist ID.
	 */
	public async toChannelList(ref: string): Promise<string> {
		const body = await request(ref).then(r => r.body.text());
		const channelMatch = body.match(CHANNEL_ONPAGE_REGEXP);

		if (channelMatch) return `UU${channelMatch[1]}`;
		throw new Error(`Unable to resolve the ref: ${ref}!`);
	}

	/**
	 * Logs the provided message and writes it to a file.
	 *
	 * @param {string} message - The message to log.
	 *
	 * @returns {void}
	 */
	public logger(message: string): void {
		const dir = resolve(__dirname, '../dumps/');
		const file = resolve(
			dir,
			`${Math.random().toString(36).substring(3)}-${Date.now()}.txt`
		);

		const cfg = resolve(__dirname, '../package.json');
		const bugsRef = require(cfg).bugs.url;

		if (!existsSync(dir)) mkdirSync(dir);
		writeFileSync(file, message);

		console.error(`\n/${'*'.repeat(200)}`);
		console.error('Unsupported YouTube Playlist response.');
		console.error(
			`Please post the the files in ${dir} to ErisTube support server or ${bugsRef}. Thanks!`
		);
		console.error(`${'*'.repeat(200)}\\`);

		return null;
	}
}

export default Object.assign(new YTPL(), {});
