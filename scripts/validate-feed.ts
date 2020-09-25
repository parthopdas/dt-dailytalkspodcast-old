import { ArgumentParser } from 'argparse'
import { parse } from 'fast-xml-parser'
import { readFileSync } from 'fs'
import * as assert from 'assert'
import * as _ from 'lodash'
import * as EmailValidator from 'email-validator'
import * as rq from 'superagent'
import * as moment from 'moment'

const iso6392 = require('iso-639-2').
const ITUNES_CATEGORIES = require('./itunes-categories.json')

const parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'Validate a RSS podcast feed. This script reads a feed file and applies various tests of formality and consistency, i.e. checking like the existence of required tags, correct data type or allowed values of tags. It fails with an exit code of 0 if no errors were found and 1 otherwise. Provide --strict to fail validation if unhandled tags were discovered.'
});

parser.addArgument(
  [ '-i', '--input' ],
  { help: 'Input RSS-Feed XML file.' }
);

parser.addArgument(
  [ '--strict' ],
  {
    action: 'storeTrue',
    help: 'Set this in order to fail if unhandled tags occur in the feed.'
  }
);

const args = parser.parseArgs();

const feed = parse(
  readFileSync(args['input'], { encoding: 'utf8' }),
  { ignoreAttributes: false }
);

/**
 * Helper Functions
 */

/**
 * Check if string is valid default string.
 */
