"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BASE_VIDEO_URL = 'https://www.youtube.com/watch?v=';
// Import utils
const Utils_1 = __importDefault(require("./Utils"));
const parseItem = (item) => {
    const type = Object.keys(item)[0];
    if (type !== 'playlistVideoRenderer')
        return null;
    const info = item.playlistVideoRenderer;
    if (!info ||
        !info.shortBylineText ||
        info.upcomingEventData ||
        !info.isPlayable)
        return null;
    const isLive = info.thumbnailOverlays.some(a => a.thumbnailOverlayTimeStatusRenderer &&
        a.thumbnailOverlayTimeStatusRenderer.style === 'LIVE');
    const author = info.shortBylineText.runs[0];
    return {
        title: Utils_1.default.parseText(info.title),
        id: info.videoId,
        shortUrl: BASE_VIDEO_URL + info.videoId,
        url: new URL(info.navigationEndpoint.commandMetadata.webCommandMetadata.url, BASE_VIDEO_URL).toString(),
        author: {
            url: new URL(author.navigationEndpoint.commandMetadata.webCommandMetadata.url, BASE_VIDEO_URL).toString(),
            channelId: author.navigationEndpoint.browseEndpoint.browseId,
            name: author.text,
        },
        thumbnail: info.thumbnail.thumbnails.sort((a, b) => b.width - a.width)[0]
            .url,
        isLive,
        duration: !info.lengthText ? null : Utils_1.default.parseText(info.lengthText),
    };
};
exports.default = parseItem;
