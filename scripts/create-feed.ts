import { j2xParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync } from 'fs'
import * as moment from 'moment'
import { ArgumentParser } from 'argparse'
import { Podcast, Episode } from './interfaces'

const argparser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description:
    "Create an RSS/XML feed file using a JSON metadata file. The metadata file specified via --input should be in the format of the 'Podcast' interface.",
});

argparser.addArgument(['-i', '--input'], {
  required: true,
  help: 'Input data file (JSON).'
});
argparser.addArgument(['-o', '--output'], {
  required: true,
  help: 'Output RSS/XML file',
})

const args = argparser.parseArgs()

const podcast: Podcast = JSON.parse(readFileSync(args['input'], 'utf8'));

const feed = {
  rss: {
    '@_version': '2.0',
    '@_xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
    //'@_xmlns:sy': 'http://purl.org/rss/1.0/modules/syndication/',,
    '@_xmlns:atom': 'http://www.w3.org/2005/Atom',
    '@_xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
    '@_xmlns:googleplay': 'http://www.google.com/schemas/play-podcasts/1.0',
    channel: {
      title: podcast.title,
      description: podcast.description,
      'itunes:image': {
        '@_href': podcast.imageUrl,
      },
      image: {
        url: podcast.imageUrl,
        title: podcast.title,
        link: podcast.link,
      },
      language: podcast.language || 'en-us',
      'itunes:category': {
        '@_text': podcast.category,
        'itunes:category': {
          '@_text': podcast.subcategory,
        }
      },
      'itunes:explicit': false,
      'itunes:author': podcast.author,
      link: podcast.link,
      'itunes:owner': {
        'itunes:name': podcast.ownerName,
        'itunes:email': podcast.ownerEmail,
      },
      ...(podcast.atomLink && {
        'atom:link': {
          '@_rel': 'self',
          '@_type': 'application/rss+xml',
          '@_href': podcast.atomLink,
        },
      }),
      ...(podcast.type && { 'itunes:type': podcast.type }),
      // TODO: reactivate once needed
      // ...(podcast.complete && { 'itunes:complete': podcast.complete }),

      lastBuildDate: moment.utc().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
      item: podcast.episodes.map(episode => ({
        guid: {
          '@_isPermaLink': false,
          '#text': episode.guid,
        },
        pubDate: episode.pubDate,
        title: episode.title,
        'itunes:title': episode.title,
        'itunes:author': podcast.author,
        description: episode.description,
        ...(episode.contentEncoded && { 'content:encoded': episode.contentEncoded }),
        ...(episode.subtitle && { 'itunes:subtitle': episode.subtitle }),
        enclosure: {
          '@_url': episode.audioUrl,
          '@_length': episode.audioSize,
          '@_type': episode.audioType,
        },
        'itunes:duration': episode.duration || 0,
        'itunes:explicit': false,
        'itunes:episodeType': 'full',
        ...(episode.categories && { category: episode.categories }),
        ...(episode.link && { link: episode.link }),
        ...(episode.episode && { 'itunes:episode': episode.episode }),
        ...(podcast.type && podcast.type === 'serial' && episode.episode && { 'itunes:order': episode.episode }),
        ...(episode.season && { 'itunes:season': episode.season })
      })),
    },
  },
}

const parser = new j2xParser({
  ignoreAttributes: false,
  format: true,
})

const xml = parser.parse(feed)
writeFileSync(args.output, `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`)
