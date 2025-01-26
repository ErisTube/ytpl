import { request } from 'undici';

export interface YtplOptions {
	limit?: number;
	gl?: string;
	hl?: string;
	utcOffsetMinutes?: number;
	requestOptions?: Parameters<typeof request>[1];
}

export interface ParsedItem {
	title: string;
	id: string;
	shortUrl: string;
	url: string;

	author: {
		url: string;
		channelId: string;
		name: string;
	};

	thumbnail: string;
	isLive: boolean;
	duration: string | null;
}

export interface PlaylistItemRenderer {
	title: any;
	videoId: string;
	navigationEndpoint: {
		commandMetadata: {
			webCommandMetadata: { url: string };
		};
	};
	shortBylineText?: {
		runs: {
			text: string;
			navigationEndpoint: {
				commandMetadata: { webCommandMetadata: { url: string } };
				browseEndpoint: { browseId: string };
			};
		}[];
	};
	thumbnail: { thumbnails: { url: string; width: number }[] };
	lengthText?: any;
	isPlayable: boolean;
	upcomingEventData?: any;
	thumbnailOverlays: {
		thumbnailOverlayTimeStatusRenderer?: { style: string };
	}[];
}

export interface YtplResult {
	id: string;
	url: string;
	title: string;
	visibility: 'link only' | 'everyone';
	description: string | null;
	total_items: number;
	views: string;
	last_updated: string;
	author: null | {
		id: string;
		name: string;
		avatar: string;
		user: string | null;
		channel_url: string;
		user_url: string | null;
	};
	items: {
		id: string;
		url: string;
		url_simple: string;
		title: string;
		thumbnail: string;
		duration: string | null;
		author: null | {
			name: string;
			ref: string;
		};
	}[];
}

declare class YTPL {
	/**
	 * Searches for a YouTube playlist by query.
	 *
	 * @param query - The playlist URL or ID.
	 * @param options - The options for the request.
	 * @param rt - The number of retry attempts.
	 *
	 * @returns The parsed playlist data.
	 */
	public search(
		query: string,
		options?: YtplOptions,
		rt?: number
	): Promise<YtplResult>;

	/**
	 * Performs an enhanced search for YouTube playlists based on the given query.
	 *
	 * @param query - The search query for finding YouTube playlists.
	 * @param options - Optional search parameters to customize the request.
	 * @param rt - Number of retry attempts in case of failures.
	 *
	 * @returns Resolves with the search results.
	 */
	public enhancedSearch(
		query: string,
		options?: YtplOptions,
		rt?: number
	): Promise<YtplResult[]>;

	/**
	 * Parses additional playlist pages.
	 *
	 * @param apiKey - The YouTube API key.
	 * @param token - The continuation token.
	 * @param context - The request context.
	 * @param opts - The options for the request.
	 *
	 * @returns The parsed video list.
	 */
	public parsePage2(
		apiKey: string,
		token: string,
		context: any,
		opts: any
	): Promise<any>;

	/**
	 * Extracts the playlist ID from a query.
	 *
	 * @param query - The input query.
	 *
	 * @returns The playlist ID.
	 */
	public getPlaylistId(query: string): Promise<string>;

	/**
	 * Validates if the provided query is a valid playlist ID.
	 *
	 * @param query - The query to validate.
	 *
	 * @returns True if valid, false otherwise.
	 */
	public validateId(query: string): boolean;

	/**
	 * Converts a channel link to a playlist ID.
	 *
	 * @param ref - The channel reference URL.
	 *
	 * @returns The playlist ID.
	 */
	public toChannelList(ref: string): Promise<string>;

	/**
	 * Logs the provided message and writes it to a file.
	 *
	 * @param message - The message to log.
	 */
	public logger(message: string): void;
}

declare const ytpl: YTPL;
export default ytpl;
