# @eristube/ytpl

A light-weight ytpl for [ErisTube](https://github.com/ErisTube). Original [ytpl](https://www.npmjs.com/package/ytpl).
Simple js only package to resolve YouTube Playlists.
Does not require any login or Google-API-Key.

# Installation

```bash
npm install @eristube/ytpl
```

# Usage

```js
const ytpl = require('@eristube/ytpl');

const playlist = await ytpl(
	'https://www.youtube.com/watch?v=OBPLM84zm34&list=PLCihw_MkvN1TDLc6cH3xaSCZXIPCUTg6I'
);
```

# API

### ytpl(id, [options])

Attempts to resolve the given playlist id

- `id`
  - id of the yt-playlist
  - or a playlist url
  - or a user url (resolves to uploaded playlist)
  - or a channel url (resolves to uploaded playlist)
- `options`

  - object with options
  - possible settings:
  - gl[String] -> 2-Digit Code of a Country, defaults to `US` - Allows for localisation of the request
  - hl[String] -> 2-Digit Code for a Language, defaults to `en` - Allows for localisation of the request
  - utcOffsetMinutes[Number] -> Offset in minutes from UTC, defaults to `-300` - Allows for localisation of the request
  - limit[Number] -> limits the pulled items, defaults to 100, set to Infinity to get the whole playlist - numbers <1 result in the default being used
  - requestOptions[Object] -> All additional parameters will get passed to undici's [request options](https://github.com/nodejs/undici#undicirequesturl-options-promise), which is used to do the https requests

### ytpl.validateId(string)

Returns true if able to parse out a (formally) valid playlist ID.

### ytpl.getPlaylistId(string)

Returns a playlist ID from a YouTube URL. Can be called with the playlist ID directly, in which case it resolves.

Returns a promise.

<center><h1>♥ Thanks for using ErisTube ♥</h1></center>
