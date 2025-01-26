const BASE_VIDEO_URL = 'https://www.youtube.com/watch?v=';

// Import utils
import UTILS from './Utils';

// Import utils
import { ParsedItem, PlaylistItemRenderer } from '../';

const parseItem = (item: Record<string, any>): ParsedItem => {
	const type = Object.keys(item)[0];
	if (type !== 'playlistVideoRenderer') return null;

	const info: PlaylistItemRenderer = item.playlistVideoRenderer;

	if (
		!info ||
		!info.shortBylineText ||
		info.upcomingEventData ||
		!info.isPlayable
	)
		return null;

	const isLive = info.thumbnailOverlays.some(
		a =>
			a.thumbnailOverlayTimeStatusRenderer &&
			a.thumbnailOverlayTimeStatusRenderer.style === 'LIVE'
	);

	const author = info.shortBylineText.runs[0];

	return {
		title: UTILS.parseText(info.title),
		id: info.videoId,
		shortUrl: BASE_VIDEO_URL + info.videoId,
		url: new URL(
			info.navigationEndpoint.commandMetadata.webCommandMetadata.url,
			BASE_VIDEO_URL
		).toString(),
		author: {
			url: new URL(
				author.navigationEndpoint.commandMetadata.webCommandMetadata.url,
				BASE_VIDEO_URL
			).toString(),
			channelId: author.navigationEndpoint.browseEndpoint.browseId,
			name: author.text,
		},
		thumbnail: info.thumbnail.thumbnails.sort((a, b) => b.width - a.width)[0]
			.url,
		isLive,
		duration: !info.lengthText ? null : UTILS.parseText(info.lengthText),
	};
};

export default parseItem;