function checkDefaultString(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.doesNotMatch(s, /^ /gi, `${fieldName} must not start with leading space.`);
  assert.doesNotMatch(s, / $/gi, `${fieldName} must not start with trailing space.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  assert.notEqual(s.length > 255, `${fieldName} must not have more than 255 characters.`);
}

/**
 * Check if natural number.
 */
function checkNatural(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'number', `${fieldName} must be a number.`);
  assert.equal(s > 0, true, `${fieldName} must be a positive number.`);
}

/**
 * Check if natural number >= 0.
 */
function checkNumberString(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.equal(isNaN(parseInt(s, 10)), false, `${fieldName} is not a valid number string.`);
  assert.equal(parseInt(s, 10) >= 0, true, `${fieldName} must be a positive number or zero.`);
}

/**
 * Check if string is valid description.
 */
function checkDescriptionString(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.doesNotMatch(s, /^ /gi, `${fieldName} must not start with leading space.`);
  assert.doesNotMatch(s, / $/gi, `${fieldName} must not start with trailing space.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  assert.notEqual(s.length > 4000, `${fieldName} must not have more than 255 characters.`);
}

/**
 * Check if string is correctly CDATA formatted
 */
function checkCDATAString(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  assert.equal(s.slice(0, 9), '<![CDATA[', `${fieldName} must start with '<![CDATA[' if it's CDATA.`);
  assert.equal(s.slice(9, -3), ']]>', `${fieldName} must end with ']]>' if it's CDATA.`);
  assert.equal(s.slice(9, -3).indexOf(']]>'), -1, `${fieldName} must not include ']]>' in it's content.`);
}

/**
 * Check if string is date in RFC 822 format.
 * ref: https://gist.github.com/MatthewBarker/25f21f70d5f98a71fa737d94010eec65
 */
function checkDate(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  const DATE_FORMATS = ['ddd, DD MMM YYYY HH:mm:ss ZZ', 'ddd, DD MMM YY HH:mm:ss ZZ'];
  const parsed = moment(s, DATE_FORMATS, true);
  assert.equal(parsed.isValid(), true, `${fieldName} is not properly formatted date.`);
}

/**
 * Check if valid iso language.
 */
function checkLanguage(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  assert.match(s, /^[a-z]{2}(|-[a-zA-Z]{2})$/g, `${fieldName} has not the proper format of a language code.`);

  const ISO_CODES = iso6392.map(({ iso6391 }) => iso6391);
  assert.notEqual(ISO_CODES.indexOf(s.slice(0, 2)), -1, `${fieldName} does not start with a valid language code.`)
}

/**
 * Check if valid url
 */
function checkUrlFormat(s: any, fieldName = 'Unknown', expectedExtensions = []) {
  assert.equal(typeof s, 'string', `${fieldName} must be a string.`);
  assert.equal(s.length > 0, true, `${fieldName} is an empty string.`);
  assert.equal(s.slice(0, 8), 'https://', `${fieldName} must start with 'https://'.`);

  if (expectedExtensions.length > 0) {
    assert.match(s, new RegExp(`(${expectedExtensions.join('|')})$`), `${fieldName} must end with one of the extensions ${expectedExtensions.join(',')}.`);
  }
}

/**
 * Check if valid url and can be reached.
 */
async function checkUrlExists(s: any, fieldName = 'Unknown', expectedExtension = [], expectedContentTypes = []) {
  checkUrlFormat(s, fieldName, expectedExtension);

  // special case if validation in pipeline before deployment
  if (process.env.CI && (process.env.NODE_ENV === 'test' || s.startsWith(process.env.PUBLIC_URL_BASE))) {
    console.warn(`Skipping checking of URL ${s} in ci pipeline`);
    return;
  }

  try {
    const res = await rq.head(s);

    assert.equal(res.status, 200, `${fieldName} responded with ${res.status} when trying to connect.`);
    assert.equal(res.header['accept-ranges'], 'bytes', `${fieldName} has not field 'accept-ranges' in header set to 'bytes'.`);

    if (expectedContentTypes.length > 0) {
      assert.notEqual(expectedContentTypes.indexOf(res.header['content-type']), -1, `${fieldName} has an unexpected content type ${res.header['content-type']}.`);
    }
  } catch (err) {
    assert.equal(err.status, 200, `${fieldName} responded with ${err.status} when trying to connect.`);
  }

}

function checkItunesCategory(cat: any, subcat: any = null) {
  assert.equal(typeof cat, 'string', `Itunes category must be a string.`);
  assert.ok(_.get(ITUNES_CATEGORIES, cat, null), `Itunes category is not a valid itunes category.`);

  if (subcat) {
    assert.equal(typeof subcat, 'string', `Itunes subcategory must be a string.`);
    assert.notEqual(_.get(ITUNES_CATEGORIES, cat, []).indexOf(subcat), -1, `Itunes subcategory is not valid.`);
  }
}

function checkBool(s: any, fieldName = 'Unknown') {
  assert.equal(typeof s, 'boolean', `${fieldName} must be a boolean.`);
}

function checkEmail(s: any, fieldName = 'Unknown') {
  assert.equal(EmailValidator.validate(s), true, `${fieldName} is not a valid email address.`);
}

function checkItunesType(s: any, fieldName = 'Unknown') {
  assert.notEqual(['serial', 'episodic'].indexOf(s), -1, `${fieldName} must be 'serial' or 'episodic'`);
}

function checkEpisodeType(s: any, fieldName = 'Unknown') {
  assert.notEqual(['full', 'trailer', 'bonus'].indexOf(s), -1, `${fieldName} must be 'full', 'trailer' or 'bonus'.`);
}

function checkAudioType(s: any, fieldName = 'Unknown') {
  assert.notEqual(['audio/x-m4a', 'audio/mpeg'].indexOf(s), -1, `${fieldName} valid audio type`);
}

/**
 * Test
 */

let exitCode = 0;

function handleError(err: Error, isStrict = false) {
  if (isStrict && !args['strict']) {
    console.warn(err.message);
    return;
  }

  console.error(err.message);
  exitCode = 1;
}

function check(value: any, validate: Function, fieldName: string = '') {
  try {
    validate(value, fieldName);
  } catch (err) {
    handleError(err);
  }
}

// Check RSS format

function checkRSSFormat() {
  const REQUIRED_RSS_ATTRS = {
    '@_version': "2.0",
    '@_xmlns:content': "http://purl.org/rss/1.0/modules/content/",
    '@_xmlns:googleplay': "http://www.google.com/schemas/play-podcasts/1.0",
    '@_xmlns:itunes': "http://www.itunes.com/dtds/podcast-1.0.dtd"
  };

  Object.entries(REQUIRED_RSS_ATTRS).map(([key, value]) => {
    try {
      assert.equal(_.get(feed, `rss.${key}`, ''), value, `RSS property ${key} should be set to ${value}`)
    } catch (err) {
      handleError(err);
    }
  });
}

const channel: any = _.get(feed, 'rss.channel', {});

async function checkChannel() {
  const REQUIRED_CHANNEL_ATTRS = {
    'title': checkDefaultString,
    'description': checkDescriptionString,
    'itunes:image.@_href': async (s, f) => await checkUrlExists(s, f, ['jpg', 'jpeg', 'png'], ['image/jpg', 'image/jpeg', 'image/png']),
    'language': checkLanguage,
    'itunes:explicit': checkBool,
    'atom:link.@_href': checkUrlExists
  }

  for (let [field, validate] of _.entries(REQUIRED_CHANNEL_ATTRS)) {
    try {
      await validate(_.get(channel, field, null), field);
    } catch (err) {
      handleError(err);
    }
  }

  try{
    const category: string = _.get(channel, 'itunes:category.@_text', '');
    const subcategory: string = _.get(channel, 'itunes:category.itunes:category.@_text', null);
    checkItunesCategory(category, subcategory);
  } catch (err) {
    handleError(err);
  }

  const OPTIONAL_CHANNEL_ATTRS = {
    'content:encoded': checkCDATAString,
    'itunes:summary': checkDescriptionString,
    'itunes:author': checkDefaultString,
    'link': checkUrlExists,
    'itunes:owner.itunes:name': checkDefaultString,
    'itunes:owner.itunes:email': checkEmail,
    'lastBuildDate': checkDate,
    'itunes:title': checkDefaultString,
    'itunes:type': checkItunesType,
    'copyright': checkDefaultString,
    'itunes:new-feed-url': checkUrlExists,
    'itunes:block': checkDefaultString,
    'itunes:complete': checkDefaultString
  }

  for (let [field, validate] of _.entries(OPTIONAL_CHANNEL_ATTRS)) {
    if (_.get(channel, field, undefined) === undefined) {
      continue;
    }

    try {
      await validate(_.get(channel, field, null), field);
    } catch (err) {
      handleError(err);
    }
  }

  const additionalChannelTags = _.without(
    Object.keys(channel),
    ...[
      ...[
        'itunes:image',
        'image',
        'itunes:category',
        'itunes:owner',
        'atom:link',
        'item'
      ],
      ...Object.keys(REQUIRED_CHANNEL_ATTRS),
      ...Object.keys(OPTIONAL_CHANNEL_ATTRS)
    ]
  );

  if (additionalChannelTags.length > 0) {
    handleError(new Error(`Channel has additional tags: ${additionalChannelTags.join(',')}`), true);
  }
}


async function checkEpisodes() {
  let items = _.get(channel, 'item', []);

  if (items && !(items instanceof Array)) {
    items = [items];
  }

  try {
    checkNatural(items.length, 'Episode count');
  } catch (err) {
    handleError(err);
  }

  const itunesType = _.get(channel, 'itunes:type', '');

  const REQUIRED_EPISODE_ATTRS = {
    'title': checkDefaultString,
    'enclosure.@_url': (s, f) => checkUrlFormat(s, f, ['mp3', 'm4a']),
    'enclosure.@_length': checkNumberString,
    'enclosure.@_type': checkAudioType,
    ...(itunesType === 'serial' && { 'itunes:episode': checkNatural })
  }

  const OPTIONAL_EPISODE_ATTRS = {
    'itunes:title': checkDefaultString,
    'itunes:author': checkDefaultString,
    'itunes:summary': checkDefaultString,
    'itunes:subtitle': checkDefaultString,
    'itunes:episodeType': checkEpisodeType,
    'content:encoded': checkCDATAString,
    'category': checkDefaultString,
    'guid.#text': checkDefaultString,
    'guid.@_isPermaLink': checkBool,
    'pubDate': checkDate,
    'description': checkDescriptionString,
    'itunes:duration': checkNatural,
    'link': checkUrlFormat,
    'itunes:image.@_href': async (s, f) => await checkUrlExists(s, f, ['jpg', 'jpeg', 'png'], ['image/jpg', 'image/jpeg', 'image/png']),
    'itunes:explicit': checkBool,
    ...(itunesType !== 'serial' && { 'itunes:episode': checkNatural }),
    'itunes:order': checkNatural,
    'itunes:season': checkNatural
  }


  let guids = new Set<string>();
  let episodes = new Set<number>();

  for (let item of items) {
    const guid = _.get(item, 'guid.#text', '');
    const episode = _.get(item, 'itunes:episode', '');

    if (guid)  {
      if (guids.has(guid)) {
        handleError(new Error(`${item['title']}: Duplicate guid ${guid}`));
      }
      guids.add(guid);
    }

    if (episode)  {
      if (episodes.has(episode)) {
        handleError(new Error(`${item['title']}: Duplicate episode ${episode}`));
      }
      episodes.add(episode);
    }

    for (let [field, validate] of _.entries(REQUIRED_EPISODE_ATTRS)) {
      try {
        await validate(_.get(item, field, null), `${item['title']}: ${field}`);
      } catch (err) {
        handleError(err);
      }
    }

    const additionalTags = _.without(
      Object.keys(item),
      ...[
        ...[
          'enclosure',
          'guid'
        ],
        ...Object.keys(REQUIRED_EPISODE_ATTRS),
        ...Object.keys(OPTIONAL_EPISODE_ATTRS)
      ]
    );

    if (additionalTags.length > 0) {
      handleError(new Error(`${item['title']}: Has additional tags: ${additionalTags.join(',')}`), true)
    }
  }
}

async function main() {
  checkRSSFormat();
  await checkChannel();
  await checkEpisodes();
  process.exit(exitCode);
}

main();
